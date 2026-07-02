import { ApiPropertyOptional } from '@nestjs/swagger';
import { EventType, IOCThreatLevel } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class QueryTimelineDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  operationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  engagementId?: string;

  @ApiPropertyOptional({ enum: EventType })
  @IsOptional()
  @IsEnum(EventType)
  type?: EventType;

  @ApiPropertyOptional({ enum: IOCThreatLevel })
  @IsOptional()
  @IsEnum(IOCThreatLevel)
  severity?: IOCThreatLevel;
}
