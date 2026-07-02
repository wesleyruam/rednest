import { Controller, MessageEvent, Query, Sse } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Observable } from 'rxjs';
import { Roles } from '../common/decorators/roles.decorator';
import { WpscanService } from './wpscan.service';

@ApiTags('wpscan')
@ApiBearerAuth()
@Roles(Role.admin, Role.analyst)
@Controller('wpscan')
export class WpscanController {
  constructor(private readonly wpscan: WpscanService) {}

  /** Stream SSE: `phase` (progresso por etapa), `partial` (achados parciais) e `done`. */
  @Sse('stream')
  stream(@Query('target') target: string, @Query('aggressive') aggressive?: string, @Query('proxy') proxy?: string): Observable<MessageEvent> {
    return new Observable<MessageEvent>((sub) => {
      const signal = { cancelled: false };
      const emit = (data: unknown) => {
        if (!signal.cancelled) sub.next({ data } as MessageEvent);
      };
      void (async () => {
        try {
          const result = await this.wpscan.scan(target, {
            aggressive: aggressive !== 'false',
            proxy: proxy === 'true',
            onProgress: (p) => emit({ type: 'phase', ...p }),
            onPartial: (patch) => emit({ type: 'partial', patch }),
            signal,
          });
          emit({ type: 'done', result });
          sub.complete();
        } catch (e) {
          emit({ type: 'error', error: String((e as Error)?.message ?? e) });
          sub.complete();
        }
      })();
      return () => {
        signal.cancelled = true;
      };
    });
  }
}
