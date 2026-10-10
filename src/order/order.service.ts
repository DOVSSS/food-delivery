// src/order/order.service.ts
import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Role, User } from '@prisma/client';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { generateOrderReference } from '../utils/generate-reference';
import { NotificationsService } from '../notifications/notifications.service';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class OrderService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private settingsService: SettingsService,
  ) {}

  async create(userId: string, createOrderDto: CreateOrderDto) {
    const { items, deliveryAddress, comment, deliveryLat, deliveryLng } = createOrderDto;

    if (!items || items.length === 0) {
      throw new BadRequestException('Order must contain at least one item');
    }

    const settings = await this.settingsService.get();
    const deliveryFee = settings.deliveryFee;
    const serviceFee = settings.serviceFee;

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

    let subtotal = 0;
    const orderItems = items.map(item => {
      const product = productMap.get(item.productId);
      if (!product) throw new BadRequestException(`Product ${item.productId} not found`);
      if (product.isAvailable === false) {
        throw new BadRequestException(`«${product.name}» временно недоступно`);
      }
      subtotal += product.price * item.quantity;
      return {
        productId: item.productId,
        quantity: item.quantity,
        price: product.price,
        productName: product.name,
        productImage: product.image,
      };
    });

    const total = subtotal + deliveryFee + serviceFee;
    const reference = generateOrderReference();

    const order = await this.prisma.$transaction(async (prisma) => {
      return prisma.order.create({
        data: {
          reference,
          total,
          deliveryFee,
          deliveryAddress,
          deliveryLat,
          deliveryLng,
          comment,
          userId,
          status: 'PENDING',
          items: { create: orderItems },
        },
        include: { items: true },
      });
    });

    // Уведомляем ресторан
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

    // Уведомляем всех курьеров о новом заказе
    const couriers = await this.prisma.user.findMany({
      where: { role: 'COURIER', pushToken: { not: null } },
      select: { pushToken: true },
    });
    const courierTokens = couriers.map(c => c.pushToken!);
    if (courierTokens.length > 0) {
      await this.notificationsService.sendToMany(
        courierTokens,
        '🛍️ Новый заказ!',
        `Поступил новый заказ #${reference}`,
        { orderId: order.id },
      );
    }

    return { ...this.formatOrderResponse(order), subtotal, deliveryFee, serviceFee };
  }

  async updateStatus(id: string, updateOrderDto: UpdateOrderDto, actor: User) {
    const order = await this.getOrderForAccessCheck(id);

    if (updateOrderDto.status) {
      await this.assertCanUpdateOrderStatus(actor, order, updateOrderDto.status);
    } else if (actor.role !== Role.ADMIN) {
      throw new ForbiddenException('Only admin can update order details without status change');
    }

    this.validateStatusTransition(order.status, updateOrderDto.status);

    const updatedOrder = await this.prisma.order.update({
      where: { id },
      data: {
        status: updateOrderDto.status,
        deliveryAddress: updateOrderDto.deliveryAddress,
        comment: updateOrderDto.comment,
      },
      include: this.orderListInclude({ userPushToken: true }),
    });

    // Уведомляем клиента и курьеров при смене статуса рестораном
    if (updateOrderDto.status === 'ACCEPTED') {
      // Клиенту
      if (updatedOrder.user?.pushToken) {
        await this.notificationsService.sendPushNotification(
          updatedOrder.user.pushToken,
          '✅ Заказ принят!',
          `Ресторан принял ваш заказ #${order.reference}`,
          { orderId: id },
        );
      }
      // Курьерам
      const couriers = await this.prisma.user.findMany({
        where: { role: 'COURIER', pushToken: { not: null } },
        select: { pushToken: true },
      });
      const tokens = couriers.map(c => c.pushToken!);
      if (tokens.length > 0) {
        await this.notificationsService.sendToMany(
          tokens,
          '✅ Заказ принят рестораном',
          `Заказ #${order.reference} принят, готовится`,
          { orderId: id },
        );
      }
    }

    if (updateOrderDto.status === 'READY') {
      // Клиенту
      if (updatedOrder.user?.pushToken) {
        await this.notificationsService.sendPushNotification(
          updatedOrder.user.pushToken,
          '🍕 Заказ готов!',
          `Ваш заказ #${order.reference} готов, ждём курьера`,
          { orderId: id },
        );
      }
      // Курьерам
      const couriers = await this.prisma.user.findMany({
        where: { role: 'COURIER', pushToken: { not: null } },
        select: { pushToken: true },
      });
      const tokens = couriers.map(c => c.pushToken!);
      if (tokens.length > 0) {
        await this.notificationsService.sendToMany(
          tokens,
          '🚴 Заказ готов к выдаче!',
          `Заказ #${order.reference} ожидает курьера`,
          { orderId: id },
        );
      }
    }

    await this.attachProductsToOrderItems([updatedOrder]);
    return this.formatOrderResponse(updatedOrder);
  }

  async findAll(
    actor: User,
    filters?: { restaurantId?: string; status?: string },
  ) {
    if (actor.role !== Role.ADMIN && actor.role !== Role.COURIER) {
      throw new ForbiddenException('Access denied');
    }

    const where: {
      status?: string;
      items?: { some: { product: { restaurantId: string } } };
    } = {};

    if (actor.role === Role.ADMIN) {
      if (filters?.status) {
        where.status = filters.status;
      }
      if (filters?.restaurantId) {
        where.items = { some: { product: { restaurantId: filters.restaurantId } } };
      }
    }

    const orders = await this.prisma.order.findMany({
      where,
      include: this.orderListInclude(),
      orderBy: { createdAt: 'desc' },
    });
    await this.attachProductsToOrderItems(orders);
    return orders.map(order => this.formatOrderResponse(order));
  }

  async findById(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, address: true } },
        courier: { select: { id: true, name: true, phone: true } },
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
      include: {
        items: true,
        courier: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return orders.map(order => this.formatOrderResponse(order));
  }

  async findByRestaurant(restaurantId: string, actor: User) {
    await this.assertCanAccessRestaurantOrders(actor, restaurantId);

    const orders = await this.prisma.order.findMany({
      where: { items: { some: { product: { restaurantId } } } },
      include: this.orderListInclude(),
      orderBy: { createdAt: 'desc' },
    });
    await this.attachProductsToOrderItems(orders);
    return orders.map(order => this.formatOrderResponse(order));
  }

  async cancelOrder(id: string, actor: User) {
    const order = await this.getOrderForAccessCheck(id);
    await this.assertCanUpdateOrderStatus(actor, order, 'CANCELLED');
    this.validateStatusTransition(order.status, 'CANCELLED');
    if (order.status === 'DELIVERED') throw new BadRequestException('Cannot cancel delivered order');
    if (order.status === 'CANCELLED') throw new BadRequestException('Order is already cancelled');
    const cancelledOrder = await this.prisma.order.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: this.orderListInclude(),
    });
    await this.attachProductsToOrderItems([cancelledOrder]);
    return this.formatOrderResponse(cancelledOrder);
  }

  async deleteOrder(id: string, actor: User) {
    if (actor.role !== Role.ADMIN) {
      throw new ForbiddenException('Only admin can delete orders');
    }
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
      PENDING: ['ACCEPTED', 'CANCELLED'],
      ACCEPTED: ['READY', 'CANCELLED'],
      READY: ['DELIVERING', 'CANCELLED'],
      DELIVERING: ['DELIVERED', 'CANCELLED'],
      DELIVERED: [],
      CANCELLED: [],
    };
    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw new BadRequestException(`Cannot change order status from ${currentStatus} to ${newStatus}`);
    }
  }

  async acceptOrder(orderId: string, courierId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { user: { select: { pushToken: true } } },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== 'READY') {
      throw new BadRequestException('Order is not ready for delivery');
    }
    if (order.courierId) {
      throw new BadRequestException('Order already taken by another courier');
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        courierId,
        status: 'DELIVERING',
        deliveryTime: new Date(),
      },
      include: {
        items: true,
        courier: { select: { id: true, name: true, phone: true } },
        user: { select: { id: true, name: true, email: true, phone: true, address: true, pushToken: true } },
      },
    });

    // Уведомляем клиента
    if (updated.user?.pushToken) {
      await this.notificationsService.sendPushNotification(
        updated.user.pushToken,
        '🚴 Курьер в пути!',
        `Курьер забрал ваш заказ #${order.reference}`,
        { orderId },
      );
    }

    return this.formatOrderResponse(updated);
  }

  async updateLocation(orderId: string, courierId: string, lat: number, lng: number) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.courierId !== courierId) {
      throw new ForbiddenException('You are not the courier for this order');
    }

    return this.prisma.order.update({
      where: { id: orderId },
      data: {
        courierLat: lat,
        courierLng: lng,
        courierUpdatedAt: new Date(),
      },
      select: { id: true, courierLat: true, courierLng: true, courierUpdatedAt: true },
    });
  }

  private async attachProductsToOrderItems(
    orders: Array<{ items: Array<{ productId: string; product?: unknown }> }>,
  ) {
    const productIds = [
      ...new Set(
        orders.flatMap(order => order.items.map(item => item.productId).filter(Boolean)),
      ),
    ];
    if (productIds.length === 0) {
      return;
    }

    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true,
        restaurantId: true,
        restaurant: { select: { id: true, name: true } },
      },
    });
    const byId = new Map(products.map(product => [product.id, product]));

    for (const order of orders) {
      for (const item of order.items) {
        if (!item.product) {
          item.product = byId.get(item.productId) ?? null;
        }
      }
    }
  }

  private orderListInclude(options?: { userPushToken?: boolean }) {
    return {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          address: true,
          ...(options?.userPushToken ? { pushToken: true } : {}),
        },
      },
      items: {
        include: {
          product: {
            select: {
              restaurantId: true,
              restaurant: { select: { id: true, name: true } },
            },
          },
        },
      },
    };
  }

  private async getOrderForAccessCheck(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: { include: { product: { select: { restaurantId: true } } } } },
    });
    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }
    return order;
  }

  private async getRestaurantIdsForOrder(orderId: string): Promise<string[]> {
    const items = await this.prisma.orderItem.findMany({
      where: { orderId },
      select: { product: { select: { restaurantId: true } } },
    });
    return [...new Set(items.map(item => item.product.restaurantId))];
  }

  private async assertCanAccessRestaurantOrders(actor: User, restaurantId: string) {
    if (actor.role === Role.ADMIN) {
      return;
    }
    if (actor.role !== Role.RESTAURANT) {
      throw new ForbiddenException('Access denied');
    }
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { ownerId: true },
    });
    if (!restaurant || restaurant.ownerId !== actor.id) {
      throw new ForbiddenException('Access denied');
    }
  }

  private async assertCanUpdateOrderStatus(actor: User, order: { id: string; status: string; courierId: string | null; userId: string | null }, newStatus: string) {
    if (actor.role === Role.ADMIN) {
      return;
    }

    if (actor.role === Role.RESTAURANT) {
      const restaurantIds = await this.getRestaurantIdsForOrder(order.id);
      const owns = await this.prisma.restaurant.count({
        where: { ownerId: actor.id, id: { in: restaurantIds } },
      });
      if (!owns) {
        throw new ForbiddenException('You cannot manage this order');
      }
      const allowed = ['ACCEPTED', 'READY', 'CANCELLED'];
      if (!allowed.includes(newStatus)) {
        throw new ForbiddenException('Restaurant can only accept, mark ready, or cancel orders');
      }
      return;
    }

    if (actor.role === Role.COURIER) {
      if (newStatus === 'DELIVERED' && order.courierId === actor.id) {
        return;
      }
      throw new ForbiddenException('Courier can only mark their delivery as delivered');
    }

    if (actor.role === Role.USER && order.userId === actor.id && newStatus === 'CANCELLED') {
      return;
    }

    throw new ForbiddenException('Access denied');
  }

  private formatOrderResponse(order: any) {
    const { user, items, ...rest } = order;
    const restaurantsMap = new Map<string, { id: string; name: string }>();

    const formattedItems = (items ?? []).map((item: any) => {
      const restaurant = item.product?.restaurant;
      if (restaurant) {
        restaurantsMap.set(restaurant.id, { id: restaurant.id, name: restaurant.name });
      }
      const { product, ...itemRest } = item;
      return {
        ...itemRest,
        restaurantId: product?.restaurantId ?? null,
        restaurantName: restaurant?.name ?? null,
      };
    });

    return {
      ...rest,
      items: formattedItems,
      restaurants: [...restaurantsMap.values()],
      user: user ? { id: user.id, name: user.name, email: user.email, phone: user.phone, address: user.address } : null,
      total: order.total,
    };
  }
}

