import {
  Controller,
  Post,
  Headers,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Controller()
export class CleanupController {
  constructor(private prisma: PrismaService) {}

  @Post('cleanup')
  async cleanup(@Headers('x-secret') secret: string) {
    if (secret !== 'dzu-cleanup-2024') {
      throw new ForbiddenException();
    }

    await this.prisma.orderItem.deleteMany({});
    await this.prisma.order.deleteMany({});
    await this.prisma.product.deleteMany({});
    await this.prisma.restaurant.deleteMany({});

    return { ok: true, message: 'Тестовые данные удалены' };
  }
}