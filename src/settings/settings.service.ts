import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async get() {
    let settings = await this.prisma.settings.findUnique({
      where: { id: 'default' },
    });

    if (!settings) {
      settings = await this.prisma.settings.create({
        data: { id: 'default' },
      });
    }

    return settings;
  }

  async update(dto: UpdateSettingsDto) {
    return this.prisma.settings.upsert({
      where: { id: 'default' },
      create: { id: 'default', ...dto },
      update: dto,
    });
  }
}