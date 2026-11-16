import { Injectable, NotFoundException } from '@nestjs/common';
import { access, mkdir, readFile, writeFile } from 'fs/promises';
import { join, basename } from 'path';
import sharp from 'sharp';

const UPLOAD_PREFIX = '/uploads/';

// Лимит Amvera 0.5 ядра: параллельные resize'ы вызывают троттлинг всего процесса
const MAX_PARALLEL_RESIZES = 1;

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

@Injectable()
export class MediaService {
  private activeResizes = 0;
  private resizeQueue: Array<() => void> = [];
  private inFlight = new Map<string, Promise<Buffer>>();

  private uploadRoots(): string[] {
    const roots = [
      process.env.NODE_ENV === 'production'
        ? '/data/uploads'
        : join(process.cwd(), 'uploads'),
      join(__dirname, '..', '..', 'uploads'),
    ];
    return [...new Set(roots)];
  }

  private async resolveSourceFile(pathParam: string): Promise<{ root: string; full: string }> {
    if (!pathParam.startsWith(UPLOAD_PREFIX)) {
      throw new NotFoundException('Invalid image path');
    }
    const filename = pathParam.slice(UPLOAD_PREFIX.length);
    if (!filename || filename.includes('..') || filename.includes('\\') || filename.includes('/')) {
      throw new NotFoundException('Invalid image path');
    }

    for (const root of this.uploadRoots()) {
      const full = join(root, filename);
      if (await fileExists(full)) {
        return { root, full };
      }
    }
    throw new NotFoundException('Image not found');
  }

  private async withResizeSlot<T>(task: () => Promise<T>): Promise<T> {
    if (this.activeResizes >= MAX_PARALLEL_RESIZES) {
      // Слот передаётся напрямую из finally, счётчик при этом не меняется
      await new Promise<void>((resolve) => this.resizeQueue.push(resolve));
    } else {
      this.activeResizes++;
    }
    try {
      return await task();
    } finally {
      const next = this.resizeQueue.shift();
      if (next) {
        next();
      } else {
        this.activeResizes--;
      }
    }
  }

  async getResizedImage(
    pathParam: string,
    width: number,
    quality: number,
  ): Promise<{ buffer: Buffer; contentType: string }> {
    const { root, full: sourcePath } = await this.resolveSourceFile(pathParam);

    const filename = basename(sourcePath);
    const cacheDir = join(root, '.cache', `w${width}`);
    const cachePath = join(cacheDir, filename);

    if (await fileExists(cachePath)) {
      return { buffer: await readFile(cachePath), contentType: 'image/jpeg' };
    }

    // Одинаковые запросы во время генерации ждут один и тот же результат
    let pending = this.inFlight.get(cachePath);
    if (!pending) {
      pending = this.withResizeSlot(async () => {
        const buffer = await sharp(sourcePath)
          .rotate()
          .resize({ width, withoutEnlargement: true })
          .jpeg({ quality, mozjpeg: true })
          .toBuffer();
        await mkdir(cacheDir, { recursive: true });
        await writeFile(cachePath, buffer);
        return buffer;
      }).finally(() => this.inFlight.delete(cachePath));
      this.inFlight.set(cachePath, pending);
    }

    return { buffer: await pending, contentType: 'image/jpeg' };
  }
}
