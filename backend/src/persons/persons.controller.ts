import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Allow, IsOptional, IsString } from 'class-validator';
import { Roles } from '../common/decorators/roles.decorator';
import { PersonsService } from './persons.service';

class CreatePersonDto {
  @ApiProperty() @IsString() operationId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() engagementId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() photo?: string;
  @ApiPropertyOptional() @IsOptional() @Allow() data?: any;
}

class UpdatePersonDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() photo?: string | null;
  @ApiPropertyOptional() @IsOptional() @Allow() data?: any;
}

@ApiTags('persons')
@ApiBearerAuth()
@Controller('persons')
export class PersonsController {
  constructor(private readonly persons: PersonsService) {}

  @Get()
  list(@Query('operationId') operationId: string, @Query('engagementId') engagementId?: string) {
    return this.persons.list(operationId, engagementId);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.persons.get(id);
  }

  @Roles(Role.admin, Role.analyst)
  @Post()
  create(@Body() dto: CreatePersonDto) {
    return this.persons.create(dto);
  }

  @Roles(Role.admin, Role.analyst)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePersonDto) {
    return this.persons.update(id, dto);
  }

  @Roles(Role.admin, Role.analyst)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.persons.remove(id);
  }
}
