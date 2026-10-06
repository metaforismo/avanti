const { parentPort, workerData } = require("node:worker_threads");
const { PDFDocument } = require(workerData.modulePath);

parentPort.on("message", async (bytes) => {
  try {
    const pdf = await PDFDocument.load(bytes);
    parentPort.postMessage({ pages: pdf.getPageCount() });
  } catch {
    parentPort.postMessage({ invalid: true });
  }
});
