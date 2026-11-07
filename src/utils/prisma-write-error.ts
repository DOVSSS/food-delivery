import {
  BadRequestException,
  ConflictException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

export type PrismaWriteErrorLabels = {
  duplicateName?: string;
  duplicateSlug?: string;
  duplicate?: string;
  notFound?: string;
  foreignKey?: string;
};

const DEFAULT_LABELS: Required<PrismaWriteErrorLabels> = {
  duplicateName: 'Запись с таким названием уже существует',
  duplicateSlug: 'Запись с похожим названием уже существует',
  duplicate: 'Такая запись уже существует',
  notFound: 'Запись не найдена',
  foreignKey: 'Нельзя выполнить действие: связанные данные уже используются',
};

export function mapPrismaWriteError(
  error: unknown,
  labels: PrismaWriteErrorLabels = {},
): HttpException | null {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return null;
  }

  const text = { ...DEFAULT_LABELS, ...labels };

  if (error.code === 'P2002') {
    const target = error.meta?.target;
    const fields = Array.isArray(target)
      ? target.join(',')
      : String(target ?? '');

    if (fields.includes('name')) {
      return new ConflictException(text.duplicateName);
    }
    if (fields.includes('slug')) {
      return new ConflictException(text.duplicateSlug);
    }
    return new ConflictException(text.duplicate);
  }

  if (error.code === 'P2003' || error.code === 'P2014') {
    return new BadRequestException(text.foreignKey);
  }

  if (error.code === 'P2025') {
    return new NotFoundException(text.notFound);
  }

  return null;
}

export function rethrowPrismaWriteError(
  error: unknown,
  labels: PrismaWriteErrorLabels = {},
): never {
  const mapped = mapPrismaWriteError(error, labels);
  if (mapped) {
    throw mapped;
  }
  throw error;
}
