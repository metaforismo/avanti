/**
 * The archive ends with the ZIP end record (no comment, so exactly the last 22 bytes): anything
 * else is a download cut short, and saving it would hand the CAF a folder missing documents.
 */
export async function zipComplete(blob: Blob) {
  const end = new Uint8Array(await blob.slice(-22).arrayBuffer());
  const complete =
    blob.size >= 22 && end[0] === 0x50 && end[1] === 0x4b && end[2] === 0x05 && end[3] === 0x06;
  return complete
    ? null
    : "Lo ZIP è arrivato incompleto e non è stato salvato. Riprova; se succede ancora, scarica i documenti uno per uno.";
}
