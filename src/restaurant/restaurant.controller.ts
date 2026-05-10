import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { RestaurantService } from './restaurant.service';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('restaurants')
export class RestaurantController {
  constructor(private readonly restaurantService: RestaurantService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() dto: CreateRestaurantDto, @Req() req: any) {
    return this.restaurantService.create({
      ...dto,
      ownerId: req.user.id,  // ← берём id из токена
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('my')  // ← новый эндпоинт — ВАЖНО: выше чем :id
  getMyRestaurant(@Req() req: any) {
    return this.restaurantService.findByOwner(req.user.id);
  }

  @Get()
  findAll() {
    return this.restaurantService.findAll();
  }

  @Get('slug/:slug')
  findBySlug(@Param('slug') slug: string) {
    return this.restaurantService.findBySlug(slug);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.restaurantService.findById(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateRestaurantDto) {
    return this.restaurantService.update(id, dto);
  }

  @HttpCode(200)
  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.restaurantService.delete(id);
  }
}