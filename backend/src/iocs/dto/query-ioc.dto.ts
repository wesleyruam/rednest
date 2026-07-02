import { ApiPropertyOptional } from '@nestjs/swagger';
import { IOCThreatLevel, IOCType } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class QueryIocDto {
  @ApiPropertyOptional({ enum: IOCType })
  @IsOptional()
  @IsEnum(IOCType)
  type?: IOCType;

  @ApiPropertyOptional({ enum: IOCThreatLevel })
  @IsOptional()
  @IsEnum(IOCThreatLevel)
  threatLevel?: IOCThreatLevel;

  @ApiPropertyOptional({ description: 'Operation id filter' })
  @IsOptional()
  @IsString()
  operation?: string;

  @ApiPropertyOptional({ description: 'Engagement id filter' })
  @IsOptional()
  @IsString()
  engagement?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}
