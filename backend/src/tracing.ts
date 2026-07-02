// Inicialização do OpenTelemetry — DEVE ser importado antes de qualquer outra
// coisa no main.ts para instrumentar HTTP/Express/Nest/Prisma(pg)/ioredis.
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { NodeSDK } from '@opentelemetry/sdk-node';

if (process.env.OTEL_ENABLED !== 'false') {
  const base = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318';
  const sdk = new NodeSDK({
    serviceName: process.env.OTEL_SERVICE_NAME || 'rednest-backend',
    traceExporter: new OTLPTraceExporter({ url: `${base}/v1/traces` }),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });

  try {
    sdk.start();
    // eslint-disable-next-line no-console
    console.log(`[otel] tracing ativo → ${base}`);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(`[otel] falha ao iniciar tracing: ${String(e)}`);
  }

  process.on('SIGTERM', () => {
    void sdk.shutdown().finally(() => process.exit(0));
  });
}
