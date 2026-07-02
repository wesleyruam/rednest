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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Response } from 'express';
import { createReadStream } from 'node:fs';
import { AuditService } from '../audit/audit.service';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { EvidenceService } from './evidence.service';
import { evidenceStorage } from './storage';

@ApiTags('evidence')
@ApiBearerAuth()
@Controller('evidence')
export class EvidenceController {
  constructor(
    private readonly evidence: EvidenceService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list(
    @Query('operationId') operationId?: string,
    @Query('engagementId') engagementId?: string,
  ) {
    return this.evidence.list({ operationId, engagementId });
  }

  @Roles(Role.admin, Role.analyst)
  @Post()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: evidenceStorage, limits: { fileSize: 50 * 1024 * 1024 } }))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { operationId?: string; engagementId?: string; name?: string; description?: string; tags?: string },
    @CurrentUser() user: AuthUser,
  ) {
    const ev = await this.evidence.create(file, {
      operationId: body.operationId,
      engagementId: body.engagementId,
      name: body.name,
      description: body.description,
      tags: body.tags ? body.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      userId: user.id,
    });
    await this.audit.log({
      userId: user.id,
      action: 'evidence.upload',
      entityType: 'evidence',
      entityId: ev.id,
      newValue: { name: ev.name, size: ev.size },
    });
    return ev;
  }

  @Get(':id/download')
  async download(@Param('id') id: string, @Res({ passthrough: true }) res: Response) {
    const ev = await this.evidence.get(id);
    res.set({
      'Content-Type': ev.mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(ev.originalName)}"`,
    });
    return new StreamableFile(createReadStream(ev.storedPath));
  }

  @Roles(Role.admin, Role.analyst)
  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.evidence.remove(id);
    await this.audit.log({ userId: user.id, action: 'evidence.delete', entityType: 'evidence', entityId: id });
  }
}
