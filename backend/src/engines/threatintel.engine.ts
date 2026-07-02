import { Injectable } from '@nestjs/common';
import { ThreatIntelService } from '../integrations/threatintel.service';

/** Threat Intelligence Engine — reputação de IPs/domínios (AbuseIPDB, VT, OTX, ThreatFox…). */
@Injectable()
export class ThreatIntelEngine {
  constructor(private readonly threat: ThreatIntelService) {}

  ip(ip: string) {
    return this.threat.enrichIp(ip);
  }
  domain(domain: string) {
    return this.threat.enrichDomain(domain);
  }
}
