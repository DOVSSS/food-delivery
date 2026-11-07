import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { generateSlug } from './../utils/generate-slug';
import { rethrowPrismaWriteError } from '../utils/prisma-write-error';

const PRODUCT_PRISMA_LABELS = {
  duplicateName: 'Блюдо с таким названием уже существует. Укажите другое название.',
  duplicateSlug: 'Блюдо с похожим названием уже существует. Укажите другое название.',
  duplicate: 'Такое блюдо уже существует.',
  notFound: 'Блюдо не найдено',
  foreignKey: 'Указана несуществующая категория или ресторан.',
};

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

  private async makeUniqueSlug(name: string, excludeId?: string) {
    const base = generateSlug(name) || 'bludo';
    let slug = base;

    for (let i = 2; i < 1000; i++) {
      const found = await this.prisma.product.findFirst({
        where: {
          slug,
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
        select: { id: true },
      });
      if (!found) return slug;
      slug = `${base}-${i}`;
    }

    return `${base}-${Date.now()}`;
  }

  private async assertCategoryExists(categoryId?: string) {
    if (!categoryId) return;
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true },
    });
    if (!category) {
      throw new BadRequestException('Категория не найдена');
    }
  }

  async create(dto: CreateProductDto) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: dto.restaurantId },
    });

    if (!restaurant) {
      throw new NotFoundException('Ресторан не найден');
    }

    await this.assertCategoryExists(dto.categoryId);

    const slug = await this.makeUniqueSlug(dto.name);

    try {
      return await this.prisma.product.create({
        data: {
          ...(this.toProductWriteData(dto) as Prisma.ProductCreateInput),
          slug,
        },
      });
    } catch (error) {
      rethrowPrismaWriteError(error, PRODUCT_PRISMA_LABELS);
    }
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
      throw new NotFoundException('Блюдо не найдено');
    }

    return product;
  }

  async findByRestaurant(restaurantId: string) {
    return this.prisma.product.findMany({
      where: { restaurantId },
    });
  }

  async update(id: string, dto: UpdateProductDto) {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Блюдо не найдено');
    }

    await this.assertCategoryExists(dto.categoryId);

    try {
      return await this.prisma.product.update({
        where: { id },
        data: this.toProductWriteData(dto),
      });
    } catch (error) {
      rethrowPrismaWriteError(error, PRODUCT_PRISMA_LABELS);
    }
  }

  async delete(id: string) {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Блюдо не найдено');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.orderItem.deleteMany({ where: { productId: id } });
      await tx.product.delete({ where: { id } });
    });

    return { ok: true };
  }
}
