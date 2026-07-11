import clientPromise from './mongodb';
import type { AppData } from '../types';
import { normalizeWeekDates } from '../utils/date';

const dbName = process.env.MONGODB_DB || 'pilates_studio';
const studioId = process.env.STUDIO_ID || 'default-studio';

const initialAppData: AppData = {
  weeks: [],
  passes: [],
  calendarEvents: [],
  expenses: [
    { id: 'exp-rent', name: 'Bérleti díj', category: 'Bérlet', amount: 350000, recurrence: 'monthly', month: 'Minden hónap', active: true, expenseType: 'fixed' },
    { id: 'exp-clean', name: 'Tisztítószerek', category: 'Üzemeltetés', amount: 10000, recurrence: 'monthly', month: 'Minden hónap', active: true, expenseType: 'fixed' },
    { id: 'exp-motibro', name: 'Motibro', category: 'Szoftver', amount: 21070, recurrence: 'monthly', month: 'Minden hónap', active: true, expenseType: 'fixed' },
  ],
  settings: {
    studioName: 'Moon Lab Pilates',
    trainerHourlyCost: 8000,
    fullHourTrainerCost: 10000,
    maxParticipantsPerClass: 6,
    currency: 'HUF',
    variableExpenseCategories: ['Számlázz.hu', 'Hirdetés', 'Rezsi'],
  },
};

function normalizeExpenses(expenses: AppData['expenses']): AppData['expenses'] {
  const normalized = expenses.map(expense => {
    if (expense.baseExpenseId) {
      return { ...expense, recurrence: 'one-time' as const, active: expense.active !== false, expenseType: 'fixed' as const };
    }

    if (!expense.year && (
      ['exp-rent', 'exp-clean', 'exp-motibro'].includes(expense.id) ||
      /bérlet|bérleti|tisztító|motibro/i.test(expense.name)
    )) {
      return { ...expense, recurrence: 'monthly' as const, month: 'Minden hónap', active: true, expenseType: 'fixed' as const };
    }
    return { ...expense, active: expense.active !== false };
  });

  const ensureFixed = (id: string, name: string, category: string, amount: number) => {
    if (!normalized.some(e => e.id === id || e.name === name)) {
      normalized.push({ id, name, category, amount, recurrence: 'monthly', month: 'Minden hónap', active: true, expenseType: 'fixed' });
    }
  };

  ensureFixed('exp-rent', 'Bérleti díj', 'Bérlet', 350000);
  ensureFixed('exp-clean', 'Tisztítószerek', 'Üzemeltetés', 10000);
  ensureFixed('exp-motibro', 'Motibro', 'Szoftver', 21070);

  return normalized;
}

function normalizeWeeks(weeks: AppData['weeks']): AppData['weeks'] {
  return weeks.map(week => {
    const normalizedWeek = normalizeWeekDates(week);
    return {
      ...normalizedWeek,
      extraRevenues: normalizedWeek.extraRevenues || [],
      days: normalizedWeek.days.map(day => ({
        ...day,
        specialTrainerCosts: day.specialTrainerCosts || [],
        extraRevenues: day.extraRevenues || [],
      })),
    };
  });
}

function normalizeAppData(data: AppData): AppData {
  return {
    ...data,
    calendarEvents: data.calendarEvents || [],
    settings: {
      ...data.settings,
      studioName: data.settings.studioName || 'Moon Lab Pilates',
      fullHourTrainerCost: data.settings.fullHourTrainerCost || 10000,
      variableExpenseCategories: data.settings.variableExpenseCategories?.length ? data.settings.variableExpenseCategories : ['Számlázz.hu', 'Hirdetés', 'Rezsi'],
    },
    expenses: normalizeExpenses(data.expenses),
    weeks: normalizeWeeks(data.weeks),
  };
}

export async function getAppData(): Promise<AppData> {
  const client = await clientPromise;
  const collection = client.db(dbName).collection('appData');
  const doc = await collection.findOne<{ studioId: string; data: AppData }>({ studioId });

  if (!doc) {
    await collection.insertOne({ studioId, data: initialAppData, createdAt: new Date(), updatedAt: new Date() });
    return normalizeAppData(initialAppData);
  }

  return normalizeAppData(doc.data);
}

export async function saveAppData(data: AppData): Promise<AppData> {
  const client = await clientPromise;
  const collection = client.db(dbName).collection('appData');

  await collection.updateOne(
    { studioId },
    { $set: { studioId, data, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
    { upsert: true }
  );

  return data;
}

