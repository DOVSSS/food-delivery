// src/order/dto/order-response.dto.ts
import { Exclude, Expose } from 'class-transformer';

export class OrderItemResponseDto {
  id: string;
  productId: string;
  productName: string;
  productImage: string;
  quantity: number;
  price: number;
}

export class OrderResponseDto {
  id: string;
  reference: string;
  status: string;
  total: number;
  deliveryAddress?: string;
  deliveryTime?: Date;
  comment?: string;
  createdAt: Date;
  updatedAt: Date;
  items: OrderItemResponseDto[];
  
  @Exclude()
  userId?: string;
}