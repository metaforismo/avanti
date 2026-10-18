import { crc32 } from "./zip";

export interface ReadEntry {
  name: string;
  data: Uint8Array;
  /** Central-directory extra field. */
  extra: Uint8Array;
  flags: number;
  method: number;
  date: number;
  time: number;
}

/**
 * Reads a stored-only ZIP the way an unzip tool does, from the central directory, and fails on
 * any inconsistency between it and the local headers. Tests only: the product never reads ZIPs.
 */
export function readZip(bytes: Uint8Array): ReadEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = bytes.length - 22;
  if (view.getUint32(end, true) !== 0x06054b50) throw new Error("No end of central directory");
  const count = view.getUint16(end + 10, true);
  const size = view.getUint32(end + 12, true);
  let at = view.getUint32(end + 16, true);
  if (at + size !== end) throw new Error("Central directory out of place");
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const entries: ReadEntry[] = [];
  for (let n = 0; n < count; n++) {
    if (view.getUint32(at, true) !== 0x02014b50) throw new Error("Bad central record");
    const flags = view.getUint16(at + 8, true);
    const method = view.getUint16(at + 10, true);
    const time = view.getUint16(at + 12, true);
    const date = view.getUint16(at + 14, true);
    const crc = view.getUint32(at + 16, true);
    const stored = view.getUint32(at + 20, true);
    const length = view.getUint32(at + 24, true);
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const extraField = bytes.slice(at + 46 + nameLength, at + 46 + nameLength + extraLength);
    const extra = extraLength + view.getUint16(at + 32, true);
    const offset = view.getUint32(at + 42, true);
    const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength));
    at += 46 + nameLength + extra;

    if (view.getUint32(offset, true) !== 0x04034b50) throw new Error("Bad local header");
    if (view.getUint32(offset + 14, true) !== crc) throw new Error("Local CRC differs");
    const localName = view.getUint16(offset + 26, true);
    const localExtra = view.getUint16(offset + 28, true);
    if (decoder.decode(bytes.subarray(offset + 30, offset + 30 + localName)) !== name)
      throw new Error("Local name differs");
    const start = offset + 30 + localName + localExtra;
    const data = bytes.slice(start, start + stored);
    if (stored !== length || data.length !== length) throw new Error("Size mismatch");
    if (crc32(data) !== crc) throw new Error("CRC mismatch");
    entries.push({ name, data, extra: extraField, flags, method, date, time });
  }
  return entries;
}
