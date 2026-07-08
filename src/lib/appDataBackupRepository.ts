import clientPromise from './mongodb';
import { getAppData, saveAppData } from './appDataRepository';
import type { AppData } from '../types';

const dbName = process.env.MONGODB_DB || 'pilates_studio';
const studioId = process.env.STUDIO_ID || 'default-studio';
const backupCollectionName = 'appDataBackups';

type AppDataBackupDocument = {
  _id: string;
  studioId: string;
  data: AppData;
  createdAt: Date;
  updatedAt: Date;
};

export type AppDataBackupStatus = {
  exists: boolean;
  updatedAt: string | null;
};

const getBackupCollection = async () => {
  const client = await clientPromise;
  return client.db(dbName).collection<AppDataBackupDocument>(backupCollectionName);
};

export async function getAppDataBackupStatus(): Promise<AppDataBackupStatus> {
  const collection = await getBackupCollection();
  const doc = await collection.findOne({ _id: studioId }, { projection: { updatedAt: 1 } });

  return {
    exists: Boolean(doc),
    updatedAt: doc?.updatedAt?.toISOString() || null,
  };
}

export async function createAppDataBackup(): Promise<AppDataBackupStatus> {
  const data = await getAppData();
  const collection = await getBackupCollection();
  const now = new Date();

  await collection.updateOne(
    { _id: studioId },
    {
      $set: { studioId, data, updatedAt: now },
      $setOnInsert: { _id: studioId, createdAt: now },
    },
    { upsert: true },
  );

  return {
    exists: true,
    updatedAt: now.toISOString(),
  };
}

export async function restoreAppDataBackup(): Promise<AppData> {
  const collection = await getBackupCollection();
  const doc = await collection.findOne({ _id: studioId });

  if (!doc) {
    throw new Error('Nincs mentett biztonsági másolat.');
  }

  return saveAppData(doc.data);
}
