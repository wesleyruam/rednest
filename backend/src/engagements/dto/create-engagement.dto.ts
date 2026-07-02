import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EngagementType } from '@prisma/client';
import {
  IsArray,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateEngagementDto {
  @ApiProperty()
  @IsString()
  operationId: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  target: string;

  @ApiProperty({ enum: EngagementType })
  @IsEnum(EngagementType)
  type: EngagementType;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Rich per-type payload stored as JSONB' })
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}
