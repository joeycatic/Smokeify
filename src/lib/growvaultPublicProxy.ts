import "server-only";

import { NextResponse } from "next/server";
import {
  GROWVAULT_ANALYZER_BRIDGE_REMOVAL_DATE,
  GROWVAULT_CUSTOMIZER_BRIDGE_REMOVAL_DATE,
  GROWVAULT_PUBLIC_URL,
  buildGrowvaultPublicUrl,
  logGrowvaultAnalyzerBridge,
  logGrowvaultCustomizerBridge,
} from "@/lib/growvaultPublicStorefront";

type GrowvaultBridgeSurface = "analyzer" | "customizer";

function getBridgeHeaders(surface: GrowvaultBridgeSurface) {
  if (surface === "customizer") {
    return {
      header: "x-smokeify-customizer-bridge",
      removalHeader: "x-smokeify-customizer-bridge-removal-date",
      removalDate: GROWVAULT_CUSTOMIZER_BRIDGE_REMOVAL_DATE,
    };
  }

  return {
    header: "x-smokeify-analyzer-bridge",
    removalHeader: "x-smokeify-analyzer-bridge-removal-date",
    removalDate: GROWVAULT_ANALYZER_BRIDGE_REMOVAL_DATE,
  };
}

function buildProxyHeaders(
  request: Request,
  target: URL,
  surface: GrowvaultBridgeSurface,
) {
  const bridgeHeaders = getBridgeHeaders(surface);
  const headers = new Headers(request.headers);
  headers.delete("content-length");
  headers.delete("host");
  headers.delete("x-forwarded-host");
  headers.delete("x-forwarded-proto");
  headers.set("origin", target.origin);
  headers.set("referer", buildGrowvaultPublicUrl("/"));
  headers.set(bridgeHeaders.header, "1");
  headers.set(bridgeHeaders.removalHeader, bridgeHeaders.removalDate);
  return headers;
}

export async function proxyGrowvaultPublicRequest(
  request: Request,
  pathnameOverride?: string,
  surface: GrowvaultBridgeSurface = "analyzer",
) {
  const sourceUrl = new URL(request.url);
  const targetUrl = new URL(
    pathnameOverride ?? sourceUrl.pathname,
    `${GROWVAULT_PUBLIC_URL}/`,
  );
  targetUrl.search = sourceUrl.search;

  const logBridge =
    surface === "customizer"
      ? logGrowvaultCustomizerBridge
      : logGrowvaultAnalyzerBridge;
  logBridge({
    sourcePath: sourceUrl.pathname,
    targetPath: targetUrl.pathname,
    method: request.method.toUpperCase(),
    mode: "proxy",
  });

  const method = request.method.toUpperCase();
  const body =
    method === "GET" || method === "HEAD"
      ? undefined
      : Buffer.from(await request.arrayBuffer());

  let upstream: Response;
  try {
    upstream = await fetch(targetUrl, {
      method,
      headers: buildProxyHeaders(request, targetUrl, surface),
      body,
      redirect: "manual",
      cache: "no-store",
    });
  } catch (error) {
    console.error(`Growvault ${surface} bridge failed`, error);
    return NextResponse.json(
      { error: `Growvault ${surface} bridge unavailable` },
      { status: 502 },
    );
  }

  const bridgeHeaders = getBridgeHeaders(surface);
  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.set(bridgeHeaders.header, "1");
  responseHeaders.set(bridgeHeaders.removalHeader, bridgeHeaders.removalDate);

  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}
