import { ApiProperty } from '@nestjs/swagger';
import { EngagementStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateStatusDto {
  @ApiProperty({ enum: EngagementStatus })
  @IsEnum(EngagementStatus)
  status: EngagementStatus;
}
