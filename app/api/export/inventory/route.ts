import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { Inventory } from '@/models/Schemas';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export async function GET(req: NextRequest) {
  try {
    await dbConnect();

    const items = await Inventory.find({}).sort({ sku: 1 });

    const rows = items.map((item) => ({
      SKU: item.sku,
      Nombre: item.name,
      'Stock Actual': String(item.currentStock),
      'P. Compra': String(item.purchasePrice),
      'P. Venta': String(item.salePrice ?? 0),
      'Margen %': item.salePrice
        ? (((item.salePrice - item.purchasePrice) / item.purchasePrice) * 100).toFixed(1)
        : '—',
      'Costo Real': String(item.landedCost),
    }));

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let page = pdfDoc.addPage([842, 595]);
    const { width, height } = page.getSize();
    const margin = 40;
    const lineHeight = 14;

    let y = height - margin;

    function drawHeader(title: string) {
      page.drawText(title, { x: margin, y, size: 18, font: boldFont, color: rgb(0.1, 0.1, 0.1) });
      y -= 20;
      page.drawText(`Generado: ${new Date().toLocaleDateString('es-CR')} | Total productos: ${rows.length}`, {
        x: margin, y, size: 10, font, color: rgb(0.4, 0.4, 0.4),
      });
      y -= 24;

      const columns = ['SKU', 'Nombre', 'Stock', 'P. Compra', 'P. Venta', 'Margen %', 'Costo Real'];
      const colX = [margin, margin + 95, margin + 265, margin + 330, margin + 410, margin + 490, margin + 575];

      columns.forEach((col, i) => {
        page.drawText(col, { x: colX[i], y, size: 9, font: boldFont, color: rgb(0.2, 0.2, 0.2) });
      });

      y -= 2;
      page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
      y -= 10;
    }

    drawHeader('Reporte de Inventario');

    const colX = [margin, margin + 95, margin + 265, margin + 330, margin + 410, margin + 490, margin + 575];

    for (const row of rows) {
      if (y < 50) {
        page = pdfDoc.addPage([842, 595]);
        y = height - margin;
        drawHeader('Reporte de Inventario (cont.)');
      }

      const values = [row.SKU, row.Nombre, row['Stock Actual'], row['P. Compra'], row['P. Venta'], row['Margen %'], row['Costo Real']];
      values.forEach((val, i) => {
        page.drawText(val, { x: colX[i], y, size: 8, font, color: rgb(0.2, 0.2, 0.2) });
      });

      y -= lineHeight + 2;
    }

    const pdfBytes = await pdfDoc.save();

    return new Response(new Uint8Array(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="inventario-${new Date().toISOString().split('T')[0]}.pdf"`,
      },
    });
  } catch (error: unknown) {
    console.error('Export Inventory Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
