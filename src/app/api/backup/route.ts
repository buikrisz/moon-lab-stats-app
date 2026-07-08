import { NextResponse } from 'next/server';
import {
  createAppDataBackup,
  getAppDataBackupStatus,
  restoreAppDataBackup,
} from '../../../lib/appDataBackupRepository';
import { requireSession, unauthorized } from '../../../lib/session';

const restorePin = process.env.BACKUP_RESTORE_PIN;

export async function GET(request: Request) {
  const session = requireSession(request);
  if (!session) return unauthorized();

  try {
    const status = await getAppDataBackupStatus();
    return NextResponse.json(status);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const session = requireSession(request);
  if (!session) return unauthorized();

  try {
    const status = await createAppDataBackup();
    return NextResponse.json(status);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  const session = requireSession(request);
  if (!session) return unauthorized();

  try {
    const payload = await request.json().catch(() => null);
    if (payload?.pin !== restorePin) {
      return NextResponse.json({ error: 'Hibás PIN kód.' }, { status: 403 });
    }

    const data = await restoreAppDataBackup();
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: message },
      { status: message.includes('Nincs mentett') ? 404 : 500 },
    );
  }
}
