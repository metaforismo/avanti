import { after } from "next/server";
import { app, configureRuntimeBackground } from "@avanti/api";

configureRuntimeBackground(after);

// The same Hono app as every other API path; only this route may stream for longer: a case can
// hold 120 MB of originals and a slow office connection should still get all of them.
export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";
const handler = (request: Request) => app.fetch(request);
export { handler as GET, handler as HEAD };
