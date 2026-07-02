import { Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { ThreatFeedsService } from './threat-feeds.service';

@ApiTags('threat-feeds')
@ApiBearerAuth()
@Controller('threat-feeds')
export class ThreatFeedsController {
  constructor(private readonly feeds: ThreatFeedsService) {}

  @Get()
  list(
    @Query('type') type?: string,
    @Query('iocType') iocType?: string,
    @Query('source') source?: string,
    @Query('q') q?: string,
  ) {
    return this.feeds.query({ type, iocType, source, q });
  }

  @Get('stats')
  stats() {
    return this.feeds.stats();
  }

  @Roles(Role.admin, Role.analyst)
  @Post('sync')
  sync() {
    return this.feeds.syncAll();
  }
}
