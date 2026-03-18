import { NextResponse } from "next/server";

type PerfPayload =
  | {
      kind: "web-vital";
      name: string;
      value: number;
      rating: string;
      id: string;
      path: string;
      navigationType?: string;
    }
  | {
      kind: "page-resources";
      path: string;
      htmlTransferSize: number;
      staticTransferSize: number;
      scriptTransferSize: number;
      stylesheetTransferSize: number;
      scriptResourceCount: number;
      stylesheetResourceCount: number;
    };

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as PerfPayload | null;
  if (!payload) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  console.info("[perf:client]", JSON.stringify(payload));
  return new NextResponse(null, { status: 204 });
}
