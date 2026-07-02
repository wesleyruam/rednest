import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CheckHostService } from './checkhost.service';
import { CheckHostDto } from './dto';

@ApiTags('checkhost')
@ApiBearerAuth()
@Roles(Role.admin, Role.analyst)
@Controller('checkhost')
export class CheckHostController {
  constructor(private readonly checkhost: CheckHostService) {}

  /** Checagem distribuída (ping/http/tcp/dns) via check-host.net. */
  @Post()
  check(@Body() dto: CheckHostDto) {
    return this.checkhost.check(dto.target, dto.kind ?? 'ping', dto.maxNodes ?? 12);
  }
}
