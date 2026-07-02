import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Response } from 'express';
import { createReadStream } from 'node:fs';
import { IsString } from 'class-validator';
import { AuditService } from '../audit/audit.service';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ReportsService } from './reports.service';

class GenerateReportDto {
  @IsString()
  operationId: string;
}

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list(@Query('operationId') operationId?: string) {
    return this.reports.list(operationId);
  }

  @Roles(Role.admin, Role.analyst)
  @Post()
  async generate(@Body() dto: GenerateReportDto, @CurrentUser() user: AuthUser) {
    const report = await this.reports.generate(dto.operationId, user.id);
    await this.audit.log({
      userId: user.id,
      action: 'report.generate',
      entityType: 'report',
      entityId: report.id,
      newValue: { name: report.name },
    });
    return report;
  }

  @Get(':id/download')
  async download(@Param('id') id: string, @Res({ passthrough: true }) res: Response) {
    const r = await this.reports.get(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(r.name)}.pdf"`,
    });
    return new StreamableFile(createReadStream(r.storedPath));
  }

  @Roles(Role.admin, Role.analyst)
  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.reports.remove(id);
    await this.audit.log({ userId: user.id, action: 'report.delete', entityType: 'report', entityId: id });
  }
}
