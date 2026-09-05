import PDFDocument from 'pdfkit';
import Counter from '../models/Counter.js';

const PAGE_WIDTH = 226.77;
const SIDE_MARGIN = 18;
const CONTENT_WIDTH = PAGE_WIDTH - SIDE_MARGIN * 2;
const COLORS = {
  ink: '#24170f',
  body: '#403832',
  muted: '#81766d',
  line: '#d9d1ca',
  soft: '#f7f2ed',
  accent: '#9a6031',
};

const cents = (value) => Math.round(Number(value || 0) * 100);
const fromCents = (value) => value / 100;

export const money = (value) => {
  const amount = Number(value || 0);
  const formattedAmount = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));
  return `${amount < 0 ? '-Rs.' : 'Rs.'} ${formattedAmount}`;
};

export const formatReceiptDate = (value) => new Date(value).toLocaleDateString('en-IN', {
  day: '2-digit', month: 'short', year: 'numeric',
});

export const formatReceiptTime = (value) => new Date(value).toLocaleTimeString('en-IN', {
  hour: '2-digit', minute: '2-digit', hour12: true,
});

export const ensureReceiptNumber = async (bill) => {
  if (bill.receiptNumber) return bill.receiptNumber;
  const counter = await Counter.findOneAndUpdate(
    { _id: 'receiptNumber' },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  bill.receiptNumber = `BW-${new Date().getFullYear()}-${String(counter.seq).padStart(6, '0')}`;
  await bill.save();
  return bill.receiptNumber;
};

const paymentLabel = (orders) => {
  const methods = [...new Set(orders.map((order) => order.paymentMethod))];
  if (methods.length > 1) return 'Combined payment';
  return methods[0] === 'razorpay' ? 'Online Payment' : 'Cash';
};

const paymentStatusLabel = (orders, bill) => {
  if (bill?.status === 'PAID' || orders.every((order) => order.paymentStatus === 'paid')) return 'PAID';
  if (orders.some((order) => order.paymentMethod === 'cash' && order.cashVerificationStatus === 'pending')) return 'CASH PAYMENT PENDING VERIFICATION';
  if (orders.some((order) => order.paymentStatus === 'failed')) return 'PAYMENT FAILED';
  return 'PENDING PAYMENT';
};

const orderStatusLabel = (orders) => {
  if (orders.some((order) => order.orderStatus === 'cancelled')) return 'CANCELLED';
  if (orders.every((order) => order.orderStatus === 'completed')) return 'SERVED';
  const latest = orders[orders.length - 1]?.orderStatus || 'pending';
  return { pending: 'ORDER RECEIVED', confirmed: 'CONFIRMED', preparing: 'PREPARING', ready: 'READY' }[latest] || 'ORDER RECEIVED';
};

export const createReceiptData = async ({ orders, bill, tableNumber }) => {
  const safeOrders = (orders || []).filter((order) => order.orderStatus !== 'cancelled');
  if (!safeOrders.length) throw new Error('No billable orders found.');

  const firstOrder = safeOrders[0];
  const lastOrder = safeOrders[safeOrders.length - 1];
  const calculatedSubtotalCents = safeOrders.reduce((sum, order) => sum + cents(order.subtotal), 0);
  const calculatedTaxCents = safeOrders.reduce((sum, order) => sum + cents(order.tax), 0);
  const calculatedTotalCents = safeOrders.reduce((sum, order) => sum + cents(order.total), 0);
  const subtotalCents = Number(bill?.subtotal) > 0 ? cents(bill.subtotal) : calculatedSubtotalCents;
  const taxCents = Number(bill?.taxTotal) > 0 ? cents(bill.taxTotal) : calculatedTaxCents;
  const totalCents = Number(bill?.grandTotal) > 0 ? cents(bill.grandTotal) : calculatedTotalCents || subtotalCents + taxCents;

  const taxGroups = new Map();
  safeOrders.forEach((order) => {
    const rate = Number(order.taxRate || 0);
    taxGroups.set(rate, (taxGroups.get(rate) || 0) + cents(order.tax));
  });
  const taxRows = [...taxGroups.entries()].flatMap(([rate, taxAmountCents]) => {
    if (rate <= 0 || taxAmountCents <= 0) return [];
    const halfRate = rate / 2;
    const halfTax = Math.round(taxAmountCents / 2);
    return [
      { label: `CGST (${halfRate.toFixed(2)}%)`, amount: fromCents(halfTax) },
      { label: `SGST (${halfRate.toFixed(2)}%)`, amount: fromCents(halfTax) },
    ];
  });

  const paid = bill?.status === 'PAID' || safeOrders.every((order) => order.paymentStatus === 'paid');
  const transactionId = bill?.razorpayPaymentId || safeOrders.find((order) => order.razorpayPaymentId)?.razorpayPaymentId || '';

  return {
    receiptNumber: bill?.receiptNumber || `ORDER-${firstOrder.orderNumber}`,
    orderNumbers: safeOrders.map((order) => order.orderNumber),
    tableNumber: tableNumber || firstOrder.tableNumber,
    date: formatReceiptDate(firstOrder.createdAt),
    time: formatReceiptTime(firstOrder.createdAt),
    customer: firstOrder.customer?.name || '',
    phone: firstOrder.customer?.phone || '',
    items: safeOrders.flatMap((order) => (order.items || []).map((item) => ({ ...item, orderNumber: order.orderNumber }))),
    subtotal: fromCents(subtotalCents),
    discount: 0,
    taxableAmount: fromCents(subtotalCents),
    taxRows,
    taxTotal: fromCents(taxCents),
    grandTotal: fromCents(totalCents),
    paidAmount: Number(bill?.paidAmount ?? (paid ? fromCents(totalCents) : 0)),
    dueAmount: Number(bill?.dueAmount ?? (paid ? 0 : fromCents(totalCents))),
    paymentMethod: paymentLabel(safeOrders),
    paymentStatus: paymentStatusLabel(safeOrders, bill),
    transactionId,
    orderStatus: orderStatusLabel(safeOrders),
    generatedAt: lastOrder.updatedAt || lastOrder.createdAt,
  };
};

const wrapLines = (doc, value, width, options = {}) => doc.heightOfString(String(value ?? '-'), { width, ...options });

export const generateReceiptPdf = async (receipt) => {
  const doc = new PDFDocument({ size: [PAGE_WIDTH, 1000], margin: 0, autoFirstPage: false });

  const itemWidth = CONTENT_WIDTH - 24 - 65 - 10;
  const itemX = SIDE_MARGIN;
  const qtyX = itemX + itemWidth + 5;
  const amountX = qtyX + 29;
  const right = PAGE_WIDTH - SIDE_MARGIN;
  const text = (value, x, y, width, options = {}) => doc
    // PDFKit cannot reliably embed the WOFF files distributed for browser use.
    // The built-in PDF fonts render in every viewer and keep downloaded receipts readable.
    .font(options.bold ? 'Helvetica-Bold' : 'Helvetica')
    .fontSize(options.size || 8.5)
    .fillColor(options.color || COLORS.body)
    .text(String(value ?? '-'), x, y, { width, lineBreak: options.lineBreak !== false, align: options.align || 'left', characterSpacing: options.characterSpacing || 0 });
  const line = (y, width = 0.6, color = COLORS.line) => doc.moveTo(SIDE_MARGIN, y).lineTo(right, y).strokeColor(color).lineWidth(width).stroke();
  const infoRow = (label, value, x, y, width) => {
    text(label.toUpperCase(), x, y, width, { bold: true, size: 6.8, color: COLORS.muted, lineBreak: false });
    text(value, x, y + 9, width, { size: 8.2 });
  };

  const itemRowsHeight = receipt.items.reduce((height, item) => {
    const details = [item.variant ? `+ Size: ${item.variant.name}` : '', ...(item.addons || []).map((addon) => `+ Add-on: ${addon.name}`), item.specialInstructions ? `Note: ${item.specialInstructions}` : ''].filter(Boolean);
    const mainHeight = Math.max(12, wrapLines(doc, item.name || 'Item', itemWidth, { font: 'Helvetica-Bold', fontSize: 8.2 }));
    const detailHeight = details.reduce((sum, detail) => sum + wrapLines(doc, detail, itemWidth - 5, { font: 'Helvetica', fontSize: 7.1 }) + 2, 0);
    return height + mainHeight + detailHeight + 8;
  }, 0);
  const taxRowsHeight = receipt.taxRows.length * 13;
  const infoHeight = receipt.customer || receipt.phone ? 84 : 56;
  const paymentHeight = receipt.transactionId ? 61 : 46;
  const pageHeight = 30 + 52 + 13 + infoHeight + 16 + 18 + itemRowsHeight + 18 + 16 + taxRowsHeight + 56 + paymentHeight + 19 + 30 + 39 + 30;
  doc.addPage({ size: [PAGE_WIDTH, Math.max(560, pageHeight)], margin: 0 });

  let y = 22;
  text('BREWHAUS', SIDE_MARGIN, y, CONTENT_WIDTH, { bold: true, size: 17, color: COLORS.ink, align: 'center', lineBreak: false, characterSpacing: 0.8 });
  y += 20;
  text('FINE COFFEE & DINING', SIDE_MARGIN, y, CONTENT_WIDTH, { size: 7.5, color: COLORS.accent, align: 'center', lineBreak: false, characterSpacing: 0.8 });
  y += 16;
  text('Surat, Gujarat 395001  |  +91 98765 43210', SIDE_MARGIN, y, CONTENT_WIDTH, { size: 7, color: COLORS.muted, align: 'center', lineBreak: false });
  y += 15;
  line(y, 0.9, COLORS.ink);
  y += 12;

  infoRow('Receipt No.', receipt.receiptNumber, SIDE_MARGIN, y, CONTENT_WIDTH);
  y += 28;
  const half = (CONTENT_WIDTH - 10) / 2;
  infoRow('Order No.', receipt.orderNumbers.join(', '), SIDE_MARGIN, y, half);
  infoRow('Table', String(receipt.tableNumber || '-').padStart(2, '0'), SIDE_MARGIN + half + 10, y, half);
  y += 28;
  infoRow('Date', receipt.date, SIDE_MARGIN, y, half);
  infoRow('Time', receipt.time, SIDE_MARGIN + half + 10, y, half);
  y += 28;
  if (receipt.customer || receipt.phone) {
    if (receipt.customer) infoRow('Customer', receipt.customer, SIDE_MARGIN, y, half);
    if (receipt.phone) infoRow('Phone', receipt.phone, SIDE_MARGIN + half + 10, y, half);
    y += 28;
  }
  line(y, 0.6);
  y += 13;

  text('ITEM', itemX, y, itemWidth, { bold: true, size: 7.2, color: COLORS.muted, lineBreak: false });
  text('QTY', qtyX, y, 24, { bold: true, size: 7.2, color: COLORS.muted, align: 'center', lineBreak: false });
  text('AMOUNT', amountX, y, 65, { bold: true, size: 7.2, color: COLORS.muted, align: 'right', lineBreak: false });
  y += 10;
  line(y, 0.5);
  y += 8;
  receipt.items.forEach((item) => {
    const details = [item.variant ? `+ Size: ${item.variant.name}` : '', ...(item.addons || []).map((addon) => `+ Add-on: ${addon.name}`), item.specialInstructions ? `Note: ${item.specialInstructions}` : ''].filter(Boolean);
    const mainHeight = Math.max(12, wrapLines(doc, item.name || 'Item', itemWidth, { font: 'Helvetica-Bold', fontSize: 8.2 }));
    text(item.name || 'Item', itemX, y, itemWidth, { bold: true, size: 8.2 });
    text(item.quantity || 1, qtyX, y, 24, { size: 8.2, align: 'center', lineBreak: false });
    text(money(item.itemTotal), amountX, y, 65, { size: 8.2, align: 'right', lineBreak: false });
    y += mainHeight;
    details.forEach((detail) => {
      const detailHeight = wrapLines(doc, detail, itemWidth - 5, { font: 'Helvetica', fontSize: 7.1 });
      text(detail, itemX + 5, y, itemWidth - 5, { size: 7.1, color: COLORS.muted });
      y += detailHeight + 2;
    });
    y += 6;
  });

  line(y, 0.6);
  y += 11;
  const summary = (label, value, bold = false) => {
    text(label, itemX, y, CONTENT_WIDTH - 70, { bold, size: bold ? 9.3 : 8.1, color: bold ? COLORS.ink : COLORS.body, lineBreak: false });
    text(money(value), amountX, y, 65, { bold, size: bold ? 9.3 : 8.1, color: bold ? COLORS.ink : COLORS.body, align: 'right', lineBreak: false });
    y += bold ? 17 : 13;
  };
  summary('Subtotal', receipt.subtotal);
  if (receipt.discount > 0) summary('Discount', -receipt.discount);
  summary('Taxable Amount', receipt.taxableAmount);
  receipt.taxRows.forEach((tax) => summary(tax.label, tax.amount));
  line(y, 1, COLORS.ink);
  y += 10;
  summary('TOTAL AMOUNT', receipt.grandTotal, true);

  y += 5;
  doc.roundedRect(SIDE_MARGIN, y, CONTENT_WIDTH, paymentHeight, 4).fill(COLORS.soft);
  text('PAYMENT', SIDE_MARGIN + 9, y + 8, CONTENT_WIDTH - 18, { bold: true, size: 7.1, color: COLORS.muted, lineBreak: false });
  text(`Method: ${receipt.paymentMethod}`, SIDE_MARGIN + 9, y + 19, CONTENT_WIDTH - 18, { size: 8.1, lineBreak: false });
  text(`Status: ${receipt.paymentStatus}`, SIDE_MARGIN + 9, y + 31, CONTENT_WIDTH - 18, { bold: true, size: 8.1, color: receipt.paymentStatus === 'PAID' ? '#28734a' : COLORS.accent, lineBreak: false });
  if (receipt.transactionId) text(`Transaction ID: ${receipt.transactionId}`, SIDE_MARGIN + 9, y + 44, CONTENT_WIDTH - 18, { size: 6.8, color: COLORS.muted });
  y += paymentHeight + 15;
  text(receipt.orderStatus, SIDE_MARGIN, y, CONTENT_WIDTH, { bold: true, size: 7.8, color: COLORS.accent, align: 'center', lineBreak: false });
  y += 21;
  line(y, 0.5);
  y += 12;
  text('Thank you for visiting Brewhaus!', SIDE_MARGIN, y, CONTENT_WIDTH, { bold: true, size: 8.7, color: COLORS.accent, align: 'center', lineBreak: false });
  y += 14;
  text('Please visit again. Have a great day!', SIDE_MARGIN, y, CONTENT_WIDTH, { size: 7.1, color: COLORS.muted, align: 'center', lineBreak: false });
  y += 13;
  text('www.brewhauscafe.com', SIDE_MARGIN, y, CONTENT_WIDTH, { size: 7.1, color: COLORS.muted, align: 'center', lineBreak: false });

  const buffers = [];
  doc.on('data', (chunk) => buffers.push(chunk));
  const result = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);
  });
  doc.end();
  return result;
};

export const generateReceipt = async (order) => generateReceiptPdf(await createReceiptData({ orders: [order], tableNumber: order.tableNumber }));
