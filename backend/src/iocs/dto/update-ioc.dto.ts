import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateIocDto } from './create-ioc.dto';

export class UpdateIocDto extends PartialType(
  OmitType(CreateIocDto, ['operationId'] as const),
) {}
