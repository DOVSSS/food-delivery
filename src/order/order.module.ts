// src/order/order.module.ts
import { Module } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { PrismaService } from '../prisma.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { SettingsModule } from '../settings/settings.module';
import { RolesGuard } from '../auth/guards/roles.guard';

@Module({
  imports: [NotificationsModule, SettingsModule],
  controllers: [OrderController],
  providers: [OrderService, PrismaService, RolesGuard],
  exports: [OrderService],
})
export class OrderModule {}
