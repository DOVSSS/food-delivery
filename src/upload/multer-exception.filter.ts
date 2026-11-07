import {
  Catch,
  ExceptionFilter,
  ArgumentsHost,
  HttpException,
} from '@nestjs/common';
import { MulterError } from 'multer';
import { Response } from 'express';

@Catch(MulterError, HttpException)
export class MulterExceptionFilter implements ExceptionFilter {
  catch(exception: MulterError | HttpException, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof MulterError) {
      const message =
        exception.code === 'LIMIT_FILE_SIZE'
          ? 'Фото слишком большое. Выберите снимок меньше 8 МБ.'
          : 'Не удалось загрузить фото. Попробуйте другое изображение.';
      response.status(400).json({ statusCode: 400, message });
      return;
    }

    const status = exception.getStatus();
    const body = exception.getResponse();
    const message =
      typeof body === 'string'
        ? body
        : Array.isArray((body as { message?: unknown }).message)
          ? String((body as { message: string[] }).message[0])
          : String(
              (body as { message?: string }).message ||
                'Не удалось загрузить фото',
            );

    response.status(status).json({ statusCode: status, message });
  }
}
