export type Page =
  | 'dashboard'
  | 'weekly-entry'
  | 'weekly-summary'
  | 'monthly-summary'
  | 'passes'
  | 'expenses'
  | 'settings';

export type WeekStatus = 'open' | 'closed';

export type ParticipantEntry = {
  id: string;
  label: string;
  amount: number;
  quantity: number;
};

export type SpecialTrainerCost = {
  id: string;
  label: string;
  cost: number;
};

export type ExtraRevenue = {
  id: string;
  name: string;
  amount: number;
  type: 'expired-pass' | 'other';
};

export type DayRow = {
  id: string;
  day: string;
  revenue: number;
  heldHours: number;
  fullHours: number;
  participants: number;
  trainerCost: number;
  entries: ParticipantEntry[];
  specialTrainerCosts?: SpecialTrainerCost[];
  extraRevenues?: ExtraRevenue[];
};

export type WeekRow = {
  id: string;
  week: string;
  startDate: string;
  endDate: string;
  year: number;
  month: string;
  status: WeekStatus;
  monthClosed: boolean;
  days: DayRow[];
  expiredPasses: number;
  studioRent: number; // legacy field, now treated as extra revenue
  extraRevenues?: ExtraRevenue[];
  note: string;
  source?: 'manual' | 'summary-import';
};

export type PassType = {
  id: string;
  name: string;
  price: number;
  occasions: number;
  active: boolean;
};

export type ExpenseType = 'fixed' | 'monthly-manual' | 'legacy';

export type Expense = {
  id: string;
  name: string;
  category: string;
  amount: number;
  recurrence: 'monthly' | 'one-time';
  month: string;
  active: boolean;
  expenseType?: ExpenseType;
  year?: number;
};

export type Settings = {
  studioName: string;
  trainerHourlyCost: number;
  fullHourTrainerCost: number;
  maxParticipantsPerClass: number;
  currency: string;
  variableExpenseCategories?: string[];
};

export type AppData = {
  weeks: WeekRow[];
  passes: PassType[];
  expenses: Expense[];
  settings: Settings;
};
