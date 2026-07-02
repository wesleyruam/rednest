import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { EngagementsService } from '../engagements/engagements.service';
import { TimelineService } from '../timeline/timeline.service';
import { CreateOperationDto } from './dto/create-operation.dto';
import { QueryOperationDto } from './dto/query-operation.dto';
import { UpdateOperationDto } from './dto/update-operation.dto';
import { OperationsService } from './operations.service';

@ApiTags('operations')
@ApiBearerAuth()
@Controller('operations')
export class OperationsController {
  constructor(
    private readonly operations: OperationsService,
    private readonly engagements: EngagementsService,
    private readonly timeline: TimelineService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  findAll(@Query() query: QueryOperationDto) {
    return this.operations.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.operations.findOne(id);
  }

  @Get(':id/engagements')
  findEngagements(@Param('id') id: string) {
    return this.engagements.findByOperation(id);
  }

  @Get(':id/timeline')
  findTimeline(@Param('id') id: string) {
    return this.timeline.findByOperation(id);
  }

  @Roles(Role.admin, Role.analyst)
  @Post()
  async create(@Body() dto: CreateOperationDto, @CurrentUser() user: AuthUser) {
    const op = await this.operations.create(dto);
    await this.audit.log({
      userId: user.id,
      action: 'operation.create',
      entityType: 'operation',
      entityId: op.id,
      newValue: { name: op.name },
    });
    return op;
  }

  @Roles(Role.admin, Role.analyst)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateOperationDto,
    @CurrentUser() user: AuthUser,
  ) {
    const op = await this.operations.update(id, dto);
    await this.audit.log({
      userId: user.id,
      action: 'operation.update',
      entityType: 'operation',
      entityId: id,
      newValue: dto as Record<string, unknown>,
    });
    return op;
  }

  @Roles(Role.admin, Role.analyst)
  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.operations.remove(id, user.id);
    await this.audit.log({
      userId: user.id,
      action: 'operation.delete',
      entityType: 'operation',
      entityId: id,
    });
  }
}
