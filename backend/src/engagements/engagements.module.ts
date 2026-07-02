import { Module } from '@nestjs/common';
import { EnginesModule } from '../engines/engines.module';
import { FindingsModule } from '../findings/findings.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { TimelineModule } from '../timeline/timeline.module';
import { EngagementsController } from './engagements.controller';
import { EngagementsService } from './engagements.service';
import { PipelineService } from './pipeline.service';

@Module({
  imports: [EnginesModule, FindingsModule, IntegrationsModule, TimelineModule],
  controllers: [EngagementsController],
  providers: [EngagementsService, PipelineService],
  exports: [EngagementsService],
})
export class EngagementsModule {}
