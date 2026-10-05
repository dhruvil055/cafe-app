import assert from 'node:assert/strict';
import test from 'node:test';
import zlib from 'node:zlib';
import { createReceiptData, generateReceiptPdf, money } from '../services/receipt.js';

const sampleReceipt = {
  receiptNumber: 'BW-2026-000001',
  orderNumbers: ['BW-2026-000001'],
  tableNumber: 4,
  date: '05 Sep 2026',
  time: '03:57 PM',
  customer: 'Aarav Shah',
  phone: '+91 98765 43210',
  items: [{ name: 'Cappuccino', quantity: 2, itemTotal: 360 }],
  subtotal: 360,
  discount: 0,
  taxableAmount: 360,
  taxRows: [{ label: 'CGST (2.50%)', amount: 9 }, { label: 'SGST (2.50%)', amount: 9 }],
  taxTotal: 18,
  grandTotal: 378,
  paymentMethod: 'Online Payment',
  paymentStatus: 'PAID',
  transactionId: '',
  orderStatus: 'CONFIRMED',
};

const decodedPdfStreams = (pdf) => {
  const chunks = [];
  for (let start = 0; (start = pdf.indexOf('stream', start, 'latin1')) !== -1;) {
    const contentStart = pdf.indexOf('\n', start, 'latin1') + 1;
    const end = pdf.indexOf('endstream', contentStart, 'latin1');
    let stream = pdf.subarray(contentStart, end);
    if (stream.at(-1) === 10) stream = stream.subarray(0, -1);
    try {
      chunks.push(zlib.inflateSync(stream).toString('latin1'));
    } catch {
      // Only Flate-compressed PDF streams contain receipt content.
    }
    start = end + 'endstream'.length;
  }
  return chunks.join('\n');
};

test('receipt PDFs use reader-safe fonts and readable money labels', async () => {
  const pdf = await generateReceiptPdf(sampleReceipt);
  const rawPdf = pdf.toString('latin1');
  const content = decodedPdfStreams(pdf);

  assert.match(rawPdf, /\/BaseFont \/Helvetica/);
  assert.doesNotMatch(rawPdf, /NotoSans/);
  assert.match(content, /<436166>/); // Tenant café name fallback
  assert.match(content, /<5273>/); // "Rs"
  assert.equal(money(1234.5), 'Rs. 1,234.50');
  assert.equal(money(-25), '-Rs. 25.00');
});

test('receipt data retains order discounts and reports the discounted taxable value', async () => {
  const receipt = await createReceiptData({
    orders: [{
      orderNumber: 'CAF1001', tableNumber: 4, createdAt: new Date('2026-10-04T08:00:00Z'), updatedAt: new Date('2026-10-04T08:00:00Z'),
      customer: { name: 'Aarav', phone: '+919876543210' }, items: [{ name: 'Cappuccino', quantity: 1, itemTotal: 299 }],
      subtotal: 299, discount: 29.9, tax: 13.46, total: 282.56, taxRate: 5, paymentMethod: 'cash', paymentStatus: 'paid', orderStatus: 'completed',
    }],
    bill: null,
  });
  assert.equal(receipt.subtotal, 299);
  assert.equal(receipt.discount, 29.9);
  assert.equal(receipt.taxableAmount, 269.1);
  assert.equal(receipt.taxTotal, 13.46);
  assert.equal(receipt.grandTotal, 282.56);
});
