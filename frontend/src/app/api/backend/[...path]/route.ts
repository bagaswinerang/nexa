import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const METHODS = ["GET", "POST", "PUT", "DELETE", "OPTIONS"] as const;

async function proxy(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const backendUrl = process.env.NEXA_BACKEND_URL?.replace(/\/$/, "");
  if (!backendUrl) {
    return NextResponse.json(
      {
        error: "Nexa API is not configured.",
        code: "BACKEND_NOT_CONFIGURED",
      },
      { status: 503 },
    );
  }

  const { path } = await context.params;
  const target = new URL(`${backendUrl}/${path.map(encodeURIComponent).join("/")}`);
  target.search = request.nextUrl.search;

  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  const authorization = request.headers.get("authorization");
  const requestId = request.headers.get("x-request-id");
  if (contentType) headers.set("content-type", contentType);
  if (authorization) headers.set("authorization", authorization);
  if (requestId) headers.set("x-request-id", requestId);

  try {
    const response = await fetch(target, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer(),
      cache: "no-store",
      signal: AbortSignal.timeout(35_000),
    });
    return new NextResponse(response.body, {
      status: response.status,
      headers: {
        "content-type": response.headers.get("content-type") || "application/json",
        "x-request-id": response.headers.get("x-request-id") || "",
      },
    });
  } catch (error) {
    console.error("[Nexa API proxy] upstream request failed", error);
    return NextResponse.json(
      {
        error: "Nexa API is temporarily unavailable.",
        code: "BACKEND_UNAVAILABLE",
      },
      { status: 503 },
    );
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
