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
import { CreateIocDto } from './dto/create-ioc.dto';
import { QueryIocDto } from './dto/query-ioc.dto';
import { UpdateIocDto } from './dto/update-ioc.dto';
import { IocsService } from './iocs.service';

@ApiTags('iocs')
@ApiBearerAuth()
@Controller('iocs')
export class IocsController {
  constructor(
    private readonly iocs: IocsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  findAll(@Query() query: QueryIocDto) {
    return this.iocs.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.iocs.findOne(id);
  }

  @Get(':id/related')
  findRelated(@Param('id') id: string) {
    return this.iocs.findRelated(id);
  }

  @Roles(Role.admin, Role.analyst)
  @Post(':id/enrich')
  async enrich(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const ioc = await this.iocs.enrich(id);
    await this.audit.log({
      userId: user.id,
      action: 'ioc.enrich',
      entityType: 'ioc',
      entityId: id,
    });
    return ioc;
  }

  @Roles(Role.admin, Role.analyst)
  @Post()
  async create(@Body() dto: CreateIocDto, @CurrentUser() user: AuthUser) {
    const ioc = await this.iocs.create(dto);
    await this.audit.log({
      userId: user.id,
      action: 'ioc.create',
      entityType: 'ioc',
      entityId: ioc.id,
      newValue: { value: ioc.value, type: ioc.type },
    });
    return ioc;
  }

  @Roles(Role.admin, Role.analyst)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateIocDto) {
    return this.iocs.update(id, dto);
  }

  @Roles(Role.admin, Role.analyst)
  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.iocs.remove(id, user.id);
    await this.audit.log({
      userId: user.id,
      action: 'ioc.delete',
      entityType: 'ioc',
      entityId: id,
    });
  }
}
