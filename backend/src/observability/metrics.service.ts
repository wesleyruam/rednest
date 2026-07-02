import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { collectDefaultMetrics, Gauge, Histogram, Registry } from 'prom-client';
import { MONITOR_QUEUE } from '../monitoring/monitoring.service';

@Injectable()
export class MetricsService {
  readonly registry = new Registry();
  readonly httpDuration: Histogram<string>;
  private readonly queueGauge: Gauge<string>;

  constructor(@InjectQueue(MONITOR_QUEUE) private readonly queue: Queue) {
    this.registry.setDefaultLabels({ app: 'rednest-backend' });
    collectDefaultMetrics({ register: this.registry });

    this.httpDuration = new Histogram({
      name: 'rednest_http_request_duration_seconds',
      help: 'Duração das requisições HTTP',
      labelNames: ['method', 'route', 'status'],
      buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
      registers: [this.registry],
    });

    this.queueGauge = new Gauge({
      name: 'rednest_monitor_queue_jobs',
      help: 'Jobs na fila de monitores por estado',
      labelNames: ['state'],
      registers: [this.registry],
    });
  }

  observeHttp(method: string, route: string, status: number, seconds: number): void {
    this.httpDuration.labels(method, route, String(status)).observe(seconds);
  }

  /** Atualiza os gauges da fila e devolve o texto Prometheus. */
  async render(): Promise<string> {
    try {
      const counts = await this.queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');
      for (const [state, n] of Object.entries(counts)) {
        this.queueGauge.labels(state).set(Number(n) || 0);
      }
    } catch {
      /* redis indisponível — ignora os gauges da fila */
    }
    return this.registry.metrics();
  }
}
