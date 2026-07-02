import { Body, Controller, Get, MessageEvent, Post, Query, Sse } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Observable } from 'rxjs';
import { Roles } from '../common/decorators/roles.decorator';
import { CombDto, DomainDto, EmailDto, GodaddyAbuseDto, LeakLookupDto } from './dto';
import { GodaddyService } from './godaddy.service';
import { HoleheService } from './holehe.service';
import { OsintService } from './osint.service';
import { WhatsMyNameService } from './whatsmyname.service';

@ApiTags('osint')
@ApiBearerAuth()
@Roles(Role.admin, Role.analyst)
@Controller('osint')
export class OsintController {
  constructor(
    private readonly osint: OsintService,
    private readonly holehe: HoleheService,
    private readonly godaddy: GodaddyService,
    private readonly wmn: WhatsMyNameService,
  ) {}

  // ── WhatsMyName (username em ~700 sites) ──────────────────────────────────────
  @Get('whatsmyname/categories')
  wmnCategories() {
    return { total: this.wmn.size, categories: this.wmn.listCategories() };
  }

  /** Stream SSE: emite `progress` (checked/total/found) e `done` (resultado final). */
  @Sse('whatsmyname/stream')
  wmnStream(
    @Query('username') username: string,
    @Query('categories') categories?: string,
  ): Observable<MessageEvent> {
    const cats = categories ? categories.split(',').map((c) => c.trim()).filter(Boolean) : undefined;
    return new Observable<MessageEvent>((sub) => {
      let cancelled = false;
      const emit = (data: unknown) => {
        if (!cancelled) sub.next({ data } as MessageEvent);
      };
      void (async () => {
        try {
          const result = await this.wmn.check(username, {
            categories: cats,
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

  // ── Hunter.io ───────────────────────────────────────────────────────────────
  @Post('hunter/domain')
  hunterDomain(@Body() dto: DomainDto) {
    return this.osint.hunterDomain(dto.domain.trim().toLowerCase());
  }

  @Post('hunter/email')
  hunterEmail(@Body() dto: EmailDto) {
    return this.osint.hunterEmail(dto.email.trim());
  }

  // ── Gravatar / Holehe / Leak-Lookup / COMB ────────────────────────────────────
  @Post('gravatar')
  gravatar(@Body() dto: EmailDto) {
    return this.osint.gravatar(dto.email.trim());
  }

  @Post('holehe')
  holeheCheck(@Body() dto: EmailDto) {
    return this.holehe.check(dto.email);
  }

  @Post('leaklookup')
  leaklookup(@Body() dto: LeakLookupDto) {
    return this.osint.leaklookup(dto.query.trim(), dto.type ?? 'email_address');
  }

  @Post('comb')
  comb(@Body() dto: CombDto) {
    return this.osint.comb(dto.query.trim());
  }

  /** Agregado de inteligência por e-mail (Gravatar + Hunter + holehe + Leak-Lookup + COMB). */
  @Post('email')
  async email(@Body() dto: EmailDto) {
    const email = dto.email.trim();
    const [gravatar, hunter, holehe, leaklookup, comb] = await Promise.all([
      this.osint.gravatar(email),
      this.osint.hunterEmail(email),
      this.holehe.check(email),
      this.osint.leaklookup(email, 'email_address'),
      this.osint.comb(email),
    ]);
    return { email, gravatar, hunter, holehe, leaklookup, comb };
  }

  // ── GoDaddy abuse ─────────────────────────────────────────────────────────────
  @Get('godaddy/abuse')
  listAbuse() {
    return this.godaddy.listTickets();
  }

  @Post('godaddy/abuse')
  createAbuse(@Body() dto: GodaddyAbuseDto) {
    return this.godaddy.createTicket(dto);
  }
}
