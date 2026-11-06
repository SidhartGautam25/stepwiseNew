import * as zlib from 'zlib';

/**
 * Standard CRC32 table & calculator
 */
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c >>> 0;
}

export function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export interface ZipEntry {
  name: string; // e.g. "handrail.yaml" or ".github/workflows/verify.yml"
  data: Buffer;
}

/**
 * Pure Node.js zero-dependency standard PKZIP 2.0 archive generator
 */
export function createZipArchive(entries: ZipEntry[]): Buffer {
  const localHeaders: Buffer[] = [];
  const centralHeaders: Buffer[] = [];
  let currentOffset = 0;

  // DOS time/date format
  const now = new Date();
  const dosTime =
    ((now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2)) & 0xffff;
  const dosDate =
    (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xffff;

  for (const entry of entries) {
    // Normalize path separators to forward slash for zip spec
    const normalizedName = entry.name.replace(/\\/g, '/').replace(/^\/+/, '');
    const filenameBuf = Buffer.from(normalizedName, 'utf8');
    const uncompressedData = entry.data;
    const checksum = crc32(uncompressedData);

    // Deflate
    const compressedData = zlib.deflateRawSync(uncompressedData, { level: 9 });
    const compressionMethod = 8; // Deflate

    // 1. Local File Header
    const localHeader = Buffer.alloc(30 + filenameBuf.length);
    localHeader.writeUInt32LE(0x04034b50, 0); // signature
    localHeader.writeUInt16LE(20, 4); // version needed (2.0)
    localHeader.writeUInt16LE(0, 6); // flags
    localHeader.writeUInt16LE(compressionMethod, 8); // compression
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(compressedData.length, 18);
    localHeader.writeUInt32LE(uncompressedData.length, 22);
    localHeader.writeUInt16LE(filenameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28); // extra field length
    filenameBuf.copy(localHeader, 30);

    const localChunk = Buffer.concat([localHeader, compressedData]);
    localHeaders.push(localChunk);

    // 2. Central Directory Header
    const centralHeader = Buffer.alloc(46 + filenameBuf.length);
    centralHeader.writeUInt32LE(0x02014b50, 0); // signature
    centralHeader.writeUInt16LE(20, 4); // version made by
    centralHeader.writeUInt16LE(20, 6); // version needed
    centralHeader.writeUInt16LE(0, 8); // flags
    centralHeader.writeUInt16LE(compressionMethod, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(compressedData.length, 20);
    centralHeader.writeUInt32LE(uncompressedData.length, 24);
    centralHeader.writeUInt16LE(filenameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30); // extra field len
    centralHeader.writeUInt16LE(0, 32); // comment len
    centralHeader.writeUInt16LE(0, 34); // disk number start
    centralHeader.writeUInt16LE(0, 36); // internal attrs
    centralHeader.writeUInt32LE(0, 38); // external attrs
    centralHeader.writeUInt32LE(currentOffset, 42); // relative offset of local header
    filenameBuf.copy(centralHeader, 46);

    centralHeaders.push(centralHeader);
    currentOffset += localChunk.length;
  }

  const centralDirBuffer = Buffer.concat(centralHeaders);
  const centralDirSize = centralDirBuffer.length;
  const centralDirOffset = currentOffset;

  // 3. End of Central Directory Record
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // signature
  eocd.writeUInt16LE(0, 4); // disk number
  eocd.writeUInt16LE(0, 6); // disk with start of CD
  eocd.writeUInt16LE(entries.length, 8); // entries on disk
  eocd.writeUInt16LE(entries.length, 10); // total entries
  eocd.writeUInt32LE(centralDirSize, 12); // size of CD
  eocd.writeUInt32LE(centralDirOffset, 16); // offset of CD
  eocd.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([...localHeaders, centralDirBuffer, eocd]);
}

