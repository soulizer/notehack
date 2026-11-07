import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { paths } from '../config.js';
import { readAttachment } from './storage.js';
import { one } from '../db.js';

const exec = promisify(execFile);
let active = 0;
const queue: Array<() => Promise<void>> = [];

function pump(): void {
  if (active >= 1) return;
  const task = queue.shift();
  if (!task) return;
  active++;
  task().finally(() => {
    active--;
    pump();
  });
}

async function commandExists(command: string): Promise<boolean> {
  try {
    await exec('sh', ['-c', `command -v ${command}`]);
    return true;
  } catch {
    return false;
  }
}

export function queueOcr(
  attachmentId: string,
  storageKey: string,
  mime: string,
  log: { warn: (obj: unknown, msg?: string) => void },
): void {
  queue.push(async () => {
    const temp = path.join(paths.temp, `ocr-${crypto.randomUUID()}`);
    try {
      const data = await readAttachment(storageKey);
      const isPdf = mime === 'application/pdf';
      const isImage = mime.startsWith('image/') && mime !== 'image/svg+xml';
      if (!isPdf && !isImage) {
        await one('UPDATE attachments SET ocr_status = $2 WHERE id = $1 RETURNING id', [attachmentId, 'none']);
        return;
      }
      await fs.mkdir(paths.temp, { recursive: true, mode: 0o700 });
      await fs.writeFile(temp, data, { mode: 0o600 });
      let text = '';
      if (isPdf) {
        if (!(await commandExists('pdftotext'))) throw new Error('pdftotext not installed');
        const result = await exec('pdftotext', [temp, '-'], { timeout: 120_000, maxBuffer: 8 * 1024 * 1024 });
        text = result.stdout;
      } else {
        if (!(await commandExists('tesseract'))) throw new Error('tesseract not installed');
        const result = await exec('tesseract', [temp, 'stdout', '-l', 'eng+chi_sim'], {
          timeout: 120_000,
          maxBuffer: 8 * 1024 * 1024,
        });
        text = result.stdout;
      }
      const normalized = text.replace(/\s+/g, ' ').trim().slice(0, 200_000);
      await one('UPDATE attachments SET ocr_text = $2, ocr_status = $3 WHERE id = $1 RETURNING id', [
        attachmentId,
        normalized || null,
        normalized ? 'done' : 'none',
      ]);
    } catch (error) {
      log.warn({ error, attachmentId }, 'OCR failed');
      await one('UPDATE attachments SET ocr_status = $2 WHERE id = $1 RETURNING id', [attachmentId, 'failed']).catch(() => {});
    } finally {
      await fs.rm(temp, { force: true }).catch(() => {});
    }
  });
  pump();
}

export async function resumePendingOcr(log: { warn: (obj: unknown, msg?: string) => void }): Promise<void> {
  const { many } = await import('../db.js');
  const pending = await many<{ id: string; storage_key: string; mime: string }>(
    `SELECT id, storage_key, mime FROM attachments WHERE ocr_status = 'pending' AND deleted_at IS NULL LIMIT 50`,
  );
  for (const row of pending) queueOcr(row.id, row.storage_key, row.mime, log);
}
