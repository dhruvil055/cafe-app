import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const mongoUri = process.env.MONGO_URI;
const archivePath = process.argv[2] && path.resolve(process.argv[2]);
if (!mongoUri) throw new Error('MONGO_URI is required.');
if (!archivePath) throw new Error('Pass the backup archive path as the first argument.');
await access(archivePath);

const parsedUri = new URL(mongoUri);
const sourceDatabase = decodeURIComponent(parsedUri.pathname.replace(/^\//, ''));
if (!sourceDatabase) throw new Error('MONGO_URI must include the source database name.');
const uniqueRestoreDatabase = `brewhaus_restore_${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}_${randomUUID().slice(0, 8)}`;
const restoreUri = new URL(mongoUri);
restoreUri.pathname = `/${uniqueRestoreDatabase}`;
process.stdout.write(`Restoring into isolated database ${uniqueRestoreDatabase}; source data will not be overwritten.\n`);

await new Promise((resolve, reject) => {
  const child = spawn('mongorestore', [
    '--uri', restoreUri.toString(), '--archive', archivePath, '--gzip',
    '--nsFrom', `${sourceDatabase}.*`, '--nsTo', `${uniqueRestoreDatabase}.*`,
  ], { stdio: 'inherit', windowsHide: true });
  child.once('error', reject);
  child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`mongorestore exited with status ${code}`)));
});
process.stdout.write(`Restore verification database is ready: ${uniqueRestoreDatabase}\n`);
