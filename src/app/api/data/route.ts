import { NextResponse } from 'next/server';
import { getAppData, saveAppData } from '../../../lib/appDataRepository';
import type { AppData } from '../../../types';
import { requireSession, unauthorized } from '../../../lib/session';

export async function GET(request: Request) {
  const session = requireSession(request);
  if (!session) return unauthorized();

  try {
    const data = await getAppData();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const session = requireSession(request);
  if (!session) return unauthorized();

  try {
    const data = (await request.json()) as AppData;
    const saved = await saveAppData(data);
    return NextResponse.json(saved);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
