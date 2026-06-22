import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { RestaurantModule } from './restaurant/restaurant.module';
import { ProductModule } from './product/product.module';
import { UserModule } from './user/user.module';
import { PrismaService } from './prisma.service';
import { OrderModule } from './order/order.module';
import { UploadModule } from './upload/upload.module';  // ← добавить

@Module({
  imports: [
    ConfigModule.forRoot(),
    AuthModule,
    RestaurantModule,
    ProductModule,
    UserModule,
    OrderModule,
    UploadModule,  // ← добавить
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}