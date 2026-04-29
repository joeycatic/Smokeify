import { proxyGrowvaultPublicRequest } from "@/lib/growvaultPublicProxy";

export async function GET(request: Request) {
  return proxyGrowvaultPublicRequest(request, undefined, "customizer");
}
