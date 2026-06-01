import { NextResponse } from 'next/server';
import { bindGoogleEmail, getBoundGoogleEmail } from '../../../../lib/authRepository';
import { getSessionFromRequest, setSessionCookie } from '../../../../lib/session';

const stateCookie = 'moonlab_google_oauth_state';

const parseCookies = (cookieHeader: string | null) => {
  const cookies = new Map<string, string>();
  if (!cookieHeader) return cookies;

  cookieHeader.split(';').forEach(part => {
    const [rawKey, ...rest] = part.trim().split('=');
    if (!rawKey) return;
    cookies.set(rawKey, decodeURIComponent(rest.join('=')));
  });

  return cookies;
};

const getBaseUrl = (request: Request) =>
  process.env.APP_URL || new URL(request.url).origin;

const redirectWithMessage = (request: Request, message: string) => {
  const response = NextResponse.redirect(`${getBaseUrl(request)}/dashboard?authMessage=${encodeURIComponent(message)}`);
  response.cookies.set(stateCookie, '', { path: '/', maxAge: 0 });
  return response;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  const cookies = parseCookies(request.headers.get('cookie'));
  const expectedState = cookies.get(stateCookie);

  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectWithMessage(request, 'Google belépés sikertelen: érvénytelen state.');
  }

  const [action] = state.split(':');
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return redirectWithMessage(request, 'Google belépés nincs beállítva a Vercel env változókban.');
  }

  try {
    const redirectUri = `${getBaseUrl(request)}/api/auth/google/callback`;
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      return redirectWithMessage(request, 'Google token csere sikertelen.');
    }

    const tokenData = await tokenRes.json() as { id_token?: string };
    if (!tokenData.id_token) {
      return redirectWithMessage(request, 'Google nem adott id tokent.');
    }

    const infoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(tokenData.id_token)}`);
    if (!infoRes.ok) {
      return redirectWithMessage(request, 'Google token ellenőrzés sikertelen.');
    }

    const info = await infoRes.json() as { email?: string; email_verified?: string | boolean; aud?: string };
    const email = info.email?.toLowerCase();
    const verified = info.email_verified === true || info.email_verified === 'true';

    if (!email || !verified || info.aud !== clientId) {
      return redirectWithMessage(request, 'A Google fiók email címe nem ellenőrzött.');
    }

    if (action === 'bind') {
      const session = getSessionFromRequest(request);
      if (!session) return redirectWithMessage(request, 'Gmail összekötéshez előbb jelentkezz be jelszóval.');
      await bindGoogleEmail(email);
      const response = NextResponse.redirect(`${getBaseUrl(request)}/beallitasok?authMessage=${encodeURIComponent('Gmail összekötve: ' + email)}`);
      response.cookies.set(stateCookie, '', { path: '/', maxAge: 0 });
      return response;
    }

    const boundEmail = await getBoundGoogleEmail();
    if (!boundEmail || boundEmail !== email) {
      return redirectWithMessage(request, 'Ez a Gmail cím nincs hozzákötve az admin fiókhoz.');
    }

    const response = NextResponse.redirect(`${getBaseUrl(request)}/dashboard`);
    response.cookies.set(stateCookie, '', { path: '/', maxAge: 0 });
    setSessionCookie(response, { username: 'moonlab', loginMethod: 'google' });
    return response;
  } catch (error) {
    return redirectWithMessage(request, error instanceof Error ? error.message : 'Google belépés sikertelen.');
  }
}
