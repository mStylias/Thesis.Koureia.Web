import type { ZipEntry } from './zip.types';

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

/** CRC-32 of a byte range, as the ZIP central directory records it. */
export function crc32(data: Uint8Array<ArrayBuffer>): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Grows as it is written to, so no entry has to be sized in advance. */
class ByteWriter {
  private buffer: Uint8Array<ArrayBuffer> = new Uint8Array(new ArrayBuffer(1024));
  private length = 0;

  private reserve(extra: number): void {
    if (this.length + extra <= this.buffer.length) {
      return;
    }
    let size = this.buffer.length * 2;
    while (size < this.length + extra) {
      size *= 2;
    }
    const grown = new Uint8Array(new ArrayBuffer(size));
    grown.set(this.buffer.subarray(0, this.length));
    this.buffer = grown;
  }

  get offset(): number {
    return this.length;
  }

  u16(value: number): void {
    this.reserve(2);
    this.buffer[this.length] = value & 0xff;
    this.buffer[this.length + 1] = (value >>> 8) & 0xff;
    this.length += 2;
  }

  u32(value: number): void {
    this.reserve(4);
    this.buffer[this.length] = value & 0xff;
    this.buffer[this.length + 1] = (value >>> 8) & 0xff;
    this.buffer[this.length + 2] = (value >>> 16) & 0xff;
    this.buffer[this.length + 3] = (value >>> 24) & 0xff;
    this.length += 4;
  }

  bytes(data: Uint8Array<ArrayBuffer>): void {
    this.reserve(data.length);
    this.buffer.set(data, this.length);
    this.length += data.length;
  }

  take(): Uint8Array<ArrayBuffer> {
    return this.buffer.slice(0, this.length);
  }
}

/** UTF-8 flag. Without it a non-ASCII path is read in the archive's codepage. */
const UTF8_FLAG = 0x0800;

/** A fixed timestamp: 1980-01-01, the earliest a DOS date can express. */
const DOS_TIME = 0;
const DOS_DATE = 0x0021;

/**
 * Builds the archive.
 *
 * The order of entries is the order given; `[Content_Types].xml` must come
 * first for a reader that streams the container.
 */
export function zipStored(entries: readonly ZipEntry[]): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder();
  const writer = new ByteWriter();
  const central: { name: Uint8Array<ArrayBuffer>; crc: number; size: number; offset: number }[] =
    [];

  for (const entry of entries) {
    const name = encoder.encode(entry.path);
    const crc = crc32(entry.data);
    const offset = writer.offset;
    writer.u32(0x04034b50);
    writer.u16(20);
    writer.u16(UTF8_FLAG);
    writer.u16(0);
    writer.u16(DOS_TIME);
    writer.u16(DOS_DATE);
    writer.u32(crc);
    writer.u32(entry.data.length);
    writer.u32(entry.data.length);
    writer.u16(name.length);
    writer.u16(0);
    writer.bytes(name);
    writer.bytes(entry.data);
    central.push({ name, crc, size: entry.data.length, offset });
  }

  const directoryOffset = writer.offset;
  for (const entry of central) {
    writer.u32(0x02014b50);
    writer.u16(20);
    writer.u16(20);
    writer.u16(UTF8_FLAG);
    writer.u16(0);
    writer.u16(DOS_TIME);
    writer.u16(DOS_DATE);
    writer.u32(entry.crc);
    writer.u32(entry.size);
    writer.u32(entry.size);
    writer.u16(entry.name.length);
    writer.u16(0);
    writer.u16(0);
    writer.u16(0);
    writer.u16(0);
    writer.u32(0);
    writer.u32(entry.offset);
    writer.bytes(entry.name);
  }
  const directorySize = writer.offset - directoryOffset;

  writer.u32(0x06054b50);
  writer.u16(0);
  writer.u16(0);
  writer.u16(central.length);
  writer.u16(central.length);
  writer.u32(directorySize);
  writer.u32(directoryOffset);
  writer.u16(0);

  return writer.take();
}
