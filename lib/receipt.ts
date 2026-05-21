import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

interface ReceiptItem {
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  lineTotal: number;
  taxAmount: number;
}

export async function generateReceiptPdf(
  businessName: string,
  documentId: string,
  date: Date,
  items: ReceiptItem[],
  taxableSubtotal: number,
  exemptSubtotal: number,
  taxAmount: number,
  grandTotal: number,
): Promise<string> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageHeight = 340 + items.length * 20 + (exemptSubtotal > 0 ? 24 : 0);
  const page = pdfDoc.addPage([280, pageHeight]);
  const { width } = page.getSize();
  let y = page.getHeight() - 30;

  const drawText = (text: string, x: number, bold = false) => {
    page.drawText(text, {
      x,
      y,
      size: 10,
      font: bold ? fontBold : font,
      color: rgb(0, 0, 0),
    });
  };

  drawText(businessName, width / 2 - (businessName.length * 3), true);
  y -= 6;
  drawText('FacturaBot CR Edition', width / 2 - 55);
  y -= 14;
  page.drawLine({ start: { x: 20, y }, end: { x: width - 20, y }, thickness: 1, color: rgb(0, 0, 0) });
  y -= 14;

  drawText(`Recibo: ${documentId.slice(0, 16)}...`, 20);
  y -= 12;
  drawText(`Fecha: ${date.toLocaleDateString('es-CR')} ${date.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' })}`, 20);
  y -= 14;
  page.drawLine({ start: { x: 20, y }, end: { x: width - 20, y }, thickness: 1, color: rgb(0, 0, 0) });
  y -= 14;

  drawText('SKU', 20, true);
  drawText('Cant', 110, true);
  drawText('Precio', 145, true);
  drawText('Total', 210, true);
  y -= 12;

  for (const item of items) {
    page.drawLine({ start: { x: 20, y }, end: { x: width - 20, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
    y -= 12;
    drawText(item.sku, 20);
    drawText(String(item.quantity), 110);
    drawText(`CRC ${item.unitPrice.toLocaleString('es-CR')}`, 125);
    drawText(`CRC ${item.lineTotal.toLocaleString('es-CR')}`, 195);
    y -= 10;
    const label = item.taxRate === 0 ? `${item.name} (Exento)` : `${item.name} IVA ${(item.taxRate * 100).toFixed(0)}%`;
    drawText(label, 25);
    y -= 6;
  }

  y -= 4;
  page.drawLine({ start: { x: 20, y }, end: { x: width - 20, y }, thickness: 1, color: rgb(0, 0, 0) });
  y -= 16;

  if (exemptSubtotal > 0) {
    drawText(`Subtotal gravable: CRC ${taxableSubtotal.toLocaleString('es-CR')}`, 20);
    y -= 12;
    drawText(`Subtotal exento:   CRC ${exemptSubtotal.toLocaleString('es-CR')}`, 20);
    y -= 12;
  } else {
    drawText(`Subtotal: CRC ${taxableSubtotal.toLocaleString('es-CR')}`, 20);
    y -= 12;
  }

  const taxByRate: Record<number, number> = {};
  for (const item of items) {
    if (item.taxRate > 0) {
      taxByRate[item.taxRate] = (taxByRate[item.taxRate] || 0) + item.taxAmount;
    }
  }
  for (const [rate, amount] of Object.entries(taxByRate)) {
    drawText(`IVA ${(Number(rate) * 100).toFixed(0)}%: CRC ${amount.toLocaleString('es-CR')}`, 20);
    y -= 12;
  }
  y -= 4;
  page.drawLine({ start: { x: 20, y }, end: { x: width - 20, y }, thickness: 1, color: rgb(0, 0, 0) });
  y -= 14;
  drawText(`Total: CRC ${grandTotal.toLocaleString('es-CR')}`, width - 90, true);
  y -= 24;

  const thankYou = '¡Gracias por su compra!';
  drawText(thankYou, width / 2 - (thankYou.length * 3));

  const pdfBytes = await pdfDoc.save();
  const base64 = Buffer.from(pdfBytes).toString('base64');
  return base64;
}
