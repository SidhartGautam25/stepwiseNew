export const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

export function success(msg: string): string {
  return `${colors.green}✓ ${msg}${colors.reset}`;
}

export function error(msg: string): string {
  return `${colors.red}✗ ${msg}${colors.reset}`;
}

export function warn(msg: string): string {
  return `${colors.yellow}⚠ ${msg}${colors.reset}`;
}

export function info(msg: string): string {
  return `${colors.cyan}ℹ ${msg}${colors.reset}`;
}

export function bold(msg: string): string {
  return `${colors.bold}${msg}${colors.reset}`;
}
