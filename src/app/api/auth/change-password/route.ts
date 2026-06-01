import { NextResponse } from 'next/server';
import { changeAdminPassword, ensureAdminUser, verifyPassword } from '../../../../lib/authRepository';
import { requireSession, unauthorized } from '../../../../lib/session';

export async function POST(request: Request) {
  const session = requireSession(request);
  if (!session) return unauthorized();

  try {
    const { currentPassword, newPassword } = await request.json();

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      return NextResponse.json({ error: 'Az új jelszó legyen legalább 6 karakter.' }, { status: 400 });
    }

    const user = await ensureAdminUser();
    const currentOk = typeof currentPassword === 'string' && verifyPassword(currentPassword, user);
    if (!currentOk) {
      return NextResponse.json({ error: 'A jelenlegi jelszó nem jó.' }, { status: 401 });
    }

    await changeAdminPassword(newPassword);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
