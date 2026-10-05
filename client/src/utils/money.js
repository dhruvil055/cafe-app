export const formatMoney = (value, currency = 'INR') => new Intl.NumberFormat(undefined, {
  style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(Number(value || 0));
