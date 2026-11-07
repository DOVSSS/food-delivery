import {
  Catch,
  ExceptionFilter,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { MulterError } from 'multer';
import { Response } from 'express';
import { mapPrismaWriteError } from './utils/prisma-write-error';

function toClientMessage(raw: unknown, status: number): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const message = typeof value === 'string' ? value.trim() : '';

  if (!message) {
    return status >= 500
      ? 'Внутренняя ошибка сервера. Попробуйте ещё раз.'
      : 'Не удалось выполнить запрос';
  }

  const lower = message.toLowerCase();
  if (lower === 'internal server error') {
    return 'Внутренняя ошибка сервера. Попробуйте ещё раз.';
  }
  if (lower === 'unauthorized') {
    return 'Сессия истекла. Войдите снова';
  }
  if (lower === 'forbidden') {
    return 'Недостаточно прав для этого действия';
  }

  return message;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    const prismaException = mapPrismaWriteError(exception);
    if (prismaException) {
      exception = prismaException;
    }

    if (exception instanceof MulterError) {
      const message =
        exception.code === 'LIMIT_FILE_SIZE'
          ? 'Фото слишком большое. Выберите снимок меньше 8 МБ.'
          : 'Не удалось загрузить фото. Попробуйте другое изображение.';
      response.status(400).json({ statusCode: 400, message });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const rawMessage =
        typeof body === 'string'
          ? body
          : (body as { message?: unknown }).message;
      response.status(status).json({
        statusCode: status,
        message: toClientMessage(rawMessage, status),
      });
      return;
    }

    console.error(exception);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Внутренняя ошибка сервера. Попробуйте ещё раз.',
    });
  }
}
