export const moneyTicks = (values: number[], step = 500000) => {
  const max = Math.max(0, ...values);
  const roundedMax = Math.max(step, Math.ceil(max / step) * step);
  const ticks: number[] = [];
  for (let value = 0; value <= roundedMax; value += step) ticks.push(value);
  return ticks;
};

export const integerTicks = (values: number[], step = 1) => {
  const max = Math.max(0, ...values);
  const roundedMax = Math.max(step, Math.ceil(max / step) * step);
  const ticks: number[] = [];
  for (let value = 0; value <= roundedMax; value += step) ticks.push(value);
  return ticks;
};
