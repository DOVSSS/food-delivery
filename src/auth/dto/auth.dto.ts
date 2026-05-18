import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator'

export class AuthDto {
  @IsEmail()
  email: string

  @MinLength(6, { message: 'Пароль должен быть не менее 6 символов' })
  @IsString()
  password: string

  @IsString()
  @IsOptional()
  name?: string

  @IsString()
  @IsOptional()
  phone?: string

  @IsString()
  @IsOptional()
  address?: string
}