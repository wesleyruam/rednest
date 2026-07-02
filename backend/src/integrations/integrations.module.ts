import { Module } from '@nestjs/common';
import { ProxyModule } from '../proxy/proxy.module';
import { CheckHostController } from './checkhost.controller';
import { CheckHostService } from './checkhost.service';
import { EnrichController } from './enrich.controller';
import { EnrichmentService } from './enrichment.service';
import { GodaddyService } from './godaddy.service';
import { HoleheService } from './holehe.service';
import { IntegrationsController } from './integrations.controller';
import { MispController } from './misp.controller';
import { MispService } from './misp.service';
import { OsintController } from './osint.controller';
import { OsintService } from './osint.service';
import { ContentDiscoveryController } from './content-discovery.controller';
import { ContentDiscoveryService } from './content-discovery.service';
import { CrawlerController } from './crawler.controller';
import { CrawlerService } from './crawler.service';
import { GoogleIntelController } from './google-intel.controller';
import { GoogleIntelligenceService } from './google-intel.service';
import { NvdController } from './nvd.controller';
import { NvdService } from './nvd.service';
import { ScreenshotController } from './screenshot.controller';
import { ScreenshotService } from './screenshot.service';
import { ThreatFeedsController } from './threat-feeds.controller';
import { ThreatFeedsService } from './threat-feeds.service';
import { ProviderKeysService } from './provider-keys.service';
import { ServiceScanController } from './service-scan.controller';
import { ServiceScanService } from './service-scan.service';
import { ThreatIntelService } from './threatintel.service';
import { UsernameIntelService } from './username-intel.service';
import { WhatsMyNameService } from './whatsmyname.service';
import { WpscanController } from './wpscan.controller';
import { WpscanService } from './wpscan.service';

@Module({
  imports: [ProxyModule],
  controllers: [
    IntegrationsController,
    EnrichController,
    CheckHostController,
    OsintController,
    MispController,
    ServiceScanController,
    ContentDiscoveryController,
    CrawlerController,
    ThreatFeedsController,
    NvdController,
    GoogleIntelController,
    ScreenshotController,
    WpscanController,
  ],
  providers: [
    ProviderKeysService,
    ThreatIntelService,
    EnrichmentService,
    CheckHostService,
    OsintService,
    HoleheService,
    GodaddyService,
    MispService,
    WhatsMyNameService,
    UsernameIntelService,
    ServiceScanService,
    ContentDiscoveryService,
    CrawlerService,
    ThreatFeedsService,
    NvdService,
    GoogleIntelligenceService,
    ScreenshotService,
    WpscanService,
  ],
  exports: [
    ProviderKeysService,
    ThreatIntelService,
    EnrichmentService,
    OsintService,
    WhatsMyNameService,
    UsernameIntelService,
    ServiceScanService,
    ContentDiscoveryService,
    CrawlerService,
    ThreatFeedsService,
    NvdService,
    GoogleIntelligenceService,
    ScreenshotService,
    WpscanService,
  ],
})
export class IntegrationsModule {}
