import { UPLOAD_LIMITS } from "@avanti/contracts";

const MAX_EDGE = 2400;
const JPEG_QUALITY = 0.85;
// Phone photos are usually 3–12 MB: shrink anything above this before upload.
const COMPRESS_ABOVE_BYTES = 1.5 * 1024 * 1024;

const EXTENSION_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heic",
};

export type PreparedUpload =
  | { ok: true; file: File }
  | { ok: false; reason: "unsupported_file" | "file_too_large" | "compress" };

function detectType(file: File) {
  if ((UPLOAD_LIMITS.mimeTypes as readonly string[]).includes(file.type)) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_TYPES[ext] ?? null;
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
  const type = detectType(file);
  if (!type) return { ok: false, reason: "unsupported_file" };

  let result = file;
  const isRaster = type.startsWith("image/");
  if (isRaster && file.size > COMPRESS_ABOVE_BYTES) {
    const shrunk = await shrinkImage(file);
    if (shrunk) result = shrunk;
    else if (file.size > UPLOAD_LIMITS.maxBytes) return { ok: false, reason: "compress" };
  }
  if (result.size > UPLOAD_LIMITS.maxBytes) return { ok: false, reason: "file_too_large" };
  if (result.size === 0) return { ok: false, reason: "unsupported_file" };
  return { ok: true, file: result };
}
