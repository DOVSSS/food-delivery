import { Injectable, NotFoundException } from '@nestjs/common';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, basename } from 'path';
import sharp from 'sharp';

const UPLOAD_PREFIX = '/uploads/';

@Injectable()
export class MediaService {
  private uploadRoots(): string[] {
    const roots = [
      process.env.NODE_ENV === 'production'
        ? '/data/uploads'
        : join(process.cwd(), 'uploads'),
      join(__dirname, '..', '..', 'uploads'),
    ];
    return [...new Set(roots)];
  }

  private resolveSourceFile(pathParam: string): string {
    if (!pathParam.startsWith(UPLOAD_PREFIX)) {
      throw new NotFoundException('Invalid image path');
    }
    const filename = pathParam.slice(UPLOAD_PREFIX.length);
    if (!filename || filename.includes('..') || filename.includes('\\')) {
      throw new NotFoundException('Invalid image path');
    }

    for (const root of this.uploadRoots()) {
      const full = join(root, filename);
      if (existsSync(full)) {
        return full;
      }
    }
    throw new NotFoundException('Image not found');
  }

  async getResizedImage(
    pathParam: string,
    width: number,
    quality: number,
  ): Promise<{ buffer: Buffer; contentType: string }> {
    const sourcePath = this.resolveSourceFile(pathParam);
    const sourceRoot = this.uploadRoots().find((root) =>
      sourcePath.startsWith(root),
    );
    if (!sourceRoot) {
      throw new NotFoundException('Image not found');
    }

    const filename = basename(sourcePath);
    const cacheDir = join(sourceRoot, '.cache', `w${width}`);
    const cachePath = join(cacheDir, filename);

    if (existsSync(cachePath)) {
      return {
        buffer: readFileSync(cachePath),
        contentType: 'image/jpeg',
      };
    }

    mkdirSync(cacheDir, { recursive: true });

    const buffer = await sharp(sourcePath)
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();

    writeFileSync(cachePath, buffer);

    return { buffer, contentType: 'image/jpeg' };
  }
}
