import { app } from "@avanti/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const handler = (request: Request) => app.fetch(request);
export {
  handler as GET,
  handler as POST,
  handler as PUT,
  handler as PATCH,
  handler as DELETE,
  handler as HEAD,
  handler as OPTIONS,
};
