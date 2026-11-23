import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorator/roles.decorator';
import { RevenueService } from './revenue.service';

@Controller('revenue')
export class RevenueController {
  constructor(private readonly revenueService: RevenueService) {}

  @Get('my-owed')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.COURIER)
  myOwed(@Request() req) {
    return this.revenueService.getCourierOwed(req.user.id);
  }

  @Get('debts')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  debts() {
    return this.revenueService.getDebts();
  }

  @Post('settle/:courierId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  settle(@Param('courierId') courierId: string, @Request() req) {
    return this.revenueService.settle(courierId, req.user.id);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  list(@Query('from') from?: string, @Query('to') to?: string) {
    return this.revenueService.getRevenue(from, to);
  }
}
