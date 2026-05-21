import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { Inventory } from '@/models/Schemas';
import * as XLSX from 'xlsx';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const format = req.nextUrl.searchParams.get('format') || 'xlsx';

    const items = await Inventory.find({}).sort({ sku: 1 });

    const rows = items.map((item) => ({
      SKU: item.sku,
      Nombre: item.name,
      'Stock Actual': item.currentStock,
      'P. Compra': item.purchasePrice,
      'P. Venta': item.salePrice ?? 0,
      'Margen %': item.salePrice
        ? Number((((item.salePrice - item.purchasePrice) / item.purchasePrice) * 100).toFixed(1))
        : '—',
      'Costo Real': item.landedCost,
    }));

    if (format === 'xlsx') {
      const workbook = XLSX.utils.book_new();
      const sheet = XLSX.utils.json_to_sheet(rows);

      const colWidths = Object.keys(rows[0] || {}).map((key) => ({
        wch: Math.max(
          key.length + 2,
          ...rows.map((r) => String(r[key as keyof typeof r] ?? '').length + 2),
        ),
      }));
      sheet['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(workbook, sheet, 'Inventario');

      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="inventario-${new Date().toISOString().split('T')[0]}.xlsx"`,
        },
      });
    }

    if (format === 'pdf') {
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

        const values = [row.SKU, row.Nombre, String(row['Stock Actual']), String(row['P. Compra']), String(row['P. Venta']), String(row['Margen %']), String(row['Costo Real'])];
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
    }

    return NextResponse.json({ error: 'Invalid format. Use ?format=xlsx or ?format=pdf' }, { status: 400 });
  } catch (error: unknown) {
    console.error('Export Inventory Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
