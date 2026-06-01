export const huf = (value?: number | null) => {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('hu-HU').format(Math.round(value)) + ' Ft';
};

export const num = (value?: number | null, digits = 0) => {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('hu-HU', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
};

export const safeDiv = (a: number, b: number) => (b === 0 ? 0 : a / b);
