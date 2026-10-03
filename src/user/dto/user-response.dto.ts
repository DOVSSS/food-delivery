// src/user/dto/user-response.dto.ts
import { Exclude, Expose } from 'class-transformer';

export class UserResponseDto {
  id: string;
  email: string;
  name: string;
  avatarPath: string;
  phone: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;

  @Exclude()
  password: string;

  constructor(partial: Partial<UserResponseDto>) {
    Object.assign(this, partial);
  }
}