import { NextResponse } from "next/server";
import { redactLogText } from "./storage";

export function errorResponse(error: unknown, status = 500) {
  const message = redactLogText(error instanceof Error ? error.message : "Unexpected local server error.").slice(0, 600);
  return NextResponse.json({ error: message }, { status });
}

export async function jsonBody(request: Request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
