import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { generateSlug } from '../utils/generate-slug';
import { isRestaurantOpen } from './restaurant-hours.util';

@Injectable()
export class RestaurantService {
  constructor(private prisma: PrismaService) {}

  private withIsOpen<T extends { openTime: string | null; closeTime: string | null }>(
    restaurant: T,
  ) {
    return {
      ...restaurant,
      isOpen: isRestaurantOpen(restaurant.openTime, restaurant.closeTime),
    };
  }

  async create(data: { name: string; image: string; ownerId: string }) {
    const slug = generateSlug(data.name);
    const restaurant = await this.prisma.restaurant.create({
      data: { ...data, slug },
    });
    return this.withIsOpen(restaurant);
  }

  async findByOwner(ownerId: string) {
    const restaurant = await this.prisma.restaurant.findFirst({
      where: { ownerId },
      include: {
        products: {
          include: { category: true },
        },
      },
    });
    return restaurant ? this.withIsOpen(restaurant) : null;
  }

  async findAll() {
    const restaurants = await this.prisma.restaurant.findMany({
      include: {
        products: {
          include: { category: true },
        },
      },
    });
    return restaurants.map((r) => this.withIsOpen(r));
  }

  /** Список для клиента: без вложенного меню, только счётчик блюд. */
  async findAllCatalog() {
    const restaurants = await this.prisma.restaurant.findMany({
      include: {
        _count: { select: { products: true } },
      },
    });
    return restaurants.map(({ _count, ...restaurant }) => ({
      ...this.withIsOpen(restaurant),
      productCount: _count.products,
    }));
  }

  async findBySlug(slug: string) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { slug },
      include: {
        products: {
          include: { category: true },
        },
      },
    });
    return restaurant ? this.withIsOpen(restaurant) : null;
  }

  async findById(id: string) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id },
      include: {
        products: {
          include: { category: true },
        },
      },
    });
    return restaurant ? this.withIsOpen(restaurant) : null;
  }

  async update(
    id: string,
    data: { name?: string; image?: string; openTime?: string; closeTime?: string },
  ) {
    const existing = await this.prisma.restaurant.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Restaurant not found');
    let slug = existing.slug;
    if (data.name) slug = generateSlug(data.name);
    const restaurant = await this.prisma.restaurant.update({
      where: { id },
      data: { ...data, slug },
      include: {
        products: {
          include: { category: true },
        },
      },
    });
    return this.withIsOpen(restaurant);
  }

  async delete(id: string) {
    const existing = await this.prisma.restaurant.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Restaurant not found');

    await this.prisma.$transaction(async (tx) => {
      const products = await tx.product.findMany({
        where: { restaurantId: id },
        select: { id: true },
      });
      const productIds = products.map((p) => p.id);

      if (productIds.length > 0) {
        await tx.orderItem.deleteMany({
          where: { productId: { in: productIds } },
        });
        await tx.product.deleteMany({ where: { restaurantId: id } });
      }

      await tx.restaurant.delete({ where: { id } });
    });

    return { ok: true };
  }
}
