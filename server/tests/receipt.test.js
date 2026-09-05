import assert from 'node:assert/strict';
import test from 'node:test';
import zlib from 'node:zlib';
import { generateReceiptPdf, money } from '../services/receipt.js';

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
  assert.match(content, /<425245574841>/); // BREWHAUS
  assert.match(content, /<5273>/); // "Rs"
  assert.equal(money(1234.5), 'Rs. 1,234.50');
  assert.equal(money(-25), '-Rs. 25.00');
});
