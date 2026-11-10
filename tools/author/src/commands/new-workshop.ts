import fs from 'node:fs';
import path from 'node:path';
import { success, error, info } from '../utils/format.js';

export function runNewWorkshop(slug: string, options: { targetDir?: string }): void {
  const targetDir = path.resolve(process.cwd(), options.targetDir || slug);

  if (fs.existsSync(targetDir) && fs.readdirSync(targetDir).length > 0) {
    console.error(error(`Target directory '${targetDir}' already exists and is not empty.`));
    process.exit(1);
  }

  fs.mkdirSync(targetDir, { recursive: true });

  // 1. workshop.yaml
  const workshopYaml = `slug: ${slug}
title: Build your own ${slug.split('-').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')}
summary: A comprehensive systems engineering workshop building ${slug} from scratch.
difficulty: intermediate
estimated_hours: 12
access: free
languages:
  - go
  - python
prerequisites:
  - Basic understanding of command-line tools
  - Familiarity with network sockets
chapters:
  - bind-port
`;
  fs.writeFileSync(path.join(targetDir, 'workshop.yaml'), workshopYaml, 'utf-8');

  // 2. overview.md
  const overviewMd = `# Build your own ${slug}

## What we build
A production-grade, minimal clone demonstrating foundational systems concepts.

## What you will learn
Socket programming, protocol encoding, concurrency, and client-server state.

## Prerequisites
Go 1.22+ or Python 3.11+, and your favorite code editor.

## Limitations and scope
Focuses on core protocol mechanisms and network primitives; clustering and advanced persistence are omitted.

## How this workshop works
Develop locally in your favorite editor, run verification tests via Git push, and track your step-by-step progress in real time.
`;
  fs.writeFileSync(path.join(targetDir, 'overview.md'), overviewMd, 'utf-8');

  // 3. .gitignore
  const gitignore = `node_modules/
.DS_Store
Thumbs.db
*.exe
*.bin
app
__pycache__/
*.pyc
.artifacts/
`;
  fs.writeFileSync(path.join(targetDir, '.gitignore'), gitignore, 'utf-8');

  // 4. starters/go
  const goDir = path.join(targetDir, 'starters', 'go');
  const goWfDir = path.join(goDir, '.github', 'workflows');
  fs.mkdirSync(goWfDir, { recursive: true });

  fs.writeFileSync(
    path.join(goDir, 'handrail.yaml'),
    `build: ["go", "build", "-o", "app", "."]\nrun:\n  default: ["./app"]\n  windows: ["app.exe"]\n`,
    'utf-8',
  );
  fs.writeFileSync(
    path.join(goWfDir, 'verify.yml'),
    `name: Handrail Verify\non: [push]\njobs:\n  verify:\n    uses: handrail-learn/verify-action/.github/workflows/reusable-verify.yml@v1\n`,
    'utf-8',
  );
  fs.writeFileSync(
    path.join(goDir, 'go.mod'),
    `module handrail.dev/${slug}\n\ngo 1.22\n`,
    'utf-8',
  );
  fs.writeFileSync(
    path.join(goDir, 'main.go'),
    `package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("Handrail starter ready.")\n}\n`,
    'utf-8',
  );
  fs.writeFileSync(
    path.join(goDir, 'README.md'),
    `# ${slug} (Go Starter)\n\nRun your app locally:\n\`\`\`bash\ngo run .\n\`\`\`\n`,
    'utf-8',
  );

  // 5. starters/python
  const pyDir = path.join(targetDir, 'starters', 'python');
  const pyWfDir = path.join(pyDir, '.github', 'workflows');
  fs.mkdirSync(pyWfDir, { recursive: true });

  fs.writeFileSync(
    path.join(pyDir, 'handrail.yaml'),
    `build: ["echo", "ready"]\nrun:\n  default: ["python3", "server.py"]\n  windows: ["python", "server.py"]\n`,
    'utf-8',
  );
  fs.writeFileSync(
    path.join(pyWfDir, 'verify.yml'),
    `name: Handrail Verify\non: [push]\njobs:\n  verify:\n    uses: handrail-learn/verify-action/.github/workflows/reusable-verify.yml@v1\n`,
    'utf-8',
  );
  fs.writeFileSync(
    path.join(pyDir, 'server.py'),
    `def main():\n    print("Handrail Python starter ready.")\n\nif __name__ == "__main__":\n    main()\n`,
    'utf-8',
  );
  fs.writeFileSync(
    path.join(pyDir, 'README.md'),
    `# ${slug} (Python Starter)\n\nRun your app locally:\n\`\`\`bash\npython3 server.py\n\`\`\`\n`,
    'utf-8',
  );

  console.log(success(`Scaffolded workshop '${slug}' at ${targetDir}`));
  console.log(info(`Next: run 'git init', commit to 'main', and run 'handrail-author new-chapter bind-port'.`));
}
