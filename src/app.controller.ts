import { Controller, Get, Post, Headers, Param, ForbiddenException } from '@nestjs/common';
import { AppService } from './app.service';
import { PrismaService } from './prisma.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('make-admin/:email')
  async makeAdmin(@Param('email') email: string) {
    const user = await this.prisma.user.update({
      where: { email },
      data: { role: 'ADMIN' },
    });
    return { success: true, email: user.email, role: user.role };
  }

  // Временный endpoint — удалить после использования!
  @Post('migrate-resolve')
  async migrateResolve(@Headers('x-secret') secret: string) {
    if (secret !== 'dzu-cleanup-2024') {
      throw new ForbiddenException();
    }

    await this.prisma.$executeRawUnsafe(`
      UPDATE "_prisma_migrations"
      SET "rolled_back_at" = NOW()
      WHERE "migration_name" = '20260623000002_add_categories_courier_delivery'
      AND "finished_at" IS NULL
    `);

    return { ok: true };
  }
}