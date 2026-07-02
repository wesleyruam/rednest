import { Controller, Get, MessageEvent, Query, Sse } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Observable } from 'rxjs';
import { Roles } from '../common/decorators/roles.decorator';
import { ContentDiscoveryService } from './content-discovery.service';

function csvNums(s?: string): number[] | undefined {
  if (!s) return undefined;
  const n = s.split(',').map((x) => parseInt(x.trim(), 10)).filter((x) => !isNaN(x));
  return n.length ? n : undefined;
}
function csvStr(s?: string): string[] | undefined {
  if (!s) return undefined;
  const a = s.split(',').map((x) => x.trim()).filter(Boolean);
  return a.length ? a : undefined;
}

@ApiTags('content-discovery')
@ApiBearerAuth()
@Roles(Role.admin, Role.analyst)
@Controller('content-discovery')
export class ContentDiscoveryController {
  constructor(private readonly cd: ContentDiscoveryService) {}

  @Get('wordlists')
  wordlists() {
    return { wordlists: this.cd.listWordlists() };
  }

  /** Stream SSE: `progress` (tested/total/found) e `done` (resultado). */
  @Sse('stream')
  stream(
    @Query('target') target: string,
    @Query('wordlist') wordlist?: string,
    @Query('extensions') extensions?: string,
    @Query('status') status?: string,
    @Query('exclude') exclude?: string,
  ): Observable<MessageEvent> {
    return new Observable<MessageEvent>((sub) => {
      let cancelled = false;
      const emit = (data: unknown) => {
        if (!cancelled) sub.next({ data } as MessageEvent);
      };
      void (async () => {
        try {
          const result = await this.cd.scan(target, {
            wordlist,
            extensions: csvStr(extensions),
            statusInclude: csvNums(status),
            statusExclude: csvNums(exclude),
            onProgress: (p) => emit({ type: 'progress', ...p }),
          });
          emit({ type: 'done', result });
          sub.complete();
        } catch (e) {
          emit({ type: 'error', error: String((e as Error)?.message ?? e) });
          sub.complete();
        }
      })();
      return () => {
        cancelled = true;
      };
    });
  }
}
