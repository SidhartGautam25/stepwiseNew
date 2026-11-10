import zlib from 'node:zlib';

export interface ArchiveEntry {
  path: string;
  content: Buffer | string;
  mode?: number; // e.g. 0o755 for executable, 0o644 for regular file
}

// CRC32 implementation
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[i] = c;
}

export function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Normalizes entry path to safe POSIX relative path
 */
export function normalizeArchivePath(p: string): string {
  const normalized = p.replace(/\\/g, '/').replace(/^\/+/, '');
  const segments = normalized.split('/').filter(Boolean);
  if (segments.some((s) => s === '..')) {
    throw new Error(`Path traversal attempted in archive entry: ${p}`);
  }
  return segments.join('/');
}

// Fixed DOS Date & Time: 2026-01-01 00:00:00
// Year: (2026 - 1980) = 46 (0x2E), Month: 1, Day: 1 -> DOS Date = (46 << 9) | (1 << 5) | 1 = 0x5C21
const FIXED_DOS_DATE = 0x5c21;
const FIXED_DOS_TIME = 0x0000;

/**
 * Builds a byte-for-byte deterministic ZIP archive from entries
 */
export function buildDeterministicZip(entries: ArchiveEntry[]): Buffer {
  // Sort entries lexicographically by normalized POSIX path
  const normalizedEntries = entries
    .map((e) => {
      const path = normalizeArchivePath(e.path);
      const data = typeof e.content === 'string' ? Buffer.from(e.content, 'utf-8') : e.content;
      const isExecutable = Boolean(e.mode && (e.mode & 0o111));
      const mode = isExecutable ? 0o755 : 0o644;
      return { path, data, mode };
    })
    .sort((a, b) => a.path.localeCompare(b.path));

  const localHeaders: Buffer[] = [];
  const centralHeaders: Buffer[] = [];
  let offset = 0;

  for (const entry of normalizedEntries) {
    const pathBuf = Buffer.from(entry.path, 'utf-8');
    const crc = crc32(entry.data);
    const uncompressedSize = entry.data.length;

    // Use deflate compression
    const compressedData = zlib.deflateRawSync(entry.data);
    const compressedSize = compressedData.length;

    // Local file header (30 bytes + path length)
    const localHeader = Buffer.alloc(30 + pathBuf.length);
    localHeader.writeUInt32LE(0x04034b50, 0); // Local file header signature
    localHeader.writeUInt16LE(20, 4); // Version needed to extract (2.0)
    localHeader.writeUInt16LE(0x0800, 6); // General purpose bit flag (UTF-8)
    localHeader.writeUInt16LE(8, 8); // Compression method (Deflate)
    localHeader.writeUInt16LE(FIXED_DOS_TIME, 10);
    localHeader.writeUInt16LE(FIXED_DOS_DATE, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressedSize, 18);
    localHeader.writeUInt32LE(uncompressedSize, 22);
    localHeader.writeUInt16LE(pathBuf.length, 26);
    localHeader.writeUInt16LE(0, 28); // Extra field length
    pathBuf.copy(localHeader, 30);

    localHeaders.push(localHeader);
    localHeaders.push(compressedData);

    // Central directory header (46 bytes + path length)
    const centralHeader = Buffer.alloc(46 + pathBuf.length);
    centralHeader.writeUInt32LE(0x02014b50, 0); // Central directory signature
    centralHeader.writeUInt16LE(0x031e, 4); // Version made by: Unix, version 3.0
    centralHeader.writeUInt16LE(20, 6); // Version needed
    centralHeader.writeUInt16LE(0x0800, 8); // UTF-8
    centralHeader.writeUInt16LE(8, 10); // Deflate
    centralHeader.writeUInt16LE(FIXED_DOS_TIME, 12);
    centralHeader.writeUInt16LE(FIXED_DOS_DATE, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compressedSize, 20);
    centralHeader.writeUInt32LE(uncompressedSize, 24);
    centralHeader.writeUInt16LE(pathBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30); // Extra field length
    centralHeader.writeUInt16LE(0, 32); // File comment length
    centralHeader.writeUInt16LE(0, 34); // Disk number start
    centralHeader.writeUInt16LE(0, 36); // Internal file attributes
    // External file attributes: Unix permissions (0o644 or 0o755) in top 16 bits
    const unixAttr = ((0o100000 | entry.mode) * 0x10000) >>> 0;
    centralHeader.writeUInt32LE(unixAttr, 38);
    centralHeader.writeUInt32LE(offset, 42); // Relative offset of local header
    pathBuf.copy(centralHeader, 46);

    centralHeaders.push(centralHeader);

    offset += localHeader.length + compressedData.length;
  }

  const centralDirOffset = offset;
  const centralDirBuf = Buffer.concat(centralHeaders);
  const centralDirSize = centralDirBuf.length;

  // End of central directory record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // EOCD signature
  eocd.writeUInt16LE(0, 4); // Number of this disk
  eocd.writeUInt16LE(0, 6); // Disk where central directory starts
  eocd.writeUInt16LE(normalizedEntries.length, 8); // Number of central directory records on this disk
  eocd.writeUInt16LE(normalizedEntries.length, 10); // Total number of central directory records
  eocd.writeUInt32LE(centralDirSize, 12); // Size of central directory
  eocd.writeUInt32LE(centralDirOffset, 16); // Offset of start of central directory
  eocd.writeUInt16LE(0, 20); // Comment length

  return Buffer.concat([...localHeaders, centralDirBuf, eocd]);
}
