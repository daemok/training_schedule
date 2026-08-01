import { NextRequest } from "next/server";

interface RequestOptions {
  method: string;
  cookie?: string;
  body?: unknown;
}

/** 라우트 핸들러를 직접 호출하는 테스트용 NextRequest를 만든다. */
export function makeRequest(url: string, options: RequestOptions): NextRequest {
  const headers: Record<string, string> = {};
  if (options.cookie) headers.cookie = options.cookie;
  if (options.body !== undefined) headers["content-type"] = "application/json";

  return new NextRequest(new URL(url, "http://localhost"), {
    method: options.method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
}
