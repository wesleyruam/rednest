import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { ServiceScanDto } from './dto';
import { ServiceScanService } from './service-scan.service';

@ApiTags('service-scan')
@ApiBearerAuth()
@Roles(Role.admin, Role.analyst)
@Controller('service-scan')
export class ServiceScanController {
  constructor(private readonly scan: ServiceScanService) {}

  @Post()
  run(@Body() dto: ServiceScanDto) {
    return this.scan.scan(dto.host, { ports: dto.ports });
  }
}
