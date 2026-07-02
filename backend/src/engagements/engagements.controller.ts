import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  MessageEvent,
  Param,
  Patch,
  Post,
  Query,
  Sse,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Observable } from 'rxjs';
import { AuditService } from '../audit/audit.service';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateEngagementDto } from './dto/create-engagement.dto';
import { QueryEngagementDto } from './dto/query-engagement.dto';
import { UpdateEngagementDto } from './dto/update-engagement.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { EngagementsService } from './engagements.service';
import { PipelineService } from './pipeline.service';

@ApiTags('engagements')
@ApiBearerAuth()
@Controller('engagements')
export class EngagementsController {
  constructor(
    private readonly engagements: EngagementsService,
    private readonly pipeline: PipelineService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  findAll(@Query() query: QueryEngagementDto) {
    return this.engagements.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.engagements.findOne(id);
  }

  @Roles(Role.admin, Role.analyst)
  @Post()
  async create(@Body() dto: CreateEngagementDto, @CurrentUser() user: AuthUser) {
    const eng = await this.engagements.create(dto);
    await this.audit.log({
      userId: user.id,
      action: 'engagement.create',
      entityType: 'engagement',
      entityId: eng.id as string,
      newValue: { name: eng.name, type: eng.type },
    });
    return eng;
  }

  @Roles(Role.admin, Role.analyst)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateEngagementDto) {
    return this.engagements.update(id, dto);
  }

  @Roles(Role.admin, Role.analyst)
  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto) {
    return this.engagements.updateStatus(id, dto.status);
  }

  @Roles(Role.admin, Role.analyst)
  @Post(':id/enrich')
  async enrich(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const eng = await this.engagements.enrich(id);
    await this.audit.log({
      userId: user.id,
      action: 'engagement.enrich',
      entityType: 'engagement',
      entityId: id,
    });
    return eng;
  }

  @Roles(Role.admin, Role.analyst)
  @Sse(':id/enrich/stream')
  enrichStream(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Observable<MessageEvent> {
    void this.audit
      .log({
        userId: user.id,
        action: 'engagement.enrich',
        entityType: 'engagement',
        entityId: id,
      })
      .catch(() => undefined);
    return this.engagements.enrichStream(id);
  }

  /** Recon Pipeline: subdomínios → http → service scan → screenshot → vuln correlation. */
  @Roles(Role.admin, Role.analyst)
  @Sse(':id/pipeline/stream')
  pipelineStream(@Param('id') id: string): Observable<MessageEvent> {
    return this.pipeline.stream(id);
  }

  @Roles(Role.admin, Role.analyst)
  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.engagements.remove(id, user.id);
    await this.audit.log({
      userId: user.id,
      action: 'engagement.delete',
      entityType: 'engagement',
      entityId: id,
    });
  }
}
