/**
 * A minimal ZIP writer (PKWARE APPNOTE 6.3.10, "stored" entries, UTF-8 names), streamed one file
 * at a time. Documents are already-compressed PDFs and photos: deflating them again would cost
 * CPU for almost no gain, and storing them keeps the writer small enough to own. Memory stays at
 * one file (4 MB at most) whatever the size of the archive, and nothing is ever written to disk
 * or storage: the archive cannot outlive the case it comes from.
 */

export interface ZipSource {
  name: string;
  modified: Date;
  read(): Promise<Uint8Array>;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * MS-DOS date and time carry no time zone: the extracting computer shows them as local time.
 * The CAF works on Italian time, so the upload hour is written as it was in Rome.
 */
export function dosDateTime(at: Date, timeZone = "Europe/Rome") {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(at)
      .map((part) => [part.type, Number(part.value)]),
  ) as Record<"year" | "month" | "day" | "hour" | "minute" | "second", number>;
  // DOS dates start in 1980.
  const year = Math.min(Math.max(parts.year, 1980), 2107);
  return {
    date: ((year - 1980) << 9) | (parts.month << 5) | parts.day,
    time: (parts.hour << 11) | (parts.minute << 5) | Math.floor(parts.second / 2),
  };
}

const UTF8_NAMES = 0x0800;
const VERSION = 20;
const MAX_U32 = 0xffffffff;
const MAX_ENTRIES = 0xffff;

interface Written {
  name: Uint8Array;
  crc: number;
  size: number;
  offset: number;
  date: number;
  time: number;
}

function localHeader(entry: Written) {
  const header = new DataView(new ArrayBuffer(30));
  header.setUint32(0, 0x04034b50, true);
  header.setUint16(4, VERSION, true);
  header.setUint16(6, UTF8_NAMES, true);
  header.setUint16(8, 0, true);
  header.setUint16(10, entry.time, true);
  header.setUint16(12, entry.date, true);
  header.setUint32(14, entry.crc, true);
  header.setUint32(18, entry.size, true);
  header.setUint32(22, entry.size, true);
  header.setUint16(26, entry.name.length, true);
  header.setUint16(28, 0, true);
  return concat([new Uint8Array(header.buffer), entry.name]);
}

function centralDirectory(entries: Written[], start: number) {
  const records = entries.map((entry) => {
    const record = new DataView(new ArrayBuffer(46));
    record.setUint32(0, 0x02014b50, true);
    record.setUint16(4, VERSION, true);
    record.setUint16(6, VERSION, true);
    record.setUint16(8, UTF8_NAMES, true);
    record.setUint16(10, 0, true);
    record.setUint16(12, entry.time, true);
    record.setUint16(14, entry.date, true);
    record.setUint32(16, entry.crc, true);
    record.setUint32(20, entry.size, true);
    record.setUint32(24, entry.size, true);
    record.setUint16(28, entry.name.length, true);
    // Extra field, comment, disk, internal and external attributes: all zero.
    record.setUint32(42, entry.offset, true);
    return concat([new Uint8Array(record.buffer), entry.name]);
  });
  const directory = concat(records);
  if (start + directory.length > MAX_U32) throw new Error("Archive too large");
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, directory.length, true);
  end.setUint32(16, start, true);
  return concat([directory, new Uint8Array(end.buffer)]);
}

function concat(chunks: Uint8Array[]) {
  const out = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}

/** Names must be unique and relative; the caller (the archive plan) guarantees both. */
export function zipStream(sources: readonly ZipSource[]): ReadableStream<Uint8Array> {
  if (sources.length > MAX_ENTRIES) throw new Error("Too many archive entries");
  const encoder = new TextEncoder();
  const written: Written[] = [];
  let offset = 0;
  let next = 0;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const source = sources[next++];
      if (!source) {
        controller.enqueue(centralDirectory(written, offset));
        controller.close();
        return;
      }
      const data = await source.read();
      const name = encoder.encode(source.name);
      if (name.length > 0xffff) throw new Error("Archive entry name too long");
      const entry: Written = {
        name,
        crc: crc32(data),
        size: data.length,
        offset,
        ...dosDateTime(source.modified),
      };
      const header = localHeader(entry);
      if (offset + header.length + data.length > MAX_U32) throw new Error("Archive too large");
      written.push(entry);
      offset += header.length + data.length;
      controller.enqueue(header);
      controller.enqueue(data);
    },
  });
}
