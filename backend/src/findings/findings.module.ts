import { Module } from '@nestjs/common';
import { TimelineModule } from '../timeline/timeline.module';
import { EntitiesController } from './entities.controller';
import { FindingsController } from './findings.controller';
import { FindingsService } from './findings.service';

@Module({
  imports: [TimelineModule],
  controllers: [FindingsController, EntitiesController],
  providers: [FindingsService],
  exports: [FindingsService],
})
export class FindingsModule {}
