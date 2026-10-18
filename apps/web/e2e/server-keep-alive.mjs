// Preloaded (NODE_OPTIONS=--import) into the app server the e2e run starts. Playwright's API
// client keeps its sockets open indefinitely while Node closes idle ones after 5 seconds: a
// request sent on a socket at the very moment the server closes it fails with ECONNRESET before
// reaching the app, which on a loaded machine happened about once per full run. With a long idle
// timeout on the server side the two never cross. Test infrastructure only.
import http from "node:http";

const createServer = http.createServer;
http.createServer = function (...args) {
  const server = createServer.apply(this, args);
  server.keepAliveTimeout = 120_000;
  // Must stay above keepAliveTimeout, or a slow first request on a reused socket times out.
  server.headersTimeout = 125_000;
  return server;
};
