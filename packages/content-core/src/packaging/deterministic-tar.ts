import zlib from 'node:zlib';
import type { ArchiveEntry } from './deterministic-zip.js';
import { normalizeArchivePath } from './deterministic-zip.js';

// Fixed UNIX timestamp: 2026-01-01 00:00:00 UTC
const FIXED_UNIX_TIMESTAMP = 1767225600;

function formatOctal(num: number, length: number): string {
  const str = num.toString(8);
  return str.padStart(length - 1, '0') + '\0';
}

/**
 * Builds a single 512-byte POSIX ustar header block for a file entry
 */
function createTarHeader(name: string, size: number, mode: number): Buffer {
  const header = Buffer.alloc(512);

  // File name (100 bytes)
  const nameBuf = Buffer.from(name, 'utf-8');
  if (nameBuf.length > 100) {
    throw new Error(`Tar entry name too long (max 100 chars): ${name}`);
  }
  nameBuf.copy(header, 0);

  // File mode (8 bytes)
  Buffer.from(formatOctal(mode, 8), 'ascii').copy(header, 100);

  // UID (8 bytes) & GID (8 bytes)
  Buffer.from(formatOctal(0, 8), 'ascii').copy(header, 108);
  Buffer.from(formatOctal(0, 8), 'ascii').copy(header, 116);

  // File size in bytes (12 bytes)
  Buffer.from(formatOctal(size, 12), 'ascii').copy(header, 124);

  // Modification time (12 bytes)
  Buffer.from(formatOctal(FIXED_UNIX_TIMESTAMP, 12), 'ascii').copy(header, 136);

  // Checksum field initially spaces (8 bytes)
  header.fill(32, 148, 156);

  // Typeflag '0' = regular file (1 byte)
  header[156] = 48; // '0'

  // Magic 'ustar\0' (6 bytes) & Version '00' (2 bytes)
  Buffer.from('ustar\0', 'ascii').copy(header, 257);
  Buffer.from('00', 'ascii').copy(header, 263);

  // Compute checksum (sum of all unsigned bytes in header)
  let sum = 0;
  for (let i = 0; i < 512; i++) {
    sum += header[i];
  }
  const checksumStr = sum.toString(8).padStart(6, '0') + '\0 ';
  Buffer.from(checksumStr, 'ascii').copy(header, 148);

  return header;
}

/**
 * Builds a byte-for-byte deterministic .tar.gz archive from entries
 */
export function buildDeterministicTarGz(entries: ArchiveEntry[]): Buffer {
  const normalizedEntries = entries
    .map((e) => {
      const path = normalizeArchivePath(e.path);
      const data = typeof e.content === 'string' ? Buffer.from(e.content, 'utf-8') : e.content;
      const isExecutable = Boolean(e.mode && (e.mode & 0o111));
      const mode = isExecutable ? 0o755 : 0o644;
      return { path, data, mode };
    })
    .sort((a, b) => a.path.localeCompare(b.path));

  const chunks: Buffer[] = [];

  for (const entry of normalizedEntries) {
    const header = createTarHeader(entry.path, entry.data.length, entry.mode);
    chunks.push(header);
    chunks.push(entry.data);

    // Pad file content to 512-byte block boundary
    const remainder = entry.data.length % 512;
    if (remainder !== 0) {
      const padSize = 512 - remainder;
      chunks.push(Buffer.alloc(padSize));
    }
  }

  // Two 512-byte zero blocks marking end of tar archive
  chunks.push(Buffer.alloc(1024));

  const uncompressedTar = Buffer.concat(chunks);

  // Gzip and zero out the 4-byte header MTIME and OS byte to guarantee identical output
  const gzipped = zlib.gzipSync(uncompressedTar);
  if (gzipped.length >= 10) {
    gzipped[4] = 0;
    gzipped[5] = 0;
    gzipped[6] = 0;
    gzipped[7] = 0;
    gzipped[9] = 255; // OS: unknown/neutral
  }
  return gzipped;
}

export const buildDeterministicTar = buildDeterministicTarGz;

