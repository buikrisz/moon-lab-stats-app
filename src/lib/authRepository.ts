import crypto from 'crypto';
import clientPromise from './mongodb';

export type AdminUser = {
  _id: 'admin';
  username: 'moonlab';
  passwordHash: string;
  passwordSalt: string;
  googleEmail?: string;
  updatedAt: string;
};

const dbName = process.env.MONGODB_DB || 'pilates_studio';

const hashPassword = (password: string, salt: string) =>
  crypto.scryptSync(password, salt, 64).toString('hex');

export const createPasswordHash = (password: string) => {
  const salt = crypto.randomBytes(16).toString('hex');
  return { passwordSalt: salt, passwordHash: hashPassword(password, salt) };
};

export const verifyPassword = (password: string, user: AdminUser) => {
  const actual = Buffer.from(hashPassword(password, user.passwordSalt), 'hex');
  const expected = Buffer.from(user.passwordHash, 'hex');
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
};

const getCollection = async () => {
  const client = await clientPromise;
  return client.db(dbName).collection<AdminUser>('auth_users');
};

export const ensureAdminUser = async () => {
  const collection = await getCollection();
  const existing = await collection.findOne({ _id: 'admin' });
  if (existing) return existing;

  const initialPassword = process.env.INITIAL_ADMIN_PASSWORD || crypto.randomBytes(18).toString('base64url');
  const password = createPasswordHash(initialPassword);
  const user: AdminUser = {
    _id: 'admin',
    username: 'moonlab',
    ...password,
    updatedAt: new Date().toISOString(),
  };

  await collection.insertOne(user);
  return user;
};

export const getAdminUser = async () => ensureAdminUser();

export const changeAdminPassword = async (newPassword: string) => {
  const collection = await getCollection();
  const password = createPasswordHash(newPassword);
  await collection.updateOne(
    { _id: 'admin' },
    { $set: { ...password, updatedAt: new Date().toISOString() } },
    { upsert: false },
  );
};

export const bindGoogleEmail = async (email: string) => {
  const collection = await getCollection();
  await ensureAdminUser();
  await collection.updateOne(
    { _id: 'admin' },
    { $set: { googleEmail: email.toLowerCase(), updatedAt: new Date().toISOString() } },
  );
};

export const getBoundGoogleEmail = async () => {
  const user = await ensureAdminUser();
  return user.googleEmail?.toLowerCase();
};
