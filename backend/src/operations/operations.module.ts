import { Module } from '@nestjs/common';
import { EngagementsModule } from '../engagements/engagements.module';
import { TimelineModule } from '../timeline/timeline.module';
import { OperationsController } from './operations.controller';
import { OperationsService } from './operations.service';

@Module({
  imports: [EngagementsModule, TimelineModule],
  controllers: [OperationsController],
  providers: [OperationsService],
  exports: [OperationsService],
})
export class OperationsModule {}
