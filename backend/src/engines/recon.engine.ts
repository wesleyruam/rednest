import { Injectable } from '@nestjs/common';
import { ContentDiscoveryService, ContentDiscoveryOptions } from '../integrations/content-discovery.service';
import { EnrichmentService } from '../integrations/enrichment.service';
import { ServiceScanService } from '../integrations/service-scan.service';

/**
 * Recon Engine — descoberta de ativos: DNS/WHOIS, subdomínios, ASN/roteamento,
 * fingerprint de serviços (Service Scan), content discovery. Interface estável.
 */
@Injectable()
export class ReconEngine {
  constructor(
    private readonly enrichment: EnrichmentService,
    private readonly serviceScanSvc: ServiceScanService,
    private readonly contentDiscoverySvc: ContentDiscoveryService,
  ) {}

  contentDiscovery(target: string, opts?: ContentDiscoveryOptions) {
    return this.contentDiscoverySvc.scan(target, opts);
  }

  dns(domain: string) {
    return this.enrichment.domainIntel(domain);
  }
  subdomains(domain: string) {
    return this.enrichment.passiveSubdomains(domain);
  }
  asn(ip: string) {
    return this.enrichment.ipAsn(ip);
  }
  serviceScan(host: string, opts?: { ports?: number[] }) {
    return this.serviceScanSvc.scan(host, opts);
  }
}
