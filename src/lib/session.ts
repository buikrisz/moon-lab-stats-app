import crypto from 'crypto';
import { NextResponse } from 'next/server';

export type SessionPayload = {
  username: string;
  loginMethod: 'password' | 'google';
  iat: number;
};

const cookieName = 'moonlab_session';
const maxAgeSeconds = 60 * 60 * 24 * 14;

const getSecret = () => process.env.AUTH_SECRET || 'dev-secret-change-me';

const base64url = (value: Buffer | string) =>
  Buffer.from(value).toString('base64url');

const sign = (payload: string) =>
  crypto.createHmac('sha256', getSecret()).update(payload).digest('base64url');

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

export const createSessionToken = (payload: Omit<SessionPayload, 'iat'>) => {
  const fullPayload: SessionPayload = { ...payload, iat: Date.now() };
  const encoded = base64url(JSON.stringify(fullPayload));
  return `${encoded}.${sign(encoded)}`;
};

export const verifySessionToken = (token?: string): SessionPayload | null => {
  if (!token) return null;
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return null;

  const expected = sign(encoded);
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);

  if (expectedBuffer.length !== signatureBuffer.length) return null;
  if (!crypto.timingSafeEqual(expectedBuffer, signatureBuffer)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
    if (Date.now() - payload.iat > maxAgeSeconds * 1000) return null;
    return payload;
  } catch {
    return null;
  }
};

export const getSessionFromRequest = (request: Request) => {
  const cookies = parseCookies(request.headers.get('cookie'));
  return verifySessionToken(cookies.get(cookieName));
};

export const setSessionCookie = (response: NextResponse, payload: Omit<SessionPayload, 'iat'>) => {
  response.cookies.set(cookieName, createSessionToken(payload), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: maxAgeSeconds,
  });
};

export const clearSessionCookie = (response: NextResponse) => {
  response.cookies.set(cookieName, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
};

export const unauthorized = () =>
  NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

export const requireSession = (request: Request) => {
  const session = getSessionFromRequest(request);
  if (!session) return null;
  return session;
};
