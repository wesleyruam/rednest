import { Body, Controller, Delete, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsString } from 'class-validator';
import { Roles } from '../common/decorators/roles.decorator';
import { EmailDto } from './dto';
import { GoogleIntelligenceService } from './google-intel.service';

class ConnectDto {
  @ApiProperty()
  @IsString()
  token: string;
}

@ApiTags('google-intel')
@ApiBearerAuth()
@Roles(Role.admin, Role.analyst)
@Controller('google-intel')
export class GoogleIntelController {
  constructor(private readonly gi: GoogleIntelligenceService) {}

  @Get('status')
  status() {
    return this.gi.status();
  }

  @Post('connect')
  connect(@Body() dto: ConnectDto) {
    return this.gi.connect(dto.token);
  }

  @Delete('connect')
  disconnect() {
    return this.gi.disconnect();
  }

  @Post('email')
  email(@Body() dto: EmailDto) {
    return this.gi.email(dto.email);
  }
}
