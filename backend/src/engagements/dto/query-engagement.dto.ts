import { ApiPropertyOptional } from '@nestjs/swagger';
import { EngagementType } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class QueryEngagementDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  operationId?: string;

  @ApiPropertyOptional({ enum: EngagementType })
  @IsOptional()
  @IsEnum(EngagementType)
  type?: EngagementType;
}
