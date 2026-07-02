import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { MONITOR_QUEUE, MonitoringService } from './monitoring.service';

/** Worker BullMQ: processa o job `scan` (varredura) e os jobs `run` (um por monitor). */
@Processor(MONITOR_QUEUE, { concurrency: 5 })
export class MonitoringProcessor extends WorkerHost {
  private readonly logger = new Logger(MonitoringProcessor.name);

  constructor(private readonly monitoring: MonitoringService) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    if (job.name === 'scan') {
      const n = await this.monitoring.scanAndEnqueue();
      if (n > 0) this.logger.log(`scan: ${n} monitor(es) enfileirado(s)`);
      return { enqueued: n };
    }
    if (job.name === 'run') {
      const m = await this.monitoring.runById(job.data.id as string);
      return { id: job.data.id, status: m?.lastStatus ?? 'skipped' };
    }
    return undefined;
  }
}
