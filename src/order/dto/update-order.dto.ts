// src/order/dto/update-order.dto.ts
import { IsOptional, IsString, IsIn } from 'class-validator';

export class UpdateOrderDto {
  @IsOptional()
  @IsString()
  @IsIn(['PENDING', 'ACCEPTED', 'READY', 'DELIVERING', 'DELIVERED', 'CANCELLED'])
  status?: string;

  @IsOptional()
  @IsString()
  deliveryAddress?: string;

  @IsOptional()
  @IsString()
  comment?: string;
}