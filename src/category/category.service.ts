import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { generateSlug } from '../utils/generate-slug';
import { rethrowPrismaWriteError } from '../utils/prisma-write-error';

const CATEGORY_PRISMA_LABELS = {
  duplicateName: 'Категория с таким названием уже существует',
  duplicateSlug: 'Категория с похожим названием уже существует',
  duplicate: 'Такая категория уже существует',
  notFound: 'Категория не найдена',
  foreignKey: 'Нельзя удалить категорию: в ней есть блюда',
};

@Injectable()
export class CategoryService {
  constructor(private prisma: PrismaService) {}

  private async makeUniqueSlug(name: string, excludeId?: string) {
    const base = generateSlug(name) || 'category';
    let slug = base;

    for (let i = 2; i < 1000; i++) {
      const found = await this.prisma.category.findFirst({
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

  private async assertNameAvailable(name: string, excludeId?: string) {
    const existing = await this.prisma.category.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('Категория с таким названием уже существует');
    }
  }

  async create(dto: CreateCategoryDto) {
    const name = dto.name.trim();
    const emoji = (dto.emoji ?? '').trim() || '🍽️';

    await this.assertNameAvailable(name);
    const slug = await this.makeUniqueSlug(name);

    try {
      return await this.prisma.category.create({
        data: { name, emoji, slug },
      });
    } catch (error) {
      rethrowPrismaWriteError(error, CATEGORY_PRISMA_LABELS);
    }
  }

  async findAll() {
    return this.prisma.category.findMany({
      include: {
        _count: {
          select: { products: true },
        },
      },
    });
  }

  async findById(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Категория не найдена');
    }

    return category;
  }

  async update(id: string, dto: UpdateCategoryDto) {
    await this.findById(id);

    const data: UpdateCategoryDto = { ...dto };
    if (typeof dto.name === 'string') {
      data.name = dto.name.trim();
      await this.assertNameAvailable(data.name, id);
    }
    if (typeof dto.emoji === 'string') {
      data.emoji = dto.emoji.trim() || '🍽️';
    }

    try {
      return await this.prisma.category.update({
        where: { id },
        data,
      });
    } catch (error) {
      rethrowPrismaWriteError(error, CATEGORY_PRISMA_LABELS);
    }
  }

  async delete(id: string) {
    await this.findById(id);

    const productsCount = await this.prisma.product.count({
      where: { categoryId: id },
    });
    if (productsCount > 0) {
      throw new BadRequestException(
        'Нельзя удалить категорию: в ней есть блюда',
      );
    }

    try {
      return await this.prisma.category.delete({
        where: { id },
      });
    } catch (error) {
      rethrowPrismaWriteError(error, CATEGORY_PRISMA_LABELS);
    }
  }
}
