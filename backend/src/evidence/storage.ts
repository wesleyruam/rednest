import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

export const UPLOAD_DIR = process.env.UPLOAD_DIR || join(process.cwd(), 'uploads');
const EVIDENCE_DIR = join(UPLOAD_DIR, 'evidence');

export const evidenceStorage = diskStorage({
  destination: (_req, _file, cb) => {
    if (!existsSync(EVIDENCE_DIR)) mkdirSync(EVIDENCE_DIR, { recursive: true });
    cb(null, EVIDENCE_DIR);
  },
  filename: (_req, file, cb) => {
    cb(null, `${randomUUID()}${extname(file.originalname)}`);
  },
});

export const REPORT_DIR = join(UPLOAD_DIR, 'reports');
export function ensureReportDir(): string {
  if (!existsSync(REPORT_DIR)) mkdirSync(REPORT_DIR, { recursive: true });
  return REPORT_DIR;
}
