import { Body, Controller, Get, MessageEvent, Post, Query, Sse } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Observable, map } from 'rxjs';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateEventDto } from './dto/create-event.dto';
import { QueryTimelineDto } from './dto/query-timeline.dto';
import { TimelineService } from './timeline.service';

@ApiTags('timeline')
@ApiBearerAuth()
@Controller('timeline')
export class TimelineController {
  constructor(private readonly timeline: TimelineService) {}

  @Get()
  findAll(@Query() query: QueryTimelineDto) {
    return this.timeline.findAll(query);
  }

  /** Timeline em tempo real (Investigation Event Bus) por engajamento ou operação. */
  @Sse('stream')
  stream(
    @Query('engagementId') engagementId?: string,
    @Query('operationId') operationId?: string,
  ): Observable<MessageEvent> {
    return this.timeline
      .stream({ engagementId, operationId })
      .pipe(map((event) => ({ data: event }) as MessageEvent));
  }

  @Roles(Role.admin, Role.analyst)
  @Post()
  create(@Body() dto: CreateEventDto, @CurrentUser() _user: AuthUser) {
    void _user;
    return this.timeline.create(dto);
  }
}
