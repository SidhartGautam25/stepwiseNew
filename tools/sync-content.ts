import path from 'node:path';
import fs from 'node:fs';

// Try to load .env from root
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath) && typeof (process as any).loadEnvFile === 'function') {
  try {
    (process as any).loadEnvFile(envPath);
  } catch {
    // ignore
  }
}

const SYNC_TOKEN = process.env.INTERNAL_SYNC_TOKEN || 'dev_internal_sync_token_secret';
const CATALOG_PORT = process.env.PORT_CATALOG || '4001';
const GATEWAY_PORT = process.env.PORT_API_GATEWAY || '4000';

async function main() {
  const contentDir = path.resolve(process.cwd(), 'content');
  console.log(`[Handrail Content Sync] Initiating sync from: ${contentDir}`);

  const targets = [
    `http://localhost:${CATALOG_PORT}/internal/content/sync`,
    `http://localhost:${GATEWAY_PORT}/internal/content/sync`,
  ];

  let success = false;
  for (const url of targets) {
    try {
      console.log(`[Handrail Content Sync] Attempting ${url}...`);
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-token': SYNC_TOKEN,
        },
        body: JSON.stringify({ contentDir }),
      });

      if (res.ok) {
        const data = await res.json();
        console.log(`\n🎉 Content Sync Succeeded!`);
        console.log(JSON.stringify(data, null, 2));
        success = true;
        break;
      } else {
        const errorText = await res.text();
        console.warn(`[Handrail Content Sync] ${url} responded with ${res.status}: ${errorText}`);
      }
    } catch (err: any) {
      console.warn(`[Handrail Content Sync] Could not connect to ${url}: ${err.message}`);
    }
  }

  if (!success) {
    console.error(`\n❌ Content Sync Failed.`);
    console.error(`Make sure the backend is running! (run: pnpm dev)`);
    process.exit(1);
  }
}

main();

