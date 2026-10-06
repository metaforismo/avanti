const { Worker } = require("node:worker_threads");

exports.createPdfWorker = (path, options) => new Worker(path, options);
