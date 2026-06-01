import crypto from 'crypto';
import { NextResponse } from 'next/server';

const stateCookie = 'moonlab_google_oauth_state';

const getBaseUrl = (request: Request) =>
  process.env.APP_URL || new URL(request.url).origin;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action') === 'bind' ? 'bind' : 'login';

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: 'Missing GOOGLE_CLIENT_ID env variable.' }, { status: 500 });
  }

  const state = `${action}:${crypto.randomBytes(16).toString('hex')}`;
  const redirectUri = `${getBaseUrl(request)}/api/auth/google/callback`;

  const googleUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  googleUrl.searchParams.set('client_id', clientId);
  googleUrl.searchParams.set('redirect_uri', redirectUri);
  googleUrl.searchParams.set('response_type', 'code');
  googleUrl.searchParams.set('scope', 'openid email profile');
  googleUrl.searchParams.set('prompt', 'select_account');
  googleUrl.searchParams.set('state', state);

  const response = NextResponse.redirect(googleUrl);
  response.cookies.set(stateCookie, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 10,
  });

  return response;
}
