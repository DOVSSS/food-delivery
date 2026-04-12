import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { RestaurantModule } from './restaurant/restaurant.module';
import { ProductModule } from './product/product.module';
import { UserModule } from './user/user.module';


@Module({
  imports: [ConfigModule.forRoot(), AuthModule, RestaurantModule, ProductModule, UserModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
