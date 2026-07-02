import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { NotePriority, NoteStatus, Role } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { NotesService } from './notes.service';

class CreateNoteDto {
  @ApiProperty() @IsString() operationId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() engagementId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() body?: string;
  @ApiPropertyOptional({ enum: NotePriority }) @IsOptional() @IsEnum(NotePriority) priority?: NotePriority;
  @ApiPropertyOptional({ enum: NoteStatus }) @IsOptional() @IsEnum(NoteStatus) status?: NoteStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() dueAt?: string;
}

class UpdateNoteDto {
  @ApiPropertyOptional() @IsOptional() @IsString() title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() body?: string;
  @ApiPropertyOptional({ enum: NotePriority }) @IsOptional() @IsEnum(NotePriority) priority?: NotePriority;
  @ApiPropertyOptional({ enum: NoteStatus }) @IsOptional() @IsEnum(NoteStatus) status?: NoteStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() dueAt?: string | null;
}

@ApiTags('notes')
@ApiBearerAuth()
@Controller('notes')
export class NotesController {
  constructor(private readonly notes: NotesService) {}

  @Get()
  list(@Query('operationId') operationId: string, @Query('engagementId') engagementId?: string) {
    return this.notes.list(operationId, engagementId);
  }

  @Roles(Role.admin, Role.analyst)
  @Post()
  create(@Body() dto: CreateNoteDto, @CurrentUser() user: AuthUser) {
    return this.notes.create(dto, user.id);
  }

  @Roles(Role.admin, Role.analyst)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateNoteDto) {
    return this.notes.update(id, dto);
  }

  @Roles(Role.admin, Role.analyst)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.notes.remove(id);
  }
}
