import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class CreateCategoryDto {
  @IsString({ message: 'Название должно быть текстом' })
  @IsNotEmpty({ message: 'Укажите название категории' })
  @MaxLength(80, { message: 'Название категории слишком длинное' })
  name: string;

  @IsOptional()
  @IsString({ message: 'Эмодзи должно быть текстом' })
  @MaxLength(32, { message: 'Эмодзи слишком длинное' })
  emoji?: string;
}
