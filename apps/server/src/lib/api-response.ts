import { NextResponse } from 'next/server';

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function jsonError(
  message: string,
  status = 400,
  extra?: { code?: string; hint?: string },
) {
  return NextResponse.json({ error: message, ...extra }, { status });
}
