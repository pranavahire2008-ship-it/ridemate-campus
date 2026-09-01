import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";
import { sameOriginGuard } from "@/lib/api";

export const dynamic = "force-dynamic";
const AUTH_RESPONSE_HEADERS = { "Cache-Control": "no-store, max-age=0", Vary: "Cookie" };

export async function POST(request: Request) {
  const csrf = sameOriginGuard(request);
  if (csrf) return csrf;
  await destroySession();
  return NextResponse.json({ ok: true }, { headers: AUTH_RESPONSE_HEADERS });
}
