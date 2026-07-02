import { Module } from '@nestjs/common';
import { IntegrationsModule } from '../integrations/integrations.module';
import { CorrelationEngine } from './correlation.engine';
import { OsintEngine } from './osint.engine';
import { ReconEngine } from './recon.engine';
import { ThreatIntelEngine } from './threatintel.engine';

/**
 * Engines internas do RedNest — cada ferramenta vira uma engine que conversa com
 * as demais. Toda investigação flui por aqui e publica no Investigation Event Bus.
 */
@Module({
  imports: [IntegrationsModule],
  providers: [ReconEngine, OsintEngine, ThreatIntelEngine, CorrelationEngine],
  exports: [ReconEngine, OsintEngine, ThreatIntelEngine, CorrelationEngine],
})
export class EnginesModule {}
