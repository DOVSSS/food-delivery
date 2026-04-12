import { IsEmail, IsString, MinLength } from "class-validator";

export class AuthDto {
  @IsEmail()
  email: string

  @MinLength(6,{
     message: 'пароль должен быть не менее 6 симвалов'
  })
 @IsString()
password: string
}