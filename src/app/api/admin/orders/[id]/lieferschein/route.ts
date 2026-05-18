import { GET as getBeilegschein } from "../beilegschein/route";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return getBeilegschein(request, context);
}
