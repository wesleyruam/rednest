import { Controller, Get, HttpCode, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AlertsService } from './alerts.service';
import { QueryAlertDto } from './dto/query-alert.dto';

@ApiTags('alerts')
@ApiBearerAuth()
@Controller('alerts')
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  @Get()
  findAll(@Query() query: QueryAlertDto) {
    return this.alerts.findAll(query);
  }

  @Patch('read-all')
  @HttpCode(200)
  markAllRead(@Query('operationId') operationId?: string) {
    return this.alerts.markAllRead(operationId);
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string) {
    return this.alerts.markRead(id);
  }
}
