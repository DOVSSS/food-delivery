// src/order/order.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { generateOrderReference } from '../utils/generate-reference';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class OrderService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  async create(userId: string, createOrderDto: CreateOrderDto) {
    const { items, deliveryAddress, comment } = createOrderDto;

    if (!items || items.length === 0) {
      throw new BadRequestException('Order must contain at least one item');
    }

    const productIds = items.map(item => item.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      include: {
        restaurant: {
          include: {
            owner: { select: { id: true, pushToken: true } },
          },
        },
      },
    });

    if (products.length !== productIds.length) {
      throw new BadRequestException('Some products not found');
    }

    const productMap = new Map(products.map(p => [p.id, p]));

    let total = 0;
    const orderItems = items.map(item => {
      const product = productMap.get(item.productId);
      if (!product) throw new BadRequestException(`Product ${item.productId} not found`);
      total += product.price * item.quantity;
      return {
        productId: item.productId,
        quantity: item.quantity,
        price: product.price,
        productName: product.name,
        productImage: product.image,
      };
    });

    const reference = generateOrderReference();

    const order = await this.prisma.$transaction(async (prisma) => {
      return prisma.order.create({
        data: {
          reference,
          total,
          deliveryAddress,
          comment,
          userId,
          status: 'PENDING',
          items: { create: orderItems },
        },
        include: { items: true },
      });
    });

    // Уведомляем владельцев ресторанов
    const notifiedOwners = new Set<string>();
    for (const product of products) {
      const owner = product.restaurant?.owner;
      if (owner?.pushToken && !notifiedOwners.has(owner.id)) {
        notifiedOwners.add(owner.id);
        await this.notificationsService.sendPushNotification(
          owner.pushToken,
          '🍕 Новый заказ!',
          `Поступил новый заказ на сумму ${total} ₸`,
          { orderId: order.id },
        );
      }
    }

    return this.formatOrderResponse(order);
  }

  async updateStatus(id: string, updateOrderDto: UpdateOrderDto) {
    const order = await this.findById(id);

    this.validateStatusTransition(order.status, updateOrderDto.status);

    const updatedOrder = await this.prisma.order.update({
      where: { id },
      data: {
        status: updateOrderDto.status,
        deliveryAddress: updateOrderDto.deliveryAddress,
        comment: updateOrderDto.comment,
        ...(updateOrderDto.status === 'DELIVERING' && { deliveryTime: new Date() }),
      },
      include: { items: true },
    });

    // Уведомляем курьеров когда заказ готов
    if (updateOrderDto.status === 'READY') {
      const couriers = await this.prisma.user.findMany({
        where: { role: 'COURIER', pushToken: { not: null } },
        select: { pushToken: true },
      });

      const tokens = couriers.map(c => c.pushToken!);
      if (tokens.length > 0) {
        await this.notificationsService.sendToMany(
          tokens,
          '🚴 Заказ готов к доставке!',
          `Заказ #${order.reference} ожидает курьера`,
          { orderId: id },
        );
      }
    }

    return this.formatOrderResponse(updatedOrder);
  }

  // Остальные методы без изменений
  async findAll() {
    const orders = await this.prisma.order.findMany({
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, address: true } },
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return orders.map(order => this.formatOrderResponse(order));
  }

  async findById(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, address: true } },
        items: true,
      },
    });
    if (!order) throw new NotFoundException(`Order with ID ${id} not found`);
    return this.formatOrderResponse(order);
  }

  async findByReference(reference: string) {
    const order = await this.prisma.order.findUnique({
      where: { reference },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, address: true } },
        items: true,
      },
    });
    if (!order) throw new NotFoundException(`Order with reference ${reference} not found`);
    return this.formatOrderResponse(order);
  }

  async findByUser(userId: string) {
    const orders = await this.prisma.order.findMany({
      where: { userId },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
    return orders.map(order => this.formatOrderResponse(order));
  }

  async findByRestaurant(restaurantId: string) {
    const orders = await this.prisma.order.findMany({
      where: { items: { some: { product: { restaurantId } } } },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, address: true } },
        items: { include: { product: { select: { restaurantId: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return orders.map(order => this.formatOrderResponse(order));
  }

  async cancelOrder(id: string) {
    const order = await this.findById(id);
    if (order.status === 'DELIVERED') throw new BadRequestException('Cannot cancel delivered order');
    if (order.status === 'CANCELLED') throw new BadRequestException('Order is already cancelled');
    const cancelledOrder = await this.prisma.order.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: { items: true },
    });
    return this.formatOrderResponse(cancelledOrder);
  }

  async deleteOrder(id: string) {
    const order = await this.findById(id);
    if (!['CANCELLED', 'DELIVERED'].includes(order.status)) {
      throw new BadRequestException('Can only delete cancelled or delivered orders');
    }
    await this.prisma.order.delete({ where: { id } });
    return { message: 'Order deleted successfully' };
  }

  async getOrderStats() {
    const stats = await this.prisma.order.aggregate({
      _count: true,
      _sum: { total: true },
      _avg: { total: true },
      _min: { createdAt: true },
      _max: { createdAt: true },
    });
    const statusCounts = await this.prisma.order.groupBy({
      by: ['status'],
      _count: { status: true },
    });
    return {
      totalOrders: stats._count,
      totalRevenue: stats._sum.total || 0,
      averageOrderValue: stats._avg.total || 0,
      firstOrderDate: stats._min.createdAt,
      lastOrderDate: stats._max.createdAt,
      statusBreakdown: statusCounts.map(s => ({ status: s.status, count: s._count.status })),
    };
  }

  private validateStatusTransition(currentStatus: string, newStatus?: string) {
    if (!newStatus || currentStatus === newStatus) return;
    const validTransitions: Record<string, string[]> = {
      PENDING: ['CONFIRMED', 'CANCELLED'],
      CONFIRMED: ['PREPARING', 'CANCELLED'],
      PREPARING: ['READY', 'CANCELLED'],
      READY: ['DELIVERING', 'CANCELLED'],
      DELIVERING: ['DELIVERED', 'CANCELLED'],
      DELIVERED: [],
      CANCELLED: [],
    };
    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw new BadRequestException(`Cannot change order status from ${currentStatus} to ${newStatus}`);
    }
  }

  private formatOrderResponse(order: any) {
    const { user, ...rest } = order;
    return {
      ...rest,
      user: user ? { id: user.id, name: user.name, email: user.email, phone: user.phone, address: user.address } : null,
      total: order.total,
    };
  }
}