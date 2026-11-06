#!/usr/bin/env node

const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'info': {
    const pkg = args[1];
    const range = args[2] || 'latest';
    console.log(`Querying ${pkg} for version ${range}...`);
    break;
  }
  case 'install': {
    console.log('Resolving and installing dependencies...');
    break;
  }
  default:
    console.error(`Unknown command: ${command}`);
    process.exit(1);
}

