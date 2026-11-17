import { NextResponse } from "next/server";

import { CATALOG_READ_MESSAGE } from "@/lib/config";
import { isCatalogError, pickNext } from "@/lib/pool";
import { isLanguage, isMode, type INextRequest, type INextResponse } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = (await request.json()) as unknown;
  } catch {
    return json({ video: null, message: "The request couldn’t be read." }, 400);
  }

  const parsed = parseRequest(body);
  if (!parsed) return json({ video: null, message: "The distance or language is invalid." }, 400);

  try {
    const result = await pickNext(parsed);
    return json(result, 200);
  } catch (error) {
    console.error(error);
    if (isCatalogError(error)) return json({ video: null, message: CATALOG_READ_MESSAGE }, 500);
    return json({ video: null, message: "Something went wrong while finding a video." }, 500);
  }
}

function parseRequest(value: unknown): INextRequest | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  if (!isMode(body.mode) || !isLanguage(body.language)) return null;
  const parsed: INextRequest = { mode: body.mode, language: body.language };
  if (typeof body.currentVideoId === "string" && VIDEO_ID.test(body.currentVideoId)) {
    parsed.currentVideoId = body.currentVideoId;
  }
  return parsed;
}

function json(body: INextResponse, status: number) {
  return NextResponse.json(body, { status });
}
