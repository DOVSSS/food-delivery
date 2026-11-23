import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Role } from '@prisma/client';

@Injectable()
export class RevenueService {
  constructor(private prisma: PrismaService) {}

  private unsettledWhere(courierId: string) {
    return {
      courierId,
      status: 'DELIVERED',
      serviceFee: { gt: 0 },
      serviceFeeSettlementId: null,
    };
  }

  async getCourierOwed(courierId: string) {
    const agg = await this.prisma.order.aggregate({
      where: this.unsettledWhere(courierId),
      _sum: { serviceFee: true },
      _count: { _all: true },
    });

    return {
      owed: agg._sum.serviceFee ?? 0,
      orderCount: agg._count._all,
    };
  }

  async getDebts() {
    const groups = await this.prisma.order.groupBy({
      by: ['courierId'],
      where: {
        status: 'DELIVERED',
        serviceFee: { gt: 0 },
        serviceFeeSettlementId: null,
        courierId: { not: null },
      },
      _sum: { serviceFee: true },
      _count: { _all: true },
    });

    const courierIds = groups
      .map((g) => g.courierId)
      .filter((id): id is string => !!id);

    if (courierIds.length === 0) {
      return [];
    }

    const couriers = await this.prisma.user.findMany({
      where: { id: { in: courierIds } },
      select: { id: true, name: true, email: true },
    });
    const courierMap = new Map(couriers.map((c) => [c.id, c]));

    return groups
      .filter((g) => g.courierId)
      .map((g) => {
        const courier = courierMap.get(g.courierId!);
        return {
          courierId: g.courierId!,
          name: courier?.name ?? '—',
          email: courier?.email ?? '',
          owed: g._sum.serviceFee ?? 0,
          orderCount: g._count._all,
        };
      })
      .filter((d) => d.owed > 0)
      .sort((a, b) => b.owed - a.owed);
  }

  async settle(courierId: string, confirmedById: string) {
    const courier = await this.prisma.user.findUnique({
      where: { id: courierId },
      select: { id: true, role: true, name: true },
    });
    if (!courier || courier.role !== Role.COURIER) {
      throw new NotFoundException('Курьер не найден');
    }

    return this.prisma.$transaction(async (tx) => {
      const orders = await tx.order.findMany({
        where: this.unsettledWhere(courierId),
        select: { id: true, serviceFee: true },
      });

      const amount = orders.reduce((sum, o) => sum + o.serviceFee, 0);
      if (amount <= 0) {
        throw new BadRequestException('Нет несданного сервисного сбора');
      }

      const settlement = await tx.serviceFeeSettlement.create({
        data: {
          amount,
          courierName: courier.name,
          courierId,
          confirmedById,
        },
      });

      const linked = await tx.order.updateMany({
        where: {
          id: { in: orders.map((o) => o.id) },
          serviceFeeSettlementId: null,
        },
        data: { serviceFeeSettlementId: settlement.id },
      });
      if (linked.count !== orders.length) {
        throw new BadRequestException('Сдача уже подтверждена, обновите страницу');
      }

      return {
        id: settlement.id,
        amount: settlement.amount,
        courierId,
        courierName: settlement.courierName,
        createdAt: settlement.createdAt,
        orderCount: orders.length,
      };
    });
  }

  private parseInstant(value: string | undefined, label: string) {
    if (!value) return undefined;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`Некорректная дата: ${label}`);
    }
    return date;
  }

  /** from/to — ISO-моменты границ периода в часовом поясе админа (считает клиент). */
  async getRevenue(from?: string, to?: string) {
    const gte = this.parseInstant(from, 'from');
    const lte = this.parseInstant(to, 'to');

    const settlements = await this.prisma.serviceFeeSettlement.findMany({
      where: gte || lte ? { createdAt: { gte, lte } } : {},
      orderBy: { createdAt: 'desc' },
      include: {
        courier: { select: { email: true } },
        _count: { select: { orders: true } },
      },
    });

    return {
      totalRevenue: settlements.reduce((sum, s) => sum + s.amount, 0),
      settlements: settlements.map((s) => ({
        id: s.id,
        amount: s.amount,
        createdAt: s.createdAt,
        courierId: s.courierId,
        courierName: s.courierName,
        courierEmail: s.courier?.email ?? '',
        orderCount: s._count.orders,
      })),
    };
  }
}
