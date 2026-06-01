import { NextResponse } from 'next/server';
import { ensureAdminUser, verifyPassword } from '../../../../lib/authRepository';
import { setSessionCookie } from '../../../../lib/session';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    const user = await ensureAdminUser();
    const validUsername = username === user.username;
    const validPassword = typeof password === 'string' && verifyPassword(password, user);

    if (!validUsername || !validPassword) {
      return NextResponse.json({ error: 'Hibás felhasználónév vagy jelszó.' }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true, username: user.username, googleEmail: user.googleEmail || null });
    setSessionCookie(response, { username: user.username, loginMethod: 'password' });
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
