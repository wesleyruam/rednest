import { ApiPropertyOptional } from '@nestjs/swagger';
import { OperationPriority, OperationStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class QueryOperationDto {
  @ApiPropertyOptional({ enum: OperationStatus })
  @IsOptional()
  @IsEnum(OperationStatus)
  status?: OperationStatus;

  @ApiPropertyOptional({ enum: OperationPriority })
  @IsOptional()
  @IsEnum(OperationPriority)
  priority?: OperationPriority;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}
