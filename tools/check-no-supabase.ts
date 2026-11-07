import * as fs from 'node:fs';
import * as path from 'node:path';

function checkDirectory(dir: string, violations: string[]) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.next') {
        checkDirectory(fullPath, violations);
      }
    } else if (entry.isFile() && /\.(ts|tsx|js|jsx|json)$/.test(entry.name)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (
        content.includes('@supabase/supabase-js') ||
        content.includes('@supabase/ssr')
      ) {
        violations.push(fullPath);
      }
    }
  }
}

function runCheck() {
  const webSrcDir = path.resolve(process.cwd(), 'apps/web/src');
  const webPkgJson = path.resolve(process.cwd(), 'apps/web/package.json');

  const violations: string[] = [];

  // 1. Check web package.json
  if (fs.existsSync(webPkgJson)) {
    const pkg = fs.readFileSync(webPkgJson, 'utf8');
    if (pkg.includes('@supabase/')) {
      violations.push(`${webPkgJson} (dependency declaration)`);
    }
  }

  // 2. Check apps/web/src
  if (fs.existsSync(webSrcDir)) {
    checkDirectory(webSrcDir, violations);
  }

  if (violations.length > 0) {
    console.error('❌ CI Security Violation: Direct Supabase imports detected in apps/web:');
    violations.forEach((v) => console.error(`  - ${v}`));
    console.error('\nAll authentication in apps/web must flow through the API Gateway (/v1/auth).');
    process.exit(1);
  } else {
    console.log('✅ CI Security Check Passed: No Supabase packages or imports in apps/web.');
  }
}

runCheck();
