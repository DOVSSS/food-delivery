import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsInt,
  Min,
  IsOptional,
  IsBoolean,
} from 'class-validator';

export class CreateProductDto {
  @IsString({ message: 'Название должно быть текстом' })
  @IsNotEmpty({ message: 'Укажите название блюда' })
  name: string;

  @IsOptional()
  @IsString({ message: 'Описание должно быть текстом' })
  description?: string;

  @Type(() => Number)
  @IsInt({ message: 'Цена должна быть целым числом' })
  @Min(1, { message: 'Цена должна быть больше 0' })
  price: number;

  @IsOptional()
  @IsString({ message: 'Некорректный путь к фото' })
  image?: string;

  @IsString({ message: 'Не указан ресторан' })
  @IsNotEmpty({ message: 'Не указан ресторан' })
  restaurantId: string;

  @IsOptional()
  @IsString({ message: 'Некорректная категория' })
  categoryId?: string;

  @IsOptional()
  @IsBoolean({ message: 'Некорректный статус наличия' })
  isAvailable?: boolean;
}
