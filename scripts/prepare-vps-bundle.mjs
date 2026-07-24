/**
 * Bundle schema + data + uploads for VPS restore.
 * Rewrites Supabase storage URLs in data.sql to /uploads/<filename>.
 */
import fs from 'fs';
import path from 'path';

const root = process.cwd();
const migrationDir = path.join(root, 'migration-data');
const uploadsDir = path.join(root, 'uploads');
const outDir = path.join(migrationDir, 'vps-bundle');

fs.mkdirSync(outDir, { recursive: true });

const schemaSrc = path.join(root, 'db/migrations/001_plain_postgres.sql');
const dataSrc = path.join(migrationDir, 'data.sql');
const restoreSrc = path.join(root, 'scripts/restore-to-vps.sh');

fs.copyFileSync(schemaSrc, path.join(outDir, '001_plain_postgres.sql'));
fs.copyFileSync(restoreSrc, path.join(outDir, 'restore-to-vps.sh'));

let data = fs.readFileSync(dataSrc, 'utf8');
data = data.replace(
  /https:\/\/[^"']+\/storage\/v1\/object\/public\/products\//g,
  '/uploads/'
);
fs.writeFileSync(path.join(outDir, 'data.sql'), data);

if (fs.existsSync(uploadsDir)) {
  const destUploads = path.join(outDir, 'uploads');
  fs.mkdirSync(destUploads, { recursive: true });
  for (const name of fs.readdirSync(uploadsDir)) {
    const from = path.join(uploadsDir, name);
    if (fs.statSync(from).isFile()) {
      fs.copyFileSync(from, path.join(destUploads, name));
    }
  }
}

const readme = `# VPS restore bundle

On big-vps:

\`\`\`bash
# from your PC:
# scp -r migration-data/vps-bundle big-vps:~/mamator-restore

ssh big-vps
bash ~/mamator-restore/restore-to-vps.sh ~/mamator-restore

# copy images into Coolify upload volume / nginx alias
sudo mkdir -p /var/www/mamator/uploads
sudo cp -a ~/mamator-restore/uploads/. /var/www/mamator/uploads/
sudo chown -R 1000:1000 /var/www/mamator/uploads || true
\`\`\`
`;
fs.writeFileSync(path.join(outDir, 'README.md'), readme);
console.log('Bundle ready at', outDir);
console.log('uploads:', fs.existsSync(path.join(outDir, 'uploads')) ? fs.readdirSync(path.join(outDir, 'uploads')).length : 0);
