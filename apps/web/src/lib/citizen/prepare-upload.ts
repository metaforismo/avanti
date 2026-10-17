import { UPLOAD_LIMITS } from "@avanti/contracts/constants";

const MAX_EDGE = 2400;
const JPEG_QUALITY = 0.85;
// Phone photos are usually 3–12 MB: shrink anything above this before upload.
const COMPRESS_ABOVE_BYTES = 1.5 * 1024 * 1024;

export type PreparedUpload =
  | { ok: true; file: File }
  | { ok: false; reason: "unsupported_file" | "file_too_large" | "compress" };

const ascii = (bytes: Uint8Array, start: number, end: number) =>
  String.fromCharCode(...bytes.subarray(start, end));

/**
 * The type from the first bytes, with the same signatures the server checks. The server refuses
 * a file whose declared type differs from its content, and phones often declare the wrong one:
 * iPhone HEIF as image/heif, PNG screenshots renamed .jpg by chat apps, PDFs as x-pdf.
 */
export function sniffType(bytes: Uint8Array): (typeof UPLOAD_LIMITS.mimeTypes)[number] | null {
  if (ascii(bytes, 0, 5) === "%PDF-") return "application/pdf";
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b)) return "image/png";
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") return "image/webp";
  if (
    ascii(bytes, 4, 8) === "ftyp" &&
    ["heic", "heix", "hevc", "hevx", "mif1"].includes(ascii(bytes, 8, 12))
  )
    return "image/heic";
  return null;
}

async function shrinkImage(file: File): Promise<File | null> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return null; // e.g. HEIC on browsers that cannot decode it
  }
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.fillStyle = "#fff"; // transparent PNG areas would otherwise turn black in JPEG
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
  );
  if (!blob) return null;
  const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], name, { type: "image/jpeg", lastModified: file.lastModified });
}

/** Validate type, downscale large photos, and enforce the server size limit client-side. */
export async function prepareUpload(file: File): Promise<PreparedUpload> {
  if (file.size === 0) return { ok: false, reason: "unsupported_file" };
  const type = sniffType(new Uint8Array(await file.slice(0, 12).arrayBuffer()));
  if (!type) return { ok: false, reason: "unsupported_file" };

  let result =
    file.type === type
      ? file
      : new File([file], file.name, { type, lastModified: file.lastModified });
  const isRaster = type.startsWith("image/");
  if (isRaster && file.size > COMPRESS_ABOVE_BYTES) {
    const shrunk = await shrinkImage(result);
    if (shrunk) result = shrunk;
    else if (file.size > UPLOAD_LIMITS.maxBytes) return { ok: false, reason: "compress" };
  }
  if (result.size > UPLOAD_LIMITS.maxBytes) return { ok: false, reason: "file_too_large" };
  return { ok: true, file: result };
}
