import { NextResponse } from 'next/server';

// Email relay removed — no email provider configured.
export async function POST(): Promise<NextResponse> {
  return NextResponse.json({ error: 'Email relay not configured' }, { status: 503 });
}
