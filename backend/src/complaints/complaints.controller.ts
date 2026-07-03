import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { ComplaintStatus, OperationPriority, Role } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ComplaintsService } from './complaints.service';

class CreateComplaintDto {
  @ApiProperty() @IsString() operationId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() engagementId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() title?: string;
  @ApiProperty() @IsString() target: string;
  @ApiProperty() @IsString() platform: string;
  @ApiPropertyOptional() @IsOptional() @IsString() ticketId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() ticketUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() category?: string;
  @ApiPropertyOptional({ enum: ComplaintStatus }) @IsOptional() @IsEnum(ComplaintStatus) status?: ComplaintStatus;
  @ApiPropertyOptional({ enum: OperationPriority }) @IsOptional() @IsEnum(OperationPriority) priority?: OperationPriority;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() result?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() submittedAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() resolvedAt?: string;
}

class UpdateComplaintDto {
  @ApiPropertyOptional() @IsOptional() @IsString() title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() target?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() platform?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() ticketId?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() ticketUrl?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() category?: string | null;
  @ApiPropertyOptional({ enum: ComplaintStatus }) @IsOptional() @IsEnum(ComplaintStatus) status?: ComplaintStatus;
  @ApiPropertyOptional({ enum: OperationPriority }) @IsOptional() @IsEnum(OperationPriority) priority?: OperationPriority;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() result?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() submittedAt?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() resolvedAt?: string | null;
}

class NoteDto { @ApiProperty() @IsString() text: string; }
class AttachmentDto { @ApiProperty() @IsString() name: string; @ApiPropertyOptional() @IsOptional() @IsString() url?: string; }
class EventDto { @ApiProperty() @IsString() title: string; @ApiPropertyOptional() @IsOptional() @IsString() description?: string; }

@ApiTags('complaints')
@ApiBearerAuth()
@Controller('complaints')
export class ComplaintsController {
  constructor(private readonly complaints: ComplaintsService) {}

  @Get()
  list(@Query('operationId') operationId: string) {
    return this.complaints.list(operationId);
  }

  @Get('stats')
  stats(@Query('operationId') operationId: string) {
    return this.complaints.stats(operationId);
  }

  @Roles(Role.admin, Role.analyst)
  @Post()
  create(@Body() dto: CreateComplaintDto, @CurrentUser() user: AuthUser) {
    return this.complaints.create(dto, user.username);
  }

  @Roles(Role.admin, Role.analyst)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateComplaintDto, @CurrentUser() user: AuthUser) {
    return this.complaints.update(id, dto, user.username);
  }

  @Roles(Role.admin, Role.analyst)
  @Post(':id/notes')
  addNote(@Param('id') id: string, @Body() dto: NoteDto, @CurrentUser() user: AuthUser) {
    return this.complaints.addNote(id, dto.text, user.username);
  }

  @Roles(Role.admin, Role.analyst)
  @Post(':id/attachments')
  addAttachment(@Param('id') id: string, @Body() dto: AttachmentDto, @CurrentUser() user: AuthUser) {
    return this.complaints.addAttachment(id, dto.name, dto.url, user.username);
  }

  @Roles(Role.admin, Role.analyst)
  @Post(':id/events')
  addEvent(@Param('id') id: string, @Body() dto: EventDto, @CurrentUser() user: AuthUser) {
    return this.complaints.addEvent(id, dto.title, dto.description, user.username);
  }

  @Roles(Role.admin, Role.analyst)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.complaints.remove(id);
  }
}
