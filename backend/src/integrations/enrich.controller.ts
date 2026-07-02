import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CveDto, DomainDto, IpDto } from './dto';
import { EnrichmentService } from './enrichment.service';
import { ThreatIntelService } from './threatintel.service';

@ApiTags('enrich')
@ApiBearerAuth()
@Roles(Role.admin, Role.analyst)
@Controller('enrich')
export class EnrichController {
  constructor(
    private readonly intel: ThreatIntelService,
    private readonly enrich: EnrichmentService,
  ) {}

  /** Threat intel agregado de um IP (AbuseIPDB+VT+OTX+ThreatFox+Censys). */
  @Post('ip')
  enrichIp(@Body() dto: IpDto) {
    return this.intel.enrichIp(dto.ip.trim());
  }

  /** Threat intel agregado de um domínio (VT+OTX+ThreatFox). */
  @Post('domain')
  enrichDomain(@Body() dto: DomainDto) {
    return this.intel.enrichDomain(dto.domain.trim().toLowerCase());
  }

  /** Detalhes de uma CVE (CIRCL + NVD). */
  @Post('cve')
  async cve(@Body() dto: CveDto) {
    return (await this.enrich.cveLookup(dto.cve)) ?? { found: false };
  }

  /** ASN / geolocalização de um IP (BGPView + ipinfo). */
  @Post('asn')
  async asn(@Body() dto: IpDto) {
    return (await this.enrich.ipAsn(dto.ip.trim())) ?? { found: false };
  }

  /** WHOIS/RDAP + registros DNS de um domínio. */
  @Post('whois')
  whois(@Body() dto: DomainDto) {
    return this.enrich.domainIntel(dto.domain);
  }

  /** Atribuição de domínio: WHOIS → resolução de IP → hosting (ipinfo). */
  @Post('attribution')
  attribution(@Body() dto: DomainDto) {
    return this.enrich.domainAttribution(dto.domain);
  }

  /** Subdomínios passivos (crt.sh + CertSpotter + Anubis). */
  @Post('subdomains')
  subdomains(@Body() dto: DomainDto) {
    return this.enrich.passiveSubdomains(dto.domain);
  }

  /** URLs arquivadas no Wayback Machine. */
  @Post('wayback')
  async wayback(@Body() dto: DomainDto) {
    return { urls: await this.enrich.waybackUrls(dto.domain) };
  }
}
