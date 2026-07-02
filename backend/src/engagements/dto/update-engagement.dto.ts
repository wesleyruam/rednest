import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { EngagementStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { CreateEngagementDto } from './create-engagement.dto';

export class UpdateEngagementDto extends PartialType(
  OmitType(CreateEngagementDto, ['operationId'] as const),
) {
  @ApiPropertyOptional({ enum: EngagementStatus })
  @IsOptional()
  @IsEnum(EngagementStatus)
  status?: EngagementStatus;
}
