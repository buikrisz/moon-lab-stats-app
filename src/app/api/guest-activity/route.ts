import { NextResponse } from 'next/server';
import clientPromise from '../../../lib/mongodb';
import { requireSession, unauthorized } from '../../../lib/session';
import type { GuestActivityImport, GuestPurchase, GuestVisit } from '../../../types/guest';

const dbName = process.env.MONGODB_DB || 'pilates_studio';
const studioId = process.env.STUDIO_ID || 'default-studio';

export async function GET(request: Request) {
  if (!requireSession(request)) return unauthorized();
  try {
    const client = await clientPromise;
    const db = client.db(dbName);
    const [visits, purchases, imports] = await Promise.all([
      db.collection<GuestVisit & { studioId: string }>('guestAttendance')
        .find({ studioId }, { projection: { _id: 0, studioId: 0 } }).sort({ startsAt: -1 }).toArray(),
      db.collection<GuestPurchase & { studioId: string }>('guestPurchases')
        .find({ studioId }, { projection: { _id: 0, studioId: 0 } }).sort({ purchasedAt: -1 }).toArray(),
      db.collection<GuestActivityImport & { studioId: string }>('guestActivityImports')
        .find({ studioId }, { projection: { _id: 0, studioId: 0 } }).sort({ periodEnd: -1 }).toArray(),
    ]);
    return NextResponse.json({ visits, purchases, imports });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Adatbázis hiba.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!requireSession(request)) return unauthorized();
  try {
    const body = await request.json() as {
      visits?: GuestVisit[]; purchases?: GuestPurchase[]; sources?: Record<string, string>;
      reportPeriod?: { fileName?: string; startDate?: string; endDate?: string } | null;
    };
    const visits = Array.isArray(body.visits) ? body.visits : [];
    const purchases = Array.isArray(body.purchases) ? body.purchases : [];
    if (visits.length + purchases.length > 10000) return NextResponse.json({ error: 'Túl nagy import.' }, { status: 400 });
    if (!visits.length && !purchases.length) return NextResponse.json({ error: 'Nem található importálható óra vagy vásárlás.' }, { status: 400 });
    if (visits.some(v => !v.eventId || !v.guestId || v.source !== 'attendance-export') || purchases.some(p => !p.purchaseId || !p.guestId || p.source !== 'attendance-export')) {
      return NextResponse.json({ error: 'Érvénytelen import sor.' }, { status: 400 });
    }
    const client = await clientPromise;
    const db = client.db(dbName);
    const attendance = db.collection('guestAttendance');
    const sales = db.collection('guestPurchases');
    await Promise.all([
      attendance.createIndex({ studioId: 1, eventId: 1 }, { unique: true }),
      sales.createIndex({ studioId: 1, purchaseId: 1 }, { unique: true }),
    ]);
    const [visitResult, purchaseResult] = await Promise.all([
      visits.length ? attendance.bulkWrite(visits.map(visit => ({ updateOne: {
        filter: { studioId, eventId: visit.eventId }, update: { $set: { ...visit, studioId } }, upsert: true,
      } })), { ordered: false }) : Promise.resolve(null),
      purchases.length ? sales.bulkWrite(purchases.map(purchase => ({ updateOne: {
        filter: { studioId, purchaseId: purchase.purchaseId }, update: { $set: { ...purchase, studioId } }, upsert: true,
      } })), { ordered: false }) : Promise.resolve(null),
    ]);
    const sources = Object.entries(body.sources || {}).filter(([id]) => id.trim());
    if (sources.length) {
      const guestCollection = db.collection('guests');
      await guestCollection.bulkWrite(sources.map(([guestId, registrationSource]) => {
        const source = registrationSource.trim();
        return { updateOne: {
        filter: { studioId, guestId: guestId.trim() }, update: {
          $set: { ...(source ? { registrationSource: source } : {}), updatedAt: new Date() },
          $setOnInsert: { studioId, guestId: guestId.trim(), lastName: '', firstName: '', nickname: '', registeredAt: null, firstVisitAt: null, lastVisitAt: null, courses: [], activeMembership: '', source: 'attendance-import' },
        }, upsert: true,
      } } }), { ordered: false });
    }
    const period = body.reportPeriod;
    const isValidPeriod = Boolean(period?.startDate && period?.endDate && /^\d{4}-\d{2}-\d{2}$/.test(period.startDate) && /^\d{4}-\d{2}-\d{2}$/.test(period.endDate) && period.startDate <= period.endDate);
    if (isValidPeriod && period?.startDate && period.endDate) {
      const importId = `${period.startDate}_${period.endDate}`;
      const importCollection = db.collection('guestActivityImports');
      await importCollection.createIndex({ studioId: 1, importId: 1 }, { unique: true });
      await importCollection.updateOne(
        { studioId, importId },
        { $set: { studioId, importId, fileName: period.fileName || '', periodStart: period.startDate, periodEnd: period.endDate, visitsCount: visits.length, purchasesCount: purchases.length, importedAt: new Date().toISOString() } },
        { upsert: true },
      );
    }
    return NextResponse.json({
      visits: visits.length, newVisits: visitResult?.upsertedCount || 0,
      purchases: purchases.length, newPurchases: purchaseResult?.upsertedCount || 0,
      sourcesLinked: sources.length,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Importálási hiba.' }, { status: 500 });
  }
}
