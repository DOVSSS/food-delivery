import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  UseFilters,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { unlink } from 'fs/promises';
import { extname, join } from 'path';
import sharp from 'sharp';
import { MulterExceptionFilter } from './multer-exception.filter';

const uploadDestination =
  process.env.NODE_ENV === 'production' ? '/data/uploads' : './uploads';

const IMAGE_MIME =
  /^(image\/(jpeg|jpg|pjpeg|png|x-png|webp|heic|heif|gif|bmp|tiff|tif)|application\/octet-stream)$/i;

function ensureUploadDir() {
  if (!existsSync(uploadDestination)) {
    mkdirSync(uploadDestination, { recursive: true });
  }
}

@Controller('upload')
@UseFilters(MulterExceptionFilter)
export class UploadController {
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          try {
            ensureUploadDir();
            cb(null, uploadDestination);
          } catch (error) {
            cb(error as Error, uploadDestination);
          }
        },
        filename: (_req, file, cb) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname || '').toLowerCase() || '.jpg';
          cb(null, uniqueSuffix + ext);
        },
      }),
      fileFilter: (_req, file, cb) => {
        const mime = (file.mimetype || '').toLowerCase();
        if (IMAGE_MIME.test(mime)) {
          cb(null, true);
          return;
        }
        cb(
          new BadRequestException(
            'Можно загружать только изображения (JPEG, PNG, WebP, HEIC)',
          ),
          false,
        );
      },
      limits: {
        fileSize: 8 * 1024 * 1024,
      },
    }),
  )
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Файл не загружен');
    }

    ensureUploadDir();

    const jpegName = `${Date.now()}-${Math.round(Math.random() * 1e9)}.jpg`;
    const jpegPath = join(uploadDestination, jpegName);

    try {
      await sharp(file.path)
        .rotate()
        .resize({
          width: 1600,
          height: 1600,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: 82, mozjpeg: true })
        .toFile(jpegPath);
      await unlink(file.path).catch(() => undefined);
      return { path: `/uploads/${jpegName}` };
    } catch {
      const mime = (file.mimetype || '').toLowerCase();
      const alreadySafe = /image\/(jpeg|jpg|pjpeg|png|x-png|webp)/.test(mime);
      if (alreadySafe) {
        return { path: `/uploads/${file.filename}` };
      }
      await unlink(file.path).catch(() => undefined);
      throw new BadRequestException(
        'Не удалось обработать изображение. Выберите фото в формате JPEG или PNG.',
      );
    }
  }
}
