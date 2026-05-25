// src/order/order.service.ts
import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { generateOrderReference } from '../utils/generate-reference';

@Injectable()
export class OrderService {
  constructor(private prisma: PrismaService,
    
  ) {}

  async create(userId: string, createOrderDto: CreateOrderDto) {
    const { items, deliveryAddress, comment } = createOrderDto;

    if (!items || items.length === 0) {
      throw new BadRequestException('Order must contain at least one item');
    }

    // Получаем все продукты из базы
    const productIds = items.map(item => item.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
    });

    if (products.length !== productIds.length) {
      throw new BadRequestException('Some products not found');
    }

    // Создаем карту продуктов для быстрого доступа
    const productMap = new Map(products.map(p => [p.id, p]));

    // Рассчитываем общую сумму и готовим order items
    let total = 0;
    const orderItems = items.map(item => {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new BadRequestException(`Product ${item.productId} not found`);
      }
      
      const itemTotal = product.price * item.quantity;
      total += itemTotal;
      
      return {
        productId: item.productId,
        quantity: item.quantity,
        price: product.price,
        productName: product.name,
        productImage: product.image,
      };
    });

    // Генерируем уникальный номер заказа
    const reference = generateOrderReference();

    // Создаем заказ в транзакции
    const order = await this.prisma.$transaction(async (prisma) => {
      // Создаем заказ
      const newOrder = await prisma.order.create({
        data: {
          reference,
          total,
          deliveryAddress,
          comment,
          userId,
          status: 'PENDING',
          items: {
            create: orderItems,
          },
        },
        include: {
          items: true,
        },
      });

      return newOrder;
    });

    return this.formatOrderResponse(order);
  }

  async findAll() {
    const orders = await this.prisma.order.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
             address: true,
          },
        },
        items: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return orders.map(order => this.formatOrderResponse(order));
  }

  async findById(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
             address: true,
          },
        },
        items: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    return this.formatOrderResponse(order);
  }

  async findByReference(reference: string) {
    const order = await this.prisma.order.findUnique({
      where: { reference },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
             address: true,
          },
        },
        items: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with reference ${reference} not found`);
    }

    return this.formatOrderResponse(order);
  }

  async findByUser(userId: string) {
    const orders = await this.prisma.order.findMany({
      where: { userId },
      include: {
        items: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return orders.map(order => this.formatOrderResponse(order));
  }

  async findByRestaurant(restaurantId: string) {
  const orders = await this.prisma.order.findMany({
    where: {
      items: {
        some: {
          product: {
            restaurantId,
          },
        },
      },
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
           address: true,
        },
      },
      items: {
        include: {
          product: {
            select: {
              restaurantId: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
  

  return orders.map(order => this.formatOrderResponse(order));
}

  async updateStatus(id: string, updateOrderDto: UpdateOrderDto) {
    const order = await this.findById(id);

    // Проверка валидности смены статуса
    this.validateStatusTransition(order.status, updateOrderDto.status);

    const updatedOrder = await this.prisma.order.update({
      where: { id },
      data: {
        status: updateOrderDto.status,
        deliveryAddress: updateOrderDto.deliveryAddress,
        comment: updateOrderDto.comment,
        ...(updateOrderDto.status === 'DELIVERING' && { deliveryTime: new Date() }),
      },
      include: {
        items: true,
      },
    });

    return this.formatOrderResponse(updatedOrder);
  }

  async cancelOrder(id: string) {
    const order = await this.findById(id);

    if (order.status === 'DELIVERED') {
      throw new BadRequestException('Cannot cancel delivered order');
    }

    if (order.status === 'CANCELLED') {
      throw new BadRequestException('Order is already cancelled');
    }

    const cancelledOrder = await this.prisma.order.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: { items: true },
    });

    return this.formatOrderResponse(cancelledOrder);
  }

  async deleteOrder(id: string) {
    const order = await this.findById(id);
    
    // Можно удалять только отмененные или доставленные заказы
    if (!['CANCELLED', 'DELIVERED'].includes(order.status)) {
      throw new BadRequestException('Can only delete cancelled or delivered orders');
    }

    await this.prisma.order.delete({
      where: { id },
    });

    return { message: 'Order deleted successfully' };
  }

  async getOrderStats() {
    const stats = await this.prisma.order.aggregate({
      _count: true,
      _sum: {
        total: true,
      },
      _avg: {
        total: true,
      },
      _min: {
        createdAt: true,
      },
      _max: {
        createdAt: true,
      },
    });

    const statusCounts = await this.prisma.order.groupBy({
      by: ['status'],
      _count: {
        status: true,
      },
    });

    return {
      totalOrders: stats._count,
      totalRevenue: stats._sum.total || 0,
      averageOrderValue: stats._avg.total || 0,
      firstOrderDate: stats._min.createdAt,
      lastOrderDate: stats._max.createdAt,
      statusBreakdown: statusCounts.map(s => ({
        status: s.status,
        count: s._count.status,
      })),
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
      throw new BadRequestException(
        `Cannot change order status from ${currentStatus} to ${newStatus}`
      );
    }
  }

  private formatOrderResponse(order: any) {
    const { user, ...rest } = order;
    return {
      ...rest,
      user: user ? {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        address: user.address,
      } : null,
      total: order.total, // Уже в копейках
    };
  }
}