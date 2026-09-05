import PDFDocument from 'pdfkit';

const PAGE_WIDTH = 226.77;
const SIDE_MARGIN = 24;
const CONTENT_WIDTH = PAGE_WIDTH - SIDE_MARGIN * 2;
const COLORS = {
  ink: '#24170f',
  body: '#403832',
  muted: '#81766d',
  line: '#d9d1ca',
  soft: '#f7f2ed',
  accent: '#9a6031',
};

const money = (value) => `Rs. ${Number(value || 0).toFixed(2)}`;
const formatDate = (value) => new Date(value).toLocaleString('en-IN', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true,
}).replace(',', '');

export const generateReceipt = (order) => new Promise((resolve, reject) => {
  try {
    const items = order.items || [];
    const itemHeight = items.reduce((height, item) => height + 22 + (item.addons?.length || 0) * 9 + (item.specialInstructions ? 9 : 0), 0);
    const pageHeight = Math.max(560, 492 + itemHeight);
    const doc = new PDFDocument({ size: [PAGE_WIDTH, pageHeight], margin: 0 });
    const buffers = [];
    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const left = SIDE_MARGIN;
    const right = PAGE_WIDTH - SIDE_MARGIN;
    const amountWidth = 66;
    const itemWidth = CONTENT_WIDTH - amountWidth - 8;
    const line = (color = COLORS.line, width = 0.7) => {
      doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor(color).lineWidth(width).stroke();
    };
    const label = (text, x, y, width = 80) => doc.font('Helvetica-Bold').fontSize(7).fillColor(COLORS.muted)
      .text(String(text).toUpperCase(), x, y, { width, lineBreak: false });
    const value = (text, x, y, width = 90, options = {}) => doc
      .font(options.font || 'Helvetica').fontSize(options.size || 8.5).fillColor(options.color || COLORS.body)
      .text(String(text || '-'), x, y, { width, lineBreak: false, ...options });
    const row = (name, amount, bold = false) => {
      const y = doc.y;
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 10 : 8.5).fillColor(bold ? COLORS.ink : COLORS.body)
        .text(name, left, y, { width: CONTENT_WIDTH - amountWidth - 8, lineBreak: false });
      doc.text(amount, right - amountWidth, y, { width: amountWidth, align: 'right', lineBreak: false });
      doc.y = y + (bold ? 16 : 14);
    };

    doc.roundedRect(left, 24, CONTENT_WIDTH, 70, 6).fill(COLORS.soft);
    doc.font('Helvetica-Bold').fontSize(20).fillColor(COLORS.ink).text('BREWHAUS', left, 36, { width: CONTENT_WIDTH, align: 'center', lineBreak: false });
    doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.accent).text('FINE COFFEE & DINING', left, 62, { width: CONTENT_WIDTH, align: 'center', characterSpacing: 0.6, lineBreak: false });
    doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.muted).text('Surat, Gujarat 395001  |  +91 98765 43210', left, 78, { width: CONTENT_WIDTH, align: 'center', lineBreak: false });

    doc.font('Helvetica-Bold').fontSize(13).fillColor(COLORS.ink).text(`ORDER ${order.orderNumber}`, left, 108, { width: CONTENT_WIDTH, align: 'center', lineBreak: false });
    doc.y = 132;
    line(COLORS.ink, 1.2);
    doc.y = 145;

    const columnGap = 14;
    const columnWidth = (CONTENT_WIDTH - columnGap) / 2;
    label('Table', left, doc.y, columnWidth);
    label('Date', left + columnWidth + columnGap, doc.y, columnWidth);
    value(String(order.tableNumber || '-').padStart(2, '0'), left, doc.y + 10, columnWidth);
    value(formatDate(order.createdAt), left + columnWidth + columnGap, doc.y + 10, columnWidth, { size: 7.3 });
    doc.y = 184;
    label('Customer', left, doc.y, columnWidth);
    label('Phone', left + columnWidth + columnGap, doc.y, columnWidth);
    value(order.customer?.name, left, doc.y + 10, columnWidth);
    value(order.customer?.phone, left + columnWidth + columnGap, doc.y + 10, columnWidth);
    doc.y = 222;
    line();
    doc.y = 236;

    doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.ink).text('ITEM', left, doc.y, { lineBreak: false });
    doc.text('AMOUNT', right - amountWidth, doc.y, { width: amountWidth, align: 'right', lineBreak: false });
    doc.y += 13;
    line(COLORS.line, 0.5);
    doc.y += 11;

    items.forEach((item) => {
      const y = doc.y;
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLORS.body).text(`${item.name || 'Item'}  x${item.quantity || 1}`, left, y, { width: itemWidth, lineBreak: false });
      doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.body).text(money(item.itemTotal), right - amountWidth, y, { width: amountWidth, align: 'right', lineBreak: false });
      doc.y = y + 13;
      item.addons?.forEach((addon) => { value(`+ ${addon.name}`, left + 7, doc.y, itemWidth - 7, { size: 7.2, color: COLORS.muted }); doc.y += 9; });
      if (item.specialInstructions) { value(`Note: ${item.specialInstructions}`, left + 7, doc.y, itemWidth - 7, { size: 7.2, color: COLORS.muted, font: 'Helvetica-Oblique' }); doc.y += 9; }
      doc.y += 5;
    });

    line();
    doc.y += 12;
    row('Subtotal', money(order.subtotal));
    row(`GST (${order.taxRate || 5}%)`, money(order.tax));
    doc.y += 2;
    line(COLORS.ink, 1.4);
    doc.y += 10;
    row('TOTAL', money(order.total), true);

    const paymentY = doc.y + 5;
    const paymentHeight = order.razorpayPaymentId ? 47 : 38;
    doc.roundedRect(left, paymentY, CONTENT_WIDTH, paymentHeight, 5).fill(COLORS.soft);
    label('Payment', left + 10, paymentY + 9, 72);
    value(order.paymentMethod === 'razorpay' ? 'Online payment' : 'Cash at counter', left + 10, paymentY + 19, 105);
    label('Status', right - 70, paymentY + 9, 60);
    value(String(order.paymentStatus || 'pending').toUpperCase(), right - 70, paymentY + 19, 60, { font: 'Helvetica-Bold', size: 8.5, color: COLORS.accent, align: 'right' });
    if (order.razorpayPaymentId) value(`Txn: ${order.razorpayPaymentId}`, left + 10, paymentY + 34, CONTENT_WIDTH - 20, { size: 7, color: COLORS.muted });
    doc.y = paymentY + paymentHeight + 24;

    line(COLORS.line, 0.5);
    doc.y += 13;
    value('Thank you for visiting Brewhaus!', left, doc.y, CONTENT_WIDTH, { font: 'Helvetica-Bold', size: 9.5, color: COLORS.accent, align: 'center' });
    doc.y += 16;
    value('Please visit again. Have a great day!', left, doc.y, CONTENT_WIDTH, { size: 7.5, color: COLORS.muted, align: 'center' });
    doc.y += 11;
    value('www.brewhauscafe.com', left, doc.y, CONTENT_WIDTH, { size: 7.5, color: COLORS.muted, align: 'center' });
    doc.end();
  } catch (error) {
    reject(error);
  }
});
