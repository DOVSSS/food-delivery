import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { generateSlug } from './../utils/generate-slug';

@Injectable()
export class ProductService {
  constructor(private prisma: PrismaService) {}

  /** Prisma update/create: category via relation, not raw categoryId. */
  private toProductWriteData(
    dto: CreateProductDto | UpdateProductDto,
  ): Prisma.ProductCreateInput | Prisma.ProductUpdateInput {
    const { categoryId, restaurantId, ...scalar } = dto as CreateProductDto;
    const data: Prisma.ProductUpdateInput = { ...scalar };

    if (categoryId !== undefined) {
      data.category = categoryId
        ? { connect: { id: categoryId } }
        : { disconnect: true };
    }

    if (restaurantId) {
      (data as Prisma.ProductCreateInput).restaurant = {
        connect: { id: restaurantId },
      };
    }

    return data;
  }

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
        ...(this.toProductWriteData(dto) as Prisma.ProductCreateInput),
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
      data: this.toProductWriteData(dto),
    });
  }

  async delete(id: string) {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Product not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.orderItem.deleteMany({ where: { productId: id } });
      await tx.product.delete({ where: { id } });
    });

    return { ok: true };
  }
}