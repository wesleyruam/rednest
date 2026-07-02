import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EventType, IOCThreatLevel } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateEventDto {
  @ApiProperty({ enum: EventType })
  @IsEnum(EventType)
  type: EventType;

  @ApiProperty()
  @IsString()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsString()
  operationId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  engagementId?: string;

  @ApiPropertyOptional({ enum: IOCThreatLevel })
  @IsOptional()
  @IsEnum(IOCThreatLevel)
  severity?: IOCThreatLevel;
}
