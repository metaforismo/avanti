/**
 * A minimal ZIP writer (PKWARE APPNOTE 6.3.10, "stored" entries, UTF-8 names), streamed one file
 * at a time. Documents are already-compressed PDFs and photos: deflating them again would cost
 * CPU for almost no gain, and storing them keeps the writer small enough to own. The stream only
 * reads a file when the client has taken the previous one (high-water mark 0), so memory stays at
 * one file (4 MB at most) whatever the size of the archive, and nothing is ever written to disk
 * or storage: the archive cannot outlive the case it comes from.
 */

export interface ZipSource {
  name: string;
  modified: Date;
  /** Expected length: the archive's size is announced before any file is read. */
  size: number;
  read(signal: AbortSignal): Promise<Uint8Array>;
}

/** The bytes read are not the ones the case recorded: better no archive than a wrong one. */
export class ArchiveIntegrityError extends Error {
  override name = "ArchiveIntegrityError";
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

const romeParts = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Rome",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/**
 * MS-DOS date and time carry no time zone: the extracting computer shows them as local time.
 * The CAF works on Italian time, so the upload hour is written as it was in Rome.
 */
export function dosDateTime(at: Date) {
  const parts = Object.fromEntries(
    romeParts.formatToParts(at).map((part) => [part.type, Number(part.value)]),
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
const LOCAL_HEADER = 30;
const CENTRAL_RECORD = 46;
const END_RECORD = 22;
// Info-ZIP Unicode Path (0x7075): the same UTF-8 name for unzip tools that ignore bit 11.
const UNICODE_PATH_HEADER = 4 + 1 + 4;

const encoder = new TextEncoder();

interface Written {
  name: Uint8Array;
  extra: Uint8Array;
  crc: number;
  size: number;
  offset: number;
  date: number;
  time: number;
}

function unicodePath(name: Uint8Array) {
  const field = new DataView(new ArrayBuffer(UNICODE_PATH_HEADER));
  field.setUint16(0, 0x7075, true);
  field.setUint16(2, 1 + 4 + name.length, true);
  field.setUint8(4, 1);
  field.setUint32(5, crc32(name), true);
  return concat([new Uint8Array(field.buffer), name]);
}

/** The exact size of the archive {@link zipStream} writes for these entries. */
export function zipLength(sources: readonly Pick<ZipSource, "name" | "size">[]): number {
  let total = END_RECORD;
  for (const source of sources) {
    const name = encoder.encode(source.name).length;
    const extra = UNICODE_PATH_HEADER + name;
    total += LOCAL_HEADER + name + extra + source.size + CENTRAL_RECORD + name + extra;
  }
  return total;
}

function localHeader(entry: Written) {
  const header = new DataView(new ArrayBuffer(LOCAL_HEADER));
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
  header.setUint16(28, entry.extra.length, true);
  return concat([new Uint8Array(header.buffer), entry.name, entry.extra]);
}

function centralDirectory(entries: Written[], start: number) {
  const records = entries.map((entry) => {
    const record = new DataView(new ArrayBuffer(CENTRAL_RECORD));
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
    record.setUint16(30, entry.extra.length, true);
    // Comment, disk, internal and external attributes: all zero.
    record.setUint32(42, entry.offset, true);
    return concat([new Uint8Array(record.buffer), entry.name, entry.extra]);
  });
  const directory = concat(records);
  if (start + directory.length > MAX_U32) throw new Error("Archive too large");
  const end = new DataView(new ArrayBuffer(END_RECORD));
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

/**
 * Names must be unique and relative; the caller (the archive plan) guarantees both. Every file
 * must have the announced size, or the stream fails before writing it: the client then sees a
 * broken download, never a ZIP that silently lacks a document.
 */
export function zipStream(sources: readonly ZipSource[]): ReadableStream<Uint8Array> {
  if (sources.length > MAX_ENTRIES) throw new Error("Too many archive entries");
  if (zipLength(sources) > MAX_U32) throw new Error("Archive too large");
  const written: Written[] = [];
  const stop = new AbortController();
  let offset = 0;
  let next = 0;
  return new ReadableStream<Uint8Array>(
    {
      async pull(controller) {
        const source = sources[next++];
        if (!source) {
          controller.enqueue(centralDirectory(written, offset));
          controller.close();
          return;
        }
        const data = await source.read(stop.signal);
        if (data.length !== source.size)
          throw new ArchiveIntegrityError("Stored size differs from the recorded one");
        const name = encoder.encode(source.name);
        const entry: Written = {
          name,
          extra: unicodePath(name),
          crc: crc32(data),
          size: data.length,
          offset,
          ...dosDateTime(source.modified),
        };
        const header = localHeader(entry);
        written.push(entry);
        offset += header.length + data.length;
        controller.enqueue(header);
        controller.enqueue(data);
      },
      // The client went away: stop the storage read in flight instead of finishing it for no one.
      cancel() {
        stop.abort();
      },
    },
    { highWaterMark: 0 },
  );
}
