import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import sharp from 'sharp';

// По умолчанию libvips берёт потоки по числу ядер хоста и упирается в CPU-лимит контейнера
sharp.concurrency(1);
sharp.cache(false);

// Имена загруженных файлов уникальны (timestamp + random), содержимое по URL не меняется
const UPLOADS_STATIC_OPTIONS = {
  prefix: '/uploads',
  maxAge: '365d',
  immutable: true,
};

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  
  app.setGlobalPrefix('api');
  
  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Постоянное хранилище (новые файлы)
  app.useStaticAssets('/data/uploads', UPLOADS_STATIC_OPTIONS);

  // Fallback — файлы внутри контейнера (старые)
  app.useStaticAssets(join(__dirname, '..', 'uploads'), UPLOADS_STATIC_OPTIONS);

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
bootstrap();
