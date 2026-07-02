import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { MonitorKind, Role } from '@prisma/client';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { AuditService } from '../audit/audit.service';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { MonitoringService } from './monitoring.service';

class CreateMonitorDto {
  @ApiProperty()
  @IsString()
  operationId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  engagementId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  iocId?: string;

  @ApiProperty({ enum: MonitorKind })
  @IsEnum(MonitorKind)
  kind: MonitorKind;

  @ApiProperty({ example: 'https://site.com  ou  1.2.3.4' })
  @IsString()
  target: string;

  @ApiPropertyOptional({ default: 60 })
  @IsOptional()
  @IsInt()
  @Min(5)
  intervalMinutes?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  useProxy?: boolean;
}

class UpdateMonitorDto {
  @ApiPropertyOptional({ minimum: 5 })
  @IsOptional()
  @IsInt()
  @Min(5)
  intervalMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  useProxy?: boolean;
}

@ApiTags('monitors')
@ApiBearerAuth()
@Controller('monitors')
export class MonitoringController {
  constructor(
    private readonly monitoring: MonitoringService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list(@Query('operationId') operationId?: string) {
    return this.monitoring.list(operationId);
  }

  /** Histórico de execuções (timeline) de um monitor. */
  @Get(':id/runs')
  runs(@Param('id') id: string) {
    return this.monitoring.listRuns(id);
  }

  @Roles(Role.admin, Role.analyst)
  @Post()
  async create(@Body() dto: CreateMonitorDto, @CurrentUser() user: AuthUser) {
    const m = await this.monitoring.create(dto);
    await this.audit.log({ userId: user.id, action: 'monitor.create', entityType: 'monitor', entityId: m.id });
    return m;
  }

  @Roles(Role.admin, Role.analyst)
  @Patch(':id/toggle')
  toggle(@Param('id') id: string) {
    return this.monitoring.toggle(id);
  }

  @Roles(Role.admin, Role.analyst)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMonitorDto) {
    return this.monitoring.update(id, dto);
  }

  /** Executa o monitor imediatamente (útil para testar). */
  @Roles(Role.admin, Role.analyst)
  @Post(':id/run')
  async run(@Param('id') id: string) {
    const m = await this.monitoring.get(id);
    return this.monitoring.runOne(m);
  }

  @Roles(Role.admin, Role.analyst)
  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.monitoring.remove(id);
    await this.audit.log({ userId: user.id, action: 'monitor.delete', entityType: 'monitor', entityId: id });
  }
}
