import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RevenueController } from './revenue.controller';
import { RevenueService } from './revenue.service';

@Module({
  controllers: [RevenueController],
  providers: [RevenueService, PrismaService, RolesGuard],
})
export class RevenueModule {}
