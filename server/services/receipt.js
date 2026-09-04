import PDFDocument from 'pdfkit';

const PAGE_WIDTH = 226.77;
const SIDE_MARGIN = 24;
const CONTENT_WIDTH = PAGE_WIDTH - (SIDE_MARGIN * 2);
const COLORS = { ink: '#24170f', body: '#403832', muted: '#81766d', line: '#d9d1ca', soft: '#f7f2ed', accent: '#9a6031' };

const money = (value) => `Rs. ${Number(value || 0).toFixed(2)}`;
const formatDate = (value) => new Date(value).toLocaleString('en-IN', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

export const generateReceipt = (order) => new Promise((resolve, reject) => {
  try {
    const items = order.items || [];
    const extraHeight = items.reduce((height, item) => height + 18 + ((item.addons?.length || 0) * 9), 0);
    const doc = new PDFDocument({ margin: SIDE_MARGIN, size: [PAGE_WIDTH, Math.max(575, 500 + extraHeight)] });
    const buffers = [];
    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const rule = (color = COLORS.line, width = 0.7) => {
      doc.moveTo(SIDE_MARGIN, doc.y).lineTo(PAGE_WIDTH - SIDE_MARGIN, doc.y).strokeColor(color).lineWidth(width).stroke();
    };
    const detail = (label, value, x, y, width) => {
      doc.font('Helvetica-Bold').fontSize(7).fillColor(COLORS.muted).text(label.toUpperCase(), x, y, { width });
      doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.body).text(String(value || '-'), x, y + 9, { width });
    };
    const totalRow = (label, value, bold = false) => {
      const y = doc.y;
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 10 : 8.5).fillColor(bold ? COLORS.ink : COLORS.body).text(label, SIDE_MARGIN, y, { width: 100 });
      doc.text(value, PAGE_WIDTH - SIDE_MARGIN - 65, y, { width: 65, align: 'right' });
      doc.moveDown(bold ? 0.5 : 0.35);
    };

    doc.roundedRect(SIDE_MARGIN, doc.y, CONTENT_WIDTH, 66, 5).fill(COLORS.soft);
    doc.font('Helvetica-Bold').fontSize(20).fillColor(COLORS.ink).text('BREWHAUS', SIDE_MARGIN, doc.y + 12, { width: CONTENT_WIDTH, align: 'center' });
    doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.accent).text('FINE COFFEE & DINING', SIDE_MARGIN, doc.y + 3, { width: CONTENT_WIDTH, align: 'center', characterSpacing: 0.6 });
    doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.muted).text('Surat, Gujarat 395001  |  +91 98765 43210', SIDE_MARGIN, doc.y + 2, { width: CONTENT_WIDTH, align: 'center' });
    doc.y = 92;

    doc.font('Helvetica-Bold').fontSize(13).fillColor(COLORS.ink).text(`ORDER ${order.orderNumber}`, SIDE_MARGIN, doc.y, { width: CONTENT_WIDTH, align: 'center' });
    doc.moveDown(0.7);
    rule(COLORS.ink, 1.2);
    doc.moveDown(0.65);
    const columnWidth = (CONTENT_WIDTH - 18) / 2;
    detail('Table', String(order.tableNumber).padStart(2, '0'), SIDE_MARGIN, doc.y, columnWidth);
    detail('Date', formatDate(order.createdAt), SIDE_MARGIN + columnWidth + 18, doc.y, columnWidth);
    doc.moveDown(2.45);
    detail('Customer', order.customer?.name, SIDE_MARGIN, doc.y, columnWidth);
    detail('Phone', order.customer?.phone, SIDE_MARGIN + columnWidth + 18, doc.y, columnWidth);
    doc.moveDown(2.45);
    rule();
    doc.moveDown(0.65);

    doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.ink).text('ITEM', SIDE_MARGIN, doc.y).text('AMOUNT', PAGE_WIDTH - SIDE_MARGIN - 65, doc.y, { width: 65, align: 'right' });
    doc.moveDown(0.45);
    rule(COLORS.line, 0.5);
    doc.moveDown(0.5);
    items.forEach((item) => {
      const y = doc.y;
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLORS.body).text(`${item.name || 'Item'}  x${item.quantity || 1}`, SIDE_MARGIN, y, { width: 108 });
      doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.body).text(money(item.itemTotal), PAGE_WIDTH - SIDE_MARGIN - 65, y, { width: 65, align: 'right' });
      doc.y = Math.max(doc.y, y + 11);
      item.addons?.forEach((addon) => doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.muted).text(`+ ${addon.name}`, SIDE_MARGIN + 7, doc.y, { width: 125 }));
      if (item.specialInstructions) doc.font('Helvetica-Oblique').fontSize(7.5).fillColor(COLORS.muted).text(`Note: ${item.specialInstructions}`, SIDE_MARGIN + 7, doc.y, { width: 125 });
      doc.moveDown(0.55);
    });

    rule();
    doc.moveDown(0.7);
    totalRow('Subtotal', money(order.subtotal));
    totalRow(`GST (${order.taxRate || 5}%)`, money(order.tax));
    doc.moveDown(0.15);
    rule(COLORS.ink, 1.5);
    doc.moveDown(0.55);
    totalRow('TOTAL', money(order.total), true);

    const paymentHeight = order.razorpayPaymentId ? 48 : 36;
    doc.moveDown(0.35);
    doc.roundedRect(SIDE_MARGIN, doc.y, CONTENT_WIDTH, paymentHeight, 4).fill(COLORS.soft);
    const paymentY = doc.y + 9;
    doc.font('Helvetica-Bold').fontSize(7).fillColor(COLORS.muted).text('PAYMENT', SIDE_MARGIN + 10, paymentY);
    doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.body).text(order.paymentMethod === 'razorpay' ? 'Online payment' : 'Cash at counter', SIDE_MARGIN + 10, paymentY + 9);
    doc.font('Helvetica-Bold').fontSize(7).fillColor(COLORS.muted).text('STATUS', PAGE_WIDTH - SIDE_MARGIN - 70, paymentY, { width: 60, align: 'right' });
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLORS.accent).text(String(order.paymentStatus || 'pending').toUpperCase(), PAGE_WIDTH - SIDE_MARGIN - 70, paymentY + 9, { width: 60, align: 'right' });
    if (order.razorpayPaymentId) doc.font('Helvetica').fontSize(7).fillColor(COLORS.muted).text(`Txn: ${order.razorpayPaymentId}`, SIDE_MARGIN + 10, paymentY + 25, { width: CONTENT_WIDTH - 20 });

    doc.y += paymentHeight + 15;
    rule(COLORS.line, 0.5);
    doc.moveDown(0.8);
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(COLORS.accent).text('Thank you for visiting Brewhaus!', SIDE_MARGIN, doc.y, { width: CONTENT_WIDTH, align: 'center' });
    doc.moveDown(0.25);
    doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.muted).text('Please visit again. Have a great day!', SIDE_MARGIN, doc.y, { width: CONTENT_WIDTH, align: 'center' }).text('www.brewhauscafe.com', SIDE_MARGIN, doc.y + 2, { width: CONTENT_WIDTH, align: 'center' });
    doc.end();
  } catch (error) {
    reject(error);
  }
});
