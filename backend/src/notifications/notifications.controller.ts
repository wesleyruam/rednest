import { Body, Controller, Delete, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsString } from 'class-validator';
import { Roles } from '../common/decorators/roles.decorator';
import { TelegramService } from './telegram.service';

class TelegramConfigDto {
  @ApiProperty()
  @IsString()
  token: string;

  @ApiProperty()
  @IsString()
  chatId: string;
}

class SendDto {
  @ApiProperty()
  @IsString()
  text: string;
}

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications/telegram')
export class NotificationsController {
  constructor(private readonly telegram: TelegramService) {}

  @Get()
  status() {
    return this.telegram.status();
  }

  @Roles(Role.admin, Role.analyst)
  @Post()
  async setConfig(@Body() dto: TelegramConfigDto) {
    await this.telegram.setConfig(dto.token, dto.chatId);
    return this.telegram.send('✅ <b>RedNest</b> conectado ao Telegram.');
  }

  @Roles(Role.admin, Role.analyst)
  @Delete()
  async clear() {
    await this.telegram.clear();
    return { ok: true };
  }

  @Roles(Role.admin, Role.analyst)
  @Post('test')
  test() {
    return this.telegram.send('🔔 <b>RedNest</b> — mensagem de teste.');
  }

  @Roles(Role.admin, Role.analyst)
  @Post('send')
  send(@Body() dto: SendDto) {
    return this.telegram.send(dto.text);
  }
}
