import { Injectable } from '@nestjs/common';
import { EventType, IOCThreatLevel, Prisma, TimelineEvent } from '@prisma/client';
import { Observable, Subject, filter as rxFilter } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { QueryTimelineDto } from './dto/query-timeline.dto';

/** Evento estruturado emitido por uma engine no Investigation Event Bus. */
export interface EmitEvent {
  type: EventType;
  title: string;
  description?: string;
  operationId: string;
  engagementId?: string;
  severity?: IOCThreatLevel;
  engine?: string;
  category?: string;
  icon?: string;
  details?: unknown;
}

@Injectable()
export class TimelineService {
  /** Bus em memória (single-process) — as engines publicam, o SSE consome. */
  private readonly bus = new Subject<TimelineEvent>();

  constructor(private readonly prisma: PrismaService) {}

  /** Persiste o evento e publica no bus (timeline em tempo real). */
  async emit(e: EmitEvent): Promise<TimelineEvent> {
    const row = await this.prisma.timelineEvent.create({
      data: {
        type: e.type,
        title: e.title,
        description: e.description ?? '',
        operationId: e.operationId,
        engagementId: e.engagementId,
        severity: e.severity,
        engine: e.engine,
        category: e.category,
        icon: e.icon,
        details: (e.details ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
    this.bus.next(row);
    return row;
  }

  /** Stream ao vivo, filtrado por engajamento ou operação. */
  stream(scope: { engagementId?: string; operationId?: string }): Observable<TimelineEvent> {
    return this.bus.asObservable().pipe(
      rxFilter((ev) => {
        if (scope.engagementId) return ev.engagementId === scope.engagementId;
        if (scope.operationId) return ev.operationId === scope.operationId;
        return true;
      }),
    );
  }

  findAll(query: QueryTimelineDto): Promise<TimelineEvent[]> {
    const where: Prisma.TimelineEventWhereInput = {};
    if (query.operationId) where.operationId = query.operationId;
    if (query.engagementId) where.engagementId = query.engagementId;
    if (query.type) where.type = query.type as EventType;
    if (query.severity) where.severity = query.severity as IOCThreatLevel;
    return this.prisma.timelineEvent.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: query.engagementId || query.operationId ? 200 : 100,
    });
  }

  findByOperation(operationId: string): Promise<TimelineEvent[]> {
    return this.prisma.timelineEvent.findMany({
      where: { operationId },
      orderBy: { timestamp: 'desc' },
    });
  }

  create(dto: CreateEventDto): Promise<TimelineEvent> {
    return this.emit(dto);
  }
}
