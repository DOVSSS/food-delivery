import { IsString, IsNotEmpty, IsInt, Min, IsOptional, IsBoolean } from 'class-validator';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  @Min(0)
  price: number;

  @IsOptional()
  @IsString()
  image?: string;

  @IsString()
  @IsNotEmpty()
  restaurantId: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;
}