// src/order/order.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  UsePipes,
  ValidationPipe,
  ForbiddenException,
  Query,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorator/roles.decorator';
import { UpdateLocationDto } from './dto/update-location.dto';
import { Role } from '@prisma/client';

@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ transform: true }))
  @HttpCode(HttpStatus.CREATED)
  create(@Request() req, @Body() createOrderDto: CreateOrderDto) {
    return this.orderService.create(req.user.id, createOrderDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.COURIER)
  findAll(
    @Request() req,
    @Query('restaurantId') restaurantId?: string,
    @Query('status') status?: string,
  ) {
    return this.orderService.findAll(req.user, { restaurantId, status });
  }

  @Get('my-orders')
  @UseGuards(JwtAuthGuard)
  getMyOrders(@Request() req) {
    return this.orderService.findByUser(req.user.id);
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  getStats() {
    return this.orderService.getOrderStats();
  }

  @Get('restaurant/:restaurantId')
  @UseGuards(JwtAuthGuard)
  findByRestaurant(@Param('restaurantId') restaurantId: string, @Request() req) {
    return this.orderService.findByRestaurant(restaurantId, req.user);
  }

  @Get('reference/:reference')
  @UseGuards(JwtAuthGuard)
  findByReference(@Param('reference') reference: string) {
    return this.orderService.findByReference(reference);
  }

  @Get('user/:userId')
  @UseGuards(JwtAuthGuard)
  findByUser(@Param('userId') userId: string, @Request() req) {
    if (req.user.id !== userId && req.user.role !== Role.ADMIN) {
      throw new ForbiddenException('Access denied');
    }
    return this.orderService.findByUser(userId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findById(@Param('id') id: string) {
    return this.orderService.findById(id);
  }

  @Patch(':id/accept')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.COURIER)
  acceptOrder(@Param('id') id: string, @Request() req) {
    return this.orderService.acceptOrder(id, req.user.id);
  }

  @Patch(':id/location')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.COURIER)
  @UsePipes(new ValidationPipe({ transform: true }))
  updateLocation(@Param('id') id: string, @Request() req, @Body() dto: UpdateLocationDto) {
    return this.orderService.updateLocation(id, req.user.id, dto.lat, dto.lng);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ transform: true }))
  update(@Param('id') id: string, @Request() req, @Body() updateOrderDto: UpdateOrderDto) {
    return this.orderService.updateStatus(id, updateOrderDto, req.user);
  }

  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  cancel(@Param('id') id: string, @Request() req) {
    return this.orderService.cancelOrder(id, req.user);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param('id') id: string, @Request() req) {
    return this.orderService.deleteOrder(id, req.user);
  }
}
