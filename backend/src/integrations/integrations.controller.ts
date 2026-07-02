import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { SetKeyDto } from './dto';
import { GodaddyService } from './godaddy.service';
import { MispService } from './misp.service';
import { OsintService } from './osint.service';
import { ProviderKeysService } from './provider-keys.service';
import { ThreatIntelService } from './threatintel.service';

@ApiTags('integrations')
@ApiBearerAuth()
@Controller('integrations')
export class IntegrationsController {
  constructor(
    private readonly keys: ProviderKeysService,
    private readonly intel: ThreatIntelService,
    private readonly osint: OsintService,
    private readonly godaddy: GodaddyService,
    private readonly misp: MispService,
    private readonly audit: AuditService,
  ) {}

  /** Estado de cada provedor (configurado? chave mascarada?). */
  @Get()
  async list() {
    return { services: await this.keys.status() };
  }

  /** Define/remove a chave de um provedor. */
  @Roles(Role.admin, Role.analyst)
  @Put(':service')
  async setKey(
    @Param('service') service: string,
    @Body() dto: SetKeyDto,
    @CurrentUser() user: AuthUser,
  ) {
    if (!this.keys.isKnown(service)) throw new NotFoundException('serviço desconhecido');
    await this.keys.setKey(service, dto.value);
    await this.audit.log({
      userId: user.id,
      action: dto.value ? 'integration.set_key' : 'integration.remove_key',
      entityType: 'provider_key',
      entityId: service,
    });
    return { ok: true, ...(await this.keys.statusOne(service)) };
  }

  /** Testa a chave contra um indicador/probe benigno. */
  @Roles(Role.admin, Role.analyst)
  @Post(':service/test')
  async test(@Param('service') service: string) {
    if (!this.keys.isKnown(service)) throw new NotFoundException('serviço desconhecido');
    if (!(await this.keys.getKey(service)))
      return { ok: false, error: 'chave não configurada' };

    // Provedores de threat intel (probe 8.8.8.8)
    if (['abuseipdb', 'virustotal', 'otx', 'threatfox', 'censys'].includes(service)) {
      return this.intel.testProvider(service);
    }
    // Demais provedores
    let result: Record<string, unknown>;
    if (service === 'hunter') result = await this.osint.hunterEmail('test@example.com');
    else if (service === 'gravatar') result = await this.osint.gravatar('test@example.com');
    else if (service === 'leaklookup') result = await this.osint.leaklookup('test@example.com');
    else if (service === 'godaddy') result = await this.godaddy.listTickets();
    else if (service === 'misp') result = await this.misp.test();
    else return { ok: false, error: 'serviço sem teste' };

    const ok = !('error' in result) && result.configured !== false;
    return { ok, result };
  }
}
