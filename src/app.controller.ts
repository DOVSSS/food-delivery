import { Controller, Get, Post, Headers, Param, ForbiddenException } from '@nestjs/common';
import { AppService } from './app.service';
import { PrismaService } from './prisma.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('make-admin/:email')
  async makeAdmin(@Param('email') email: string) {
    const user = await this.prisma.user.update({
      where: { email },
      data: { role: 'ADMIN' },
    });
    return { success: true, email: user.email, role: user.role };
  }

  
}