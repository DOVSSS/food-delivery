import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { generateSlug } from './../utils/generate-slug';

@Injectable()
export class ProductService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateProductDto) {
    // проверка ресторана
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: dto.restaurantId },
    });

    if (!restaurant) {
      throw new NotFoundException('Restaurant not found');
    }

    const slug = await generateSlug(dto.name);

    return this.prisma.product.create({
      data: {
        ...dto,
        slug,
      },
    });
  }

  async findAll() {
    return this.prisma.product.findMany({
      include: {
        restaurant: true,
      },
    });
  }

  async findById(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        restaurant: true,
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  async findByRestaurant(restaurantId: string) {
    return this.prisma.product.findMany({
      where: { restaurantId },
    });
  }

  async update(id: string, dto: UpdateProductDto) {
    return this.prisma.product.update({
      where: { id },
      data: dto,
    });
  }

  async delete(id: string) {
    return this.prisma.product.delete({
      where: { id },
    });
  }
}