const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const cwd = process.cwd();
const rootDir = path.resolve(__dirname, '..');
const envFile = path.resolve(rootDir, '.env');
const srcGen = path.join(cwd, 'src', 'generated');
const distGen = path.join(cwd, 'dist', 'generated');
const prismaSchema = path.join(cwd, 'prisma', 'schema.prisma');

const isWin = process.platform === 'win32';
const npxCmd = isWin ? 'npx.cmd' : 'npx';

function copyGenerated() {
  if (fs.existsSync(srcGen)) {
    try {
      fs.cpSync(srcGen, distGen, { recursive: true });
    } catch (e) {
      // Ignore in-use or race conditions
    }
  }
}

// 1. Generate Prisma client if schema exists but generated client is missing
if (fs.existsSync(prismaSchema) && !fs.existsSync(srcGen)) {
  console.log(`[dev-runner] Generating Prisma client for ${path.basename(cwd)}...`);
  spawnSync(npxCmd, ['prisma', 'generate'], {
    cwd,
    shell: true,
    stdio: 'inherit',
  });
}

// 2. Initial build with tsc -b
console.log(`[dev-runner] Building TypeScript for ${path.basename(cwd)}...`);
const tscInitial = spawnSync(npxCmd, ['tsc', '-b'], {
  cwd,
  shell: true,
  stdio: 'inherit',
});

if (tscInitial.status !== 0) {
  console.warn(`[dev-runner] Initial tsc exit code ${tscInitial.status}, starting watcher...`);
}

copyGenerated();

function killProcess(proc) {
  if (!proc || !proc.pid) return;
  if (isWin) {
    try {
      spawnSync('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { stdio: 'ignore' });
    } catch {}
  } else {
    try {
      proc.kill('SIGTERM');
    } catch {}
  }
}

let nodeProc = null;
let restartTimer = null;
let isInitialRun = true;

function startNode() {
  copyGenerated();
  const nodeArgs = [];
  if (fs.existsSync(envFile)) {
    nodeArgs.push(`--env-file=${envFile}`);
  }
  nodeArgs.push('dist/main.js');

  nodeProc = spawn('node', nodeArgs, {
    cwd,
    shell: true,
    stdio: 'inherit',
  });

  nodeProc.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.warn(`[dev-runner] Node process exited with code ${code}`);
    }
  });
}

function restartNode() {
  if (restartTimer) {
    clearTimeout(restartTimer);
  }
  // Debounce restarts so intermediate file writes don't cause multiple restarts
  restartTimer = setTimeout(() => {
    if (nodeProc) {
      console.log(`[dev-runner] Restarting ${path.basename(cwd)}...`);
      killProcess(nodeProc);
      nodeProc = null;
    }
    startNode();
  }, 350);
}

// Start initial node process after synchronous tsc -b
startNode();

// 3. Start tsc watch (watches source files and project references)
const tscWatch = spawn(npxCmd, ['tsc', '-b', '-w', '--preserveWatchOutput'], {
  cwd,
  shell: true,
  stdio: ['ignore', 'pipe', 'inherit'],
});

tscWatch.stdout?.on('data', (chunk) => {
  const text = chunk.toString();
  if (text.includes('error TS')) {
    process.stderr.write(text);
  }
  // Only restart node once TypeScript has cleanly finished building
  if (text.includes('Found 0 errors')) {
    if (isInitialRun) {
      isInitialRun = false;
      return;
    }
    restartNode();
  }
});

const cleanup = () => {
  if (restartTimer) clearTimeout(restartTimer);
  killProcess(tscWatch);
  killProcess(nodeProc);
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
