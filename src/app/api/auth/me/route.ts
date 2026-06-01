import { NextResponse } from 'next/server';
import { getAdminUser } from '../../../../lib/authRepository';
import { getSessionFromRequest } from '../../../../lib/session';

export async function GET(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session) return NextResponse.json({ authenticated: false });

  const user = await getAdminUser();
  return NextResponse.json({
    authenticated: true,
    username: user.username,
    googleEmail: user.googleEmail || null,
    loginMethod: session.loginMethod,
  });
}
