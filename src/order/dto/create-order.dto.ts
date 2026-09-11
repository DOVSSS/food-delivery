// src/order/dto/create-order.dto.ts
import { IsArray, IsNotEmpty, IsOptional, IsString, Min, Max, ValidateNested, IsInt, IsPositive, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class OrderItemDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsInt()
  @IsPositive()
  @Min(1)
  quantity: number;
}

export class CreateOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @IsOptional()
  @IsString()
  deliveryAddress?: string;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  deliveryLat?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  deliveryLng?: number;
}