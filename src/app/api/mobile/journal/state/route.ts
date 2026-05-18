import { proxyGrowvaultPublicRequest } from "@/lib/growvaultPublicProxy";

export async function GET(request: Request) {
  return proxyGrowvaultPublicRequest(request);
}

export async function PUT(request: Request) {
  return proxyGrowvaultPublicRequest(request);
}
