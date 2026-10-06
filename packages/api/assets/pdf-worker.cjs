const { parentPort, workerData } = require("node:worker_threads");
const { PDFDocument, PDFDict, PDFArray, PDFName, PDFStream } = require(workerData.modulePath);

parentPort.on("message", async (bytes) => {
  try {
    const pdf = await PDFDocument.load(bytes);
    const forbidden = new Set([
      "JS",
      "JavaScript",
      "EmbeddedFiles",
      "EmbeddedFile",
      "EF",
      "Filespec",
      "Launch",
      "RichMedia",
      "XFA",
      "OpenAction",
      "AA",
      "SubmitForm",
      "ImportData",
      "GoToR",
    ]);
    const seen = new Set();
    function inspect(object) {
      if (seen.has(object)) return;
      seen.add(object);
      if (object instanceof PDFName && forbidden.has(object.decodeText()))
        throw new Error("Active PDF");
      if (object instanceof PDFStream) inspect(object.dict);
      else if (object instanceof PDFDict)
        for (const [key, value] of object.entries()) {
          inspect(key);
          inspect(value);
        }
      else if (object instanceof PDFArray) for (const value of object.asArray()) inspect(value);
    }
    for (const [, object] of pdf.context.enumerateIndirectObjects()) inspect(object);
    const pages = pdf.getPageCount();
    if (pages > 300) throw new Error("Page limit");
    parentPort.postMessage({ pages });
  } catch {
    parentPort.postMessage({ invalid: true });
  }
});
