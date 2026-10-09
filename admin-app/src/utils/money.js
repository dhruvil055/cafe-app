const CURRENCY_MAP = {
  '₹': 'INR',
  '$': 'USD',
  '€': 'EUR',
  '£': 'GBP',
};

export const formatMoney = (value, currency = 'INR') => {
  const num = Number(value || 0);
  const normalized = CURRENCY_MAP[currency] || (currency && currency.length === 3 ? currency.toUpperCase() : 'INR');
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: normalized,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  } catch {
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
};
