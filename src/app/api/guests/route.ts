import { NextResponse } from 'next/server';
import clientPromise from '../../../lib/mongodb';
import { requireSession, unauthorized } from '../../../lib/session';
import type { GuestRecord } from '../../../types/guest';

const dbName = process.env.MONGODB_DB || 'pilates_studio';
const studioId = process.env.STUDIO_ID || 'default-studio';

export async function GET(request: Request) {
  if (!requireSession(request)) return unauthorized();
  try {
    const client = await clientPromise;
    const guests = await client.db(dbName).collection<GuestRecord & { studioId: string }>('guests')
      .find({ studioId }, { projection: { _id: 0, studioId: 0 } }).sort({ registeredAt: -1 }).toArray();
    return NextResponse.json(guests);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Adatbázis hiba.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!requireSession(request)) return unauthorized();
  try {
    const body = await request.json() as { guests?: GuestRecord[] };
    if (!Array.isArray(body.guests) || body.guests.length > 10000) {
      return NextResponse.json({ error: 'Érvénytelen vagy túl nagy import.' }, { status: 400 });
    }
    const valid = body.guests.filter(g => g && String(g.guestId || '').trim() && g.source === 'guest-list');
    if (!valid.length) return NextResponse.json({ error: 'Nem található vendégazonosító az importban.' }, { status: 400 });
    const client = await clientPromise;
    const collection = client.db(dbName).collection('guests');
    await collection.createIndex({ studioId: 1, guestId: 1 }, { unique: true });
    const ops = valid.map(guest => {
      const { guestId, ...data } = guest;
      return { updateOne: { filter: { studioId, guestId: String(guestId).trim() }, update: { $set: { ...data, guestId: String(guestId).trim(), studioId, updatedAt: new Date() } }, upsert: true } };
    });
    const result = await collection.bulkWrite(ops, { ordered: false });
    return NextResponse.json({ received: valid.length, inserted: result.upsertedCount, updated: result.modifiedCount, matched: result.matchedCount });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Importálási hiba.' }, { status: 500 });
  }
}
