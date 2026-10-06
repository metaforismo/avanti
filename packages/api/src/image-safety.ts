import { ApiFailure } from "./security";
export const MAX_IMAGE_PIXELS = 40_000_000;
const invalid = () =>
  new ApiFailure(
    "unsupported_file",
    415,
    "L'immagine non è valida o è troppo grande. Carica una copia ridimensionata.",
  );

export function assertImageSafe(bytes: Uint8Array, mime: string) {
  if (!mime.startsWith("image/")) return;
  const b = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const dimensions: [number, number][] = [];
  try {
    if (mime === "image/png") {
      if (b.length < 33 || b.toString("ascii", 12, 16) !== "IHDR" || b.readUInt32BE(8) !== 13)
        throw invalid();
      dimensions.push([b.readUInt32BE(16), b.readUInt32BE(20)]);
    } else if (mime === "image/jpeg") {
      let at = 2;
      while (at + 4 <= b.length) {
        if (b[at++] !== 0xff) throw invalid();
        while (b[at] === 0xff) at++;
        const marker = b[at++]!;
        if (marker === 0xda || marker === 0xd9) break;
        if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
        const size = b.readUInt16BE(at);
        if (size < 2 || at + size > b.length) throw invalid();
        if (
          [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(
            marker,
          )
        ) {
          if (size < 8) throw invalid();
          dimensions.push([b.readUInt16BE(at + 5), b.readUInt16BE(at + 3)]);
        }
        at += size;
      }
    } else if (mime === "image/webp") {
      for (let at = 12; at + 8 <= b.length;) {
        const tag = b.toString("ascii", at, at + 4),
          size = b.readUInt32LE(at + 4),
          start = at + 8;
        if (start + size > b.length) throw invalid();
        if (tag === "ANIM" || tag === "ANMF") throw invalid();
        if (tag === "VP8X") {
          if (size < 10 || b[start]! & 2) throw invalid();
          dimensions.push([1 + b.readUIntLE(start + 4, 3), 1 + b.readUIntLE(start + 7, 3)]);
        } else if (tag === "VP8 ") {
          if (size < 10 || b.readUIntLE(start + 3, 3) !== 0x2a019d) throw invalid();
          dimensions.push([b.readUInt16LE(start + 6) & 0x3fff, b.readUInt16LE(start + 8) & 0x3fff]);
        } else if (tag === "VP8L") {
          if (size < 5 || b[start] !== 0x2f) throw invalid();
          const bits = b.readUInt32LE(start + 1);
          dimensions.push([(bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1]);
        }
        at = start + size + (size % 2);
      }
    } else if (mime === "image/heic") {
      // Walk BMFF container boxes; an arbitrary ispe string in image data is not a dimension.
      const walk = (start: number, end: number, depth: number) => {
        if (depth > 12) throw invalid();
        for (let at = start; at + 8 <= end;) {
          let size = b.readUInt32BE(at),
            header = 8;
          const tag = b.toString("ascii", at + 4, at + 8);
          if (size === 1) {
            size = Number(b.readBigUInt64BE(at + 8));
            header = 16;
          }
          if (size === 0) size = end - at;
          if (!Number.isSafeInteger(size) || size < header || at + size > end) throw invalid();
          if (tag === "ispe") {
            if (size < header + 12) throw invalid();
            dimensions.push([b.readUInt32BE(at + header + 4), b.readUInt32BE(at + header + 8)]);
          } else if (["meta", "iprp", "ipco"].includes(tag))
            walk(at + header + (tag === "meta" ? 4 : 0), at + size, depth + 1);
          at += size;
        }
      };
      walk(0, b.length, 0);
    }
  } catch {
    throw invalid();
  }
  if (
    !dimensions.length ||
    dimensions.some(
      ([w, h]) => w < 1 || h < 1 || w > 16384 || h > 16384 || w * h > MAX_IMAGE_PIXELS,
    )
  )
    throw invalid();
}
