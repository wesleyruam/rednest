import { Controller, MessageEvent, Query, Sse } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Observable } from 'rxjs';
import { Roles } from '../common/decorators/roles.decorator';
import { CrawlerService } from './crawler.service';

@ApiTags('crawler')
@ApiBearerAuth()
@Roles(Role.admin, Role.analyst)
@Controller('crawler')
export class CrawlerController {
  constructor(private readonly crawler: CrawlerService) {}

  @Sse('stream')
  stream(
    @Query('target') target: string,
    @Query('depth') depth?: string,
    @Query('pages') pages?: string,
  ): Observable<MessageEvent> {
    return new Observable<MessageEvent>((sub) => {
      let cancelled = false;
      const emit = (data: unknown) => {
        if (!cancelled) sub.next({ data } as MessageEvent);
      };
      void (async () => {
        try {
          const result = await this.crawler.crawl(target, {
            maxDepth: depth ? parseInt(depth, 10) : undefined,
            maxPages: pages ? parseInt(pages, 10) : undefined,
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
