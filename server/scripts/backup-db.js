import { spawn } from 'node:child_process';
import { mkdir, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const mongoUri = process.env.MONGO_URI;
if (!mongoUri) throw new Error('MONGO_URI is required.');

const backupDirectory = path.resolve(process.env.BACKUP_DIR || path.join(scriptDirectory, '..', 'backups'));
await mkdir(backupDirectory, { recursive: true });
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const archivePath = path.join(backupDirectory, `brewhaus-${timestamp}.archive.gz`);
await new Promise((resolve, reject) => {
  const child = spawn('mongodump', ['--uri', mongoUri, '--archive', archivePath, '--gzip'], { stdio: 'inherit', windowsHide: true });
  child.once('error', reject);
  child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`mongodump exited with status ${code}`)));
});
await access(archivePath);
process.stdout.write(`Database backup created: ${archivePath}\n`);
