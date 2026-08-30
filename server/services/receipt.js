import PDFDocument from 'pdfkit';

export const generateReceipt = (order) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: [226.77, 800] }); // 80mm receipt width
      const buffers = [];

      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const W = 226.77;
      const center = W / 2;

      // ── Header ──────────────────────────────────────────
      doc.font('Helvetica-Bold').fontSize(18).fillColor('#1a0f08')
        .text('BREWHAUS', { align: 'center' });

      doc.font('Helvetica').fontSize(9).fillColor('#666666')
        .text('Fine Coffee & Dining', { align: 'center' })
        .text('Surat, Gujarat 395001', { align: 'center' })
        .text('Tel: +91 98765 43210', { align: 'center' });

      doc.moveDown(0.5);
      doc.moveTo(40, doc.y).lineTo(W - 40, doc.y).strokeColor('#cccccc').stroke();
      doc.moveDown(0.5);

      // ── Order Info ───────────────────────────────────────
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#1a0f08')
        .text(`Order ${order.orderNumber}`, { align: 'center' });

      doc.font('Helvetica').fontSize(8).fillColor('#444444');

      const dateStr = new Date(order.createdAt).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });

      doc.text(`Table: ${String(order.tableNumber).padStart(2, '0')}`, 40)
        .text(`Customer: ${order.customer.name}`, 40)
        .text(`Phone: ${order.customer.phone}`, 40)
        .text(`Date: ${dateStr}`, 40);

      doc.moveDown(0.5);
      doc.moveTo(40, doc.y).lineTo(W - 40, doc.y).strokeColor('#cccccc').stroke();
      doc.moveDown(0.5);

      // ── Items ────────────────────────────────────────────
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#1a0f08');
      const col1 = 40, col2 = W - 70;

      doc.text('ITEM', col1).text('AMT', col2, doc.y - 10, { width: 30, align: 'right' });
      doc.moveDown(0.3);
      doc.moveTo(40, doc.y).lineTo(W - 40, doc.y).strokeColor('#eeeeee').stroke();
      doc.moveDown(0.3);

      order.items.forEach((item) => {
        const y = doc.y;
        doc.font('Helvetica').fontSize(8).fillColor('#222222')
          .text(`${item.name} x${item.quantity}`, col1, y, { width: 120 });
        doc.text(`₹${item.itemTotal}`, col2, y, { width: 45, align: 'right' });

        if (item.addons?.length) {
          item.addons.forEach(addon => {
            doc.font('Helvetica').fontSize(7).fillColor('#888888')
              .text(`  + ${addon.name}`, col1);
          });
        }
        if (item.specialInstructions) {
          doc.font('Helvetica').fontSize(7).fillColor('#999999')
            .text(`  Note: ${item.specialInstructions}`, col1);
        }
        doc.moveDown(0.2);
      });

      doc.moveDown(0.3);
      doc.moveTo(40, doc.y).lineTo(W - 40, doc.y).strokeColor('#cccccc').stroke();
      doc.moveDown(0.5);

      // ── Totals ───────────────────────────────────────────
      const printRow = (label, value, bold = false) => {
        const y = doc.y;
        if (bold) {
          doc.font('Helvetica-Bold').fontSize(9).fillColor('#1a0f08');
        } else {
          doc.font('Helvetica').fontSize(8).fillColor('#444444');
        }
        doc.text(label, col1, y);
        doc.text(value, col2, y, { width: 45, align: 'right' });
        doc.moveDown(0.3);
      };

      printRow('Subtotal', `₹${order.subtotal}`);
      printRow(`GST (${order.taxRate || 5}%)`, `₹${order.tax}`);
      doc.moveDown(0.2);
      doc.moveTo(40, doc.y).lineTo(W - 40, doc.y).strokeColor('#1a0f08').lineWidth(1.5).stroke();
      doc.lineWidth(1);
      doc.moveDown(0.3);
      printRow('TOTAL', `₹${order.total}`, true);

      doc.moveDown(0.5);
      doc.moveTo(40, doc.y).lineTo(W - 40, doc.y).strokeColor('#cccccc').stroke();
      doc.moveDown(0.5);

      // ── Payment ──────────────────────────────────────────
      doc.font('Helvetica').fontSize(8).fillColor('#444444')
        .text(`Payment: ${order.paymentMethod === 'razorpay' ? 'Online (Razorpay)' : 'Cash at Counter'}`, 40)
        .text(`Status: ${order.paymentStatus.toUpperCase()}`, 40);

      if (order.razorpayPaymentId) {
        doc.text(`Txn ID: ${order.razorpayPaymentId}`, 40);
      }

      doc.moveDown(0.5);
      doc.moveTo(40, doc.y).lineTo(W - 40, doc.y).strokeColor('#eeeeee').stroke();
      doc.moveDown(0.5);

      // ── Footer ───────────────────────────────────────────
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#8a5e35')
        .text('Thank you for visiting Brewhaus!', { align: 'center' });

      doc.font('Helvetica').fontSize(7).fillColor('#999999')
        .text('Please visit again. Have a great day!', { align: 'center' })
        .text('www.brewhauscafe.com', { align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};
