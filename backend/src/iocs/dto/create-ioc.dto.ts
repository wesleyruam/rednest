import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IOCThreatLevel, IOCType } from '@prisma/client';
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateIocDto {
  @ApiProperty()
  @IsString()
  value: string;

  @ApiProperty({ enum: IOCType })
  @IsEnum(IOCType)
  type: IOCType;

  @ApiProperty({ enum: IOCThreatLevel })
  @IsEnum(IOCThreatLevel)
  threatLevel: IOCThreatLevel;

  @ApiProperty()
  @IsString()
  operationId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  engagementId?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}
