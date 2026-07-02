import { Injectable, NotFoundException } from '@nestjs/common';
import { Report } from '@prisma/client';
import PDFDocument from 'pdfkit';
import { createWriteStream, statSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ensureReportDir } from '../evidence/storage';

const ACCENT = '#7F77DD';
const MUTED = '#888888';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  list(operationId?: string): Promise<Report[]> {
    return this.prisma.report.findMany({
      where: operationId ? { operationId } : {},
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(id: string): Promise<Report> {
    const r = await this.prisma.report.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('Relatório não encontrado');
    return r;
  }

  async remove(id: string): Promise<void> {
    await this.get(id);
    await this.prisma.report.delete({ where: { id } });
  }

  async generate(operationId: string, createdBy?: string): Promise<Report> {
    const op = await this.prisma.operation.findFirst({ where: { id: operationId, deletedAt: null } });
    if (!op) throw new NotFoundException('Operação não encontrada');

    const [engagements, iocs, events] = await Promise.all([
      this.prisma.engagement.findMany({ where: { operationId, deletedAt: null }, orderBy: { updatedAt: 'desc' } }),
      this.prisma.ioc.findMany({ where: { operationId, deletedAt: null }, orderBy: { lastSeen: 'desc' }, take: 200 }),
      this.prisma.timelineEvent.findMany({ where: { operationId }, orderBy: { timestamp: 'desc' }, take: 50 }),
    ]);

    const dir = ensureReportDir();
    const fileName = `${randomUUID()}.pdf`;
    const path = join(dir, fileName);

    await this.buildPdf(path, { op, engagements, iocs, events });

    const size = statSync(path).size;
    const report = await this.prisma.report.create({
      data: {
        operationId,
        name: `Relatório — ${op.name} — ${new Date().toLocaleDateString('pt-BR')}`,
        format: 'pdf',
        storedPath: path,
        size,
        createdBy: createdBy ?? null,
      },
    });
    await this.prisma.operation.update({ where: { id: operationId }, data: { reportCount: { increment: 1 } } }).catch(() => undefined);
    return report;
  }

  private buildPdf(
    path: string,
    data: { op: any; engagements: any[]; iocs: any[]; events: any[] },
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const stream = createWriteStream(path);
      doc.pipe(stream);
      stream.on('finish', () => resolve());
      stream.on('error', reject);

      const { op, engagements, iocs, events } = data;

      // Cabeçalho
      doc.fillColor(ACCENT).fontSize(22).text('RedNest — Relatório de Operação', { align: 'left' });
      doc.moveDown(0.3);
      doc.fillColor(MUTED).fontSize(9).text(`Gerado em ${new Date().toLocaleString('pt-BR')} · CONFIDENCIAL`);
      doc.moveTo(50, doc.y + 6).lineTo(545, doc.y + 6).strokeColor('#cccccc').stroke();
      doc.moveDown(1);

      // Resumo da operação
      doc.fillColor('#000').fontSize(15).text(op.name);
      doc.moveDown(0.2);
      doc.fillColor('#333').fontSize(10).text(op.description || 'Sem descrição.');
      doc.moveDown(0.5);
      const meta = [
        `Status: ${op.status}`, `Prioridade: ${op.priority}`, `Progresso: ${op.progress}%`,
        `Engajamentos: ${op.engagementCount}`, `IOCs: ${op.iocCount}`, `Evidências: ${op.evidenceCount}`,
        `Tags: ${(op.tags || []).join(', ') || '—'}`,
      ];
      doc.fillColor('#555').fontSize(9.5).text(meta.join('   ·   '));
      doc.moveDown(1);

      const section = (title: string) => {
        if (doc.y > 720) doc.addPage();
        doc.fillColor(ACCENT).fontSize(13).text(title);
        doc.moveDown(0.3);
        doc.fillColor('#000');
      };

      // Engajamentos
      section(`Engajamentos (${engagements.length})`);
      if (!engagements.length) doc.fillColor(MUTED).fontSize(10).text('Nenhum engajamento.');
      engagements.forEach((e) => {
        if (doc.y > 760) doc.addPage();
        doc.fillColor('#000').fontSize(10).text(`• ${e.name}`, { continued: false });
        doc.fillColor('#666').fontSize(9).text(`   tipo: ${e.type} · alvo: ${e.target} · status: ${e.status}`);
      });
      doc.moveDown(1);

      // IOCs
      section(`Indicadores de Comprometimento (${iocs.length})`);
      if (!iocs.length) doc.fillColor(MUTED).fontSize(10).text('Nenhum IOC.');
      iocs.slice(0, 100).forEach((i) => {
        if (doc.y > 765) doc.addPage();
        doc.fillColor('#000').fontSize(9).text(`[${i.threatLevel}] ${i.type}  ${i.value}`, { continued: false });
        if (i.description) doc.fillColor('#777').fontSize(8).text(`     ${i.description}`);
      });
      doc.moveDown(1);

      // Timeline
      section(`Linha do Tempo (${events.length})`);
      if (!events.length) doc.fillColor(MUTED).fontSize(10).text('Sem eventos.');
      events.forEach((ev) => {
        if (doc.y > 770) doc.addPage();
        doc.fillColor('#666').fontSize(8).text(new Date(ev.timestamp).toLocaleString('pt-BR'), { continued: true });
        doc.fillColor('#000').fontSize(8).text(`  ${ev.title}`);
      });

      doc.end();
    });
  }
}
