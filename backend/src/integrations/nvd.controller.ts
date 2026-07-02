import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { NvdService } from './nvd.service';

@ApiTags('nvd')
@ApiBearerAuth()
@Controller('nvd')
export class NvdController {
  constructor(private readonly nvd: NvdService) {}

  @Get('stats')
  stats() {
    return this.nvd.stats();
  }

  @Get('search')
  search(
    @Query('cve') cve?: string,
    @Query('q') q?: string,
    @Query('severity') severity?: string,
    @Query('minScore') minScore?: string,
  ) {
    return this.nvd.search({ cve, q, severity, minScore: minScore ? parseFloat(minScore) : undefined });
  }

  @Get(':cve')
  one(@Param('cve') cve: string) {
    return this.nvd.getOne(cve);
  }

  @Roles(Role.admin, Role.analyst)
  @Post('sync')
  sync(@Query('days') days?: string) {
    return this.nvd.sync(days ? parseInt(days, 10) : undefined);
  }
}
