import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { Transaction } from '@/models/Schemas';
import * as XLSX from 'xlsx';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const format = req.nextUrl.searchParams.get('format') || 'xlsx';

    const transactions = await Transaction.find({}).sort({ createdAt: -1 });

    const rows = transactions.map((tx) => ({
      ID: tx.documentId,
      Tipo: tx.type === 'SALE' ? 'Venta' : 'Compra',
      Origen: tx.source,
      'Doc. Type': tx.documentType,
      Moneda: tx.currency,
      'Tipo Cambio': tx.exchangeRate,
      Proveedor: tx.merchantName,
      'Cédula': tx.merchantTaxId,
      Subtotal: tx.subTotalForeign,
      Impuesto: tx.taxAmountForeign,
      Total: tx.grandTotalForeign,
      'Total CRC': tx.grandTotalCrc,
      Fecha: (tx as any).createdAt?.toISOString().split('T')[0] || '',
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

      XLSX.utils.book_append_sheet(workbook, sheet, 'Transacciones');

      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="transacciones-${new Date().toISOString().split('T')[0]}.xlsx"`,
        },
      });
    }

    if (format === 'pdf') {
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      let page = pdfDoc.addPage([595, 842]);
      const { width, height } = page.getSize();
      const margin = 40;
      const usableWidth = width - margin * 2;
      const lineHeight = 14;

      let y = height - margin;

      function drawHeader(title: string) {
        page.drawText(title, { x: margin, y, size: 18, font: boldFont, color: rgb(0.1, 0.1, 0.1) });
        y -= 20;
        page.drawText(`Generado: ${new Date().toLocaleDateString('es-CR')}`, {
          x: margin, y, size: 10, font, color: rgb(0.4, 0.4, 0.4),
        });
        y -= 24;

        const columns = ['Fecha', 'Tipo', 'Proveedor', 'Total CRC'];
        const colX = [margin, margin + 90, margin + 150, margin + 350];

        page.drawText(columns[0], { x: colX[0], y, size: 9, font: boldFont, color: rgb(0.2, 0.2, 0.2) });
        page.drawText(columns[1], { x: colX[1], y, size: 9, font: boldFont, color: rgb(0.2, 0.2, 0.2) });
        page.drawText(columns[2], { x: colX[2], y, size: 9, font: boldFont, color: rgb(0.2, 0.2, 0.2) });
        page.drawText(columns[3], { x: colX[3], y, size: 9, font: boldFont, color: rgb(0.2, 0.2, 0.2) });

        y -= 2;
        page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
        y -= 10;
      }

      drawHeader('Reporte de Transacciones');

      for (const row of rows) {
        if (y < 60) {
          page = pdfDoc.addPage([595, 842]);
          y = height - margin;
          drawHeader('Reporte de Transacciones (cont.)');
        }

        page.drawText(row.Fecha, { x: margin, y, size: 8, font, color: rgb(0.2, 0.2, 0.2) });
        page.drawText(row.Tipo, { x: margin + 90, y, size: 8, font, color: rgb(0.2, 0.2, 0.2) });
        page.drawText(row.Proveedor, { x: margin + 150, y, size: 8, font, color: rgb(0.2, 0.2, 0.2) });
        page.drawText(String(row['Total CRC']), { x: margin + 350, y, size: 8, font, color: rgb(0.2, 0.2, 0.2) });

        y -= lineHeight + 2;
      }

      const pdfBytes = await pdfDoc.save();

      return new Response(new Uint8Array(pdfBytes), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="transacciones-${new Date().toISOString().split('T')[0]}.pdf"`,
        },
      });
    }

    return NextResponse.json({ error: 'Invalid format. Use ?format=xlsx or ?format=pdf' }, { status: 400 });
  } catch (error: unknown) {
    console.error('Export Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
