import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { generateSlug } from '../utils/generate-slug';

@Injectable()
export class RestaurantService {
  constructor(private prisma: PrismaService) {}

  async create(data: { name: string; image: string; ownerId: string }) {  // ← ownerId
    const slug = generateSlug(data.name);

    return this.prisma.restaurant.create({
      data: {
        ...data,
        slug,
      },
    });
  }

  async findByOwner(ownerId: string) {  // ← новый метод
    return this.prisma.restaurant.findFirst({
      where: { ownerId },
      include: { products: true },
    });
  }

  async findAll() {
    return this.prisma.restaurant.findMany({
      include: { products: true },
    });
  }

  async findBySlug(slug: string) {
    return this.prisma.restaurant.findUnique({
      where: { slug },
      include: { products: true },
    });
  }

  async findById(id: string) {
    return this.prisma.restaurant.findUnique({
      where: { id },
      include: { products: true },
    });
  }

  async update(id: string, data: { name?: string; image?: string }) {
    const existing = await this.prisma.restaurant.findUnique({
      where: { id },
    });

    if (!existing) throw new NotFoundException('Restaurant not found');

    let slug = existing.slug;
    if (data.name) slug = generateSlug(data.name);

    return this.prisma.restaurant.update({
      where: { id },
      data: { ...data, slug },
    });
  }

  async delete(id: string) {
    return this.prisma.restaurant.delete({
      where: { id },
    });
  }
}