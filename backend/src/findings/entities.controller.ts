import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FindingsService } from './findings.service';

/** Entidades unificadas (Alvos) da operação — agregadas das Findings. */
@ApiTags('entities')
@ApiBearerAuth()
@Controller('operations/:id/entities')
export class EntitiesController {
  constructor(private readonly findings: FindingsService) {}

  @Get()
  list(@Param('id') id: string, @Query('type') type?: string) {
    return this.findings.entities(id, type);
  }

  @Get('counts')
  counts(@Param('id') id: string) {
    return this.findings.entityCounts(id);
  }

  @Get('graph')
  graph(@Param('id') id: string) {
    return this.findings.graph(id);
  }

  @Get('threat-score')
  threatScore(@Param('id') id: string) {
    return this.findings.threatScore(id);
  }
}
