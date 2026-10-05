import {
  Controller,
  Get,
  Query,
  BadRequestException,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { MediaService } from './media.service';

@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Get('image')
  async getImage(
    @Query('path') path: string,
    @Query('w') widthParam: string,
    @Query('q') qualityParam: string | undefined,
    @Res() res: Response,
  ) {
    const width = Number.parseInt(widthParam, 10);
    if (!path || !Number.isFinite(width) || width < 64 || width > 2000) {
      throw new BadRequestException('Invalid path or width');
    }

    const qualityRaw = qualityParam ? Number.parseInt(qualityParam, 10) : 80;
    const quality = Number.isFinite(qualityRaw)
      ? Math.min(95, Math.max(50, qualityRaw))
      : 80;

    const { buffer, contentType } = await this.mediaService.getResizedImage(
      path,
      width,
      quality,
    );

    res.set({
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=604800, immutable',
    });
    res.send(buffer);
  }
}
