/**
 * Indian GST Billing & Invoicing Service
 * Standard 5% GST on Restaurant/Café services:
 * - Intra-state: 2.5% CGST + 2.5% SGST
 * - Inter-state: 5% IGST
 */

export const calculateGstBreakdown = ({
  taxableAmount = 0,
  taxRate = 5,
  isInterState = false,
  customerGstin = '',
}) => {
  const taxable = Math.max(0, Number(taxableAmount) || 0);
  const rate = Math.max(0, Number(taxRate) || 0);
  const totalTax = Number(((taxable * rate) / 100).toFixed(2));

  let cgst = 0;
  let sgst = 0;
  let igst = 0;

  if (isInterState) {
    igst = totalTax;
  } else {
    cgst = Number((totalTax / 2).toFixed(2));
    sgst = Number((totalTax - cgst).toFixed(2));
  }

  return {
    taxableAmount: Number(taxable.toFixed(2)),
    taxRate: rate,
    cgst,
    sgst,
    igst,
    totalTax,
    totalAmount: Number((taxable + totalTax).toFixed(2)),
    customerGstin: String(customerGstin || '').trim().toUpperCase(),
    isInterState,
  };
};

export const getFiscalYearString = (date = new Date()) => {
  const d = new Date(date);
  const month = d.getMonth() + 1; // 1-12
  const year = d.getFullYear();
  if (month >= 4) {
    // April onwards belongs to year-(year+1)
    const nextYear = String(year + 1).slice(-2);
    return `${year}-${nextYear}`;
  }
  const prevYear = year - 1;
  const currentYear = String(year).slice(-2);
  return `${prevYear}-${currentYear}`;
};

export const formatGstInvoiceNumber = ({ prefix = 'INV', sequenceNumber = 1, date = new Date() }) => {
  const fy = getFiscalYearString(date);
  const paddedSeq = String(sequenceNumber).padStart(4, '0');
  const cleanPrefix = String(prefix || 'INV').trim().toUpperCase();
  return `${cleanPrefix}/${fy}/${paddedSeq}`;
};
