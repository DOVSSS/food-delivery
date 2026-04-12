import { IsEmail, IsString, MinLength } from "class-validator";

export class RefreshTokenDto {
    @IsString()
    refreshToken: string
 
  }