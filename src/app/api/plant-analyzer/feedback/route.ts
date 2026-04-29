import { proxyGrowvaultPublicRequest } from "@/lib/growvaultPublicProxy";

export async function POST(request: Request) {
  return proxyGrowvaultPublicRequest(request);
}
