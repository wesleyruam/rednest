import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { Roles } from '../common/decorators/roles.decorator';
import { ScreenshotService } from './screenshot.service';

class ScreenshotDto {
  @ApiProperty({ example: 'example.com' })
  @IsString()
  target: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  fullPage?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  proxy?: boolean;
}

@ApiTags('screenshot')
@ApiBearerAuth()
@Roles(Role.admin, Role.analyst)
@Controller('screenshot')
export class ScreenshotController {
  constructor(private readonly screenshot: ScreenshotService) {}

  @Post()
  capture(@Body() dto: ScreenshotDto) {
    return this.screenshot.capture(dto.target, { fullPage: dto.fullPage, proxy: dto.proxy });
  }
}
