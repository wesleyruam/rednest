import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Allow, IsOptional, IsString } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { Roles } from '../common/decorators/roles.decorator';
import { TimelineService } from '../timeline/timeline.service';
import { FindingsService } from './findings.service';

class IngestDto {
  @ApiProperty()
  @IsString()
  tool: string;

  @ApiProperty()
  @IsString()
  target: string;

  @ApiProperty()
  @Allow()
  result: any;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  label?: string;
}

class CreateFindingDto {
  @ApiProperty() @IsString() type: string;
  @ApiProperty() @IsString() value: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() label?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() url?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() target?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() severity?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() note?: string;
}

@ApiTags('findings')
@ApiBearerAuth()
@Controller('engagements/:id/findings')
export class FindingsController {
  constructor(
    private readonly findings: FindingsService,
    private readonly prisma: PrismaService,
    private readonly timeline: TimelineService,
  ) {}

  @Get()
  list(@Param('id') id: string, @Query('type') type?: string) {
    return this.findings.list(id, type);
  }

  @Get('counts')
  counts(@Param('id') id: string) {
    return this.findings.counts(id);
  }

  /** Recebe o resultado de uma ferramenta manual, extrai e persiste os achados. */
  @Roles(Role.admin, Role.analyst)
  @Post('ingest')
  async ingest(@Param('id') id: string, @Body() dto: IngestDto) {
    const eng = await this.prisma.engagement.findUnique({ where: { id }, select: { operationId: true, name: true } });
    if (!eng) return { saved: 0 };
    const items = this.findings.extractTool(dto.tool, dto.target, dto.result);
    const saved = await this.findings.save(id, eng.operationId, items);
    if (saved > 0) {
      await this.timeline
        .emit({
          operationId: eng.operationId,
          engagementId: id,
          type: 'asset_found',
          engine: 'manual',
          category: 'finding',
          icon: 'search',
          title: `${dto.tool}: ${saved} achado(s) salvo(s)`,
          description: dto.target,
        })
        .catch(() => undefined);
    }
    return { saved, total: items.length };
  }

  /** Adiciona um achado manualmente (ex.: uma rede social encontrada à mão). */
  @Roles(Role.admin, Role.analyst)
  @Post()
  async create(@Param('id') id: string, @Body() dto: CreateFindingDto) {
    const eng = await this.prisma.engagement.findUnique({ where: { id }, select: { operationId: true } });
    if (!eng) return null;
    const data = (dto.url || dto.note) ? { ...(dto.url ? { url: dto.url } : {}), ...(dto.note ? { note: dto.note } : {}) } : undefined;
    const f = await this.findings.addManual(id, eng.operationId, {
      type: dto.type, value: dto.value, label: dto.label, source: 'manual', target: dto.target, severity: dto.severity, data,
    });
    if (f) {
      await this.timeline.emit({
        operationId: eng.operationId, engagementId: id, type: 'asset_found',
        engine: 'manual', category: 'finding', icon: 'search',
        title: `Achado manual: ${dto.label ? dto.label + ' · ' : ''}${dto.value}`.slice(0, 140), description: dto.type,
      }).catch(() => undefined);
    }
    return f;
  }

  @Roles(Role.admin, Role.analyst)
  @Delete(':findingId')
  remove(@Param('id') id: string, @Param('findingId') findingId: string) {
    return this.findings.remove(id, findingId);
  }
}
