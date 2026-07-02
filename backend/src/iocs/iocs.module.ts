import { Module } from '@nestjs/common';
import { IntegrationsModule } from '../integrations/integrations.module';
import { IocsController } from './iocs.controller';
import { IocsService } from './iocs.service';

@Module({
  imports: [IntegrationsModule],
  controllers: [IocsController],
  providers: [IocsService],
  exports: [IocsService],
})
export class IocsModule {}
