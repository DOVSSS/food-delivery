// src/user/user.service.ts
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as argon2 from 'argon2';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    // Проверка на существующего пользователя
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: createUserDto.email },
          { name: createUserDto.name }
        ]
      }
    });

    if (existingUser) {
      throw new ConflictException('User with this email or name already exists');
    }

    // Хеширование пароля с помощью argon2
    const hashedPassword = await argon2.hash(createUserDto.password);

    return this.prisma.user.create({
      data: {
        email: createUserDto.email,
        password: hashedPassword,
        name: createUserDto.name,
        avatarPath: createUserDto.avatarPath || '/uploads/default-avatar.png',
        phone: createUserDto.phone || '',
      },
    });
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    // Проверяем существует ли пользователь
    await this.findById(id);

    // Если есть новый email или name, проверяем уникальность
    if (updateUserDto.email || updateUserDto.name) {
      const existingUser = await this.prisma.user.findFirst({
        where: {
          OR: [
            { email: updateUserDto.email },
            { name: updateUserDto.name }
          ],
          NOT: { id }
        }
      });

      if (existingUser) {
        throw new ConflictException('User with this email or name already exists');
      }
    }

    // Хешируем новый пароль если он есть
    let hashedPassword: string | undefined;
    if (updateUserDto.password) {
      hashedPassword = await argon2.hash(updateUserDto.password);
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        ...updateUserDto,
        password: hashedPassword,
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatarPath: true,
        phone: true,
        createdAt: true,
        updatedAt: true,
      }
    });
  }

  // Остальные методы остаются без изменений...
  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        avatarPath: true,
        phone: true,
        createdAt: true,
        updatedAt: true,
        orders: {
          select: {
            id: true,
            reference: true,
            status: true,
            total: true,
            createdAt: true,
          }
        }
      }
    });
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        orders: {
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  async findByEmail(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new NotFoundException(`User with email ${email} not found`);
    }

    return user;
  }

  async findByName(name: string) {
    const user = await this.prisma.user.findUnique({
      where: { name },
    });

    if (!user) {
      throw new NotFoundException(`User with name ${name} not found`);
    }

    return user;
  }

  async delete(id: string) {
    await this.findById(id);
    
    return this.prisma.user.delete({
      where: { id },
    });
  }

  async getUserOrders(userId: string) {
    await this.findById(userId);
    
    return this.prisma.order.findMany({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              select: {
                name: true,
                image: true,
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }
}