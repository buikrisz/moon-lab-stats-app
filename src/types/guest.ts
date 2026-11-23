export type GuestRecord = {
  guestId: string;
  lastName: string;
  firstName: string;
  nickname: string;
  registeredAt: string | null;
  firstVisitAt: string | null;
  lastVisitAt: string | null;
  courses: string[];
  activeMembership: string;
  registrationSource?: string;
  source: 'guest-list' | 'attendance-import';
  updatedAt?: string;
};

export type GuestVisit = {
  eventId: string;
  guestId: string;
  startsAt: string;
  className: string;
  courseName: string;
  instructor: string;
  passName: string;
  attended: boolean;
  revenue: number;
  hasDebt: boolean;
  source: 'attendance-export';
};

export type GuestPurchase = {
  purchaseId: string;
  guestId: string;
  purchasedAt: string;
  name: string;
  category: 'ticket' | 'pass' | 'other';
  listPrice: number;
  discount: number;
  paidPrice: number;
  sessionCount: number;
  salesperson: string;
  invoice: string;
  source: 'attendance-export';
};

export type GuestActivityImport = {
  importId: string;
  fileName: string;
  periodStart: string;
  periodEnd: string;
  visitsCount: number;
  purchasesCount: number;
  importedAt: string;
};
