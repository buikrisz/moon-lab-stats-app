import { NextResponse } from 'next/server';
import clientPromise from '../../../lib/mongodb';
import { requireSession, unauthorized } from '../../../lib/session';

const dbName = process.env.MONGODB_DB || 'pilates_studio';
const studioId = process.env.STUDIO_ID || 'default-studio';

const defaultFamilyIds = [
  '551358', '484477', '605496', '474130', '485928', '614557', '486392', '548509', '476635',
  '563839', '481493', '478798', '484484', '480039', '479911', '491966', '551360',
];
const defaultInfluencerIds = ['515155', '508816', '501955', '500569', '496631'];

type SegmentSettings = {
  _id: string;
  familyIds: string[];
  influencerIds: string[];
  updatedAt: Date;
};

const settingsCollection = async () => {
  const client = await clientPromise;
  return client.db(dbName).collection<SegmentSettings>('guestSegmentSettings');
};

export async function GET(request: Request) {
  if (!requireSession(request)) return unauthorized();
  try {
    const collection = await settingsCollection();
    try {
      await collection.updateOne(
        { _id: studioId },
        { $setOnInsert: { familyIds: defaultFamilyIds, influencerIds: defaultInfluencerIds, updatedAt: new Date() } },
        { upsert: true },
      );
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
    }
    const settings = await collection.findOne({ _id: studioId });
    return NextResponse.json({ familyIds: settings?.familyIds || [], influencerIds: settings?.influencerIds || [] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Nem sikerült betölteni a csoportlistákat.' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!requireSession(request)) return unauthorized();
  try {
    const body = await request.json() as { familyIds?: unknown; influencerIds?: unknown };
    const cleanIds = (value: unknown) => {
      if (!Array.isArray(value) || value.length > 1000) return null;
      const ids = value.map(item => String(item ?? '').trim());
      if (ids.some(id => !/^[a-zA-Z0-9_-]{1,40}$/.test(id))) return null;
      return [...new Set(ids)];
    };
    const familyIds = cleanIds(body.familyIds);
    const influencerIds = cleanIds(body.influencerIds);
    if (!familyIds || !influencerIds) {
      return NextResponse.json({ error: 'Érvénytelen vendég ID a család- vagy influencerlistában.' }, { status: 400 });
    }
    const collection = await settingsCollection();
    await collection.updateOne(
      { _id: studioId },
      { $set: { familyIds, influencerIds, updatedAt: new Date() } },
      { upsert: true },
    );
    return NextResponse.json({ familyIds, influencerIds });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Nem sikerült menteni a csoportlistákat.' }, { status: 500 });
  }
}
