import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { Transaction, LandedCostLiquidation, Inventory, JournalEntry } from '@/models/Schemas';

export async function GET() {
  try {
    await dbConnect();

    // 1. Obtener transacciones internacionales de compra (Invoices del proveedor extranjero)
    const foreignInvoices = await Transaction.find({
      type: 'PURCHASE',
      documentType: 'foreign_invoice',
    }).sort({ createdAt: -1 }).lean();

    // 2. Obtener gastos locales elegibles para prorrateo (Fletes, DAI/DAF, Agencias de Aduana)
    // Son compras (PURCHASE) que no son facturas internacionales
    const localExpenses = await Transaction.find({
      type: 'PURCHASE',
      documentType: { $ne: 'foreign_invoice' },
    }).sort({ createdAt: -1 }).lean();

    // 3. Obtener liquidaciones previas para saber cuáles ya están aplicadas
    const liquidations = await LandedCostLiquidation.find({}).lean();
    const liquidatedInvoiceIds = new Set(
      liquidations.filter((l) => l.isApplied).map((l) => l.foreignInvoiceId.toString())
    );

    return NextResponse.json({
      foreignInvoices: foreignInvoices.map((inv: any) => ({
        ...inv,
        isLiquidated: liquidatedInvoiceIds.has(inv._id.toString()),
      })),
      localExpenses,
      liquidations,
    });
  } catch (error) {
    console.error('Error fetching landed cost data:', error);
    return NextResponse.json({ error: 'Error al cargar facturas y gastos.' }, { status: 500 });
  }
}

// POST: Crear/Calcular borrador de liquidación de costos de importación
export async function POST(request: Request) {
  try {
    await dbConnect();
    const body = await request.json();
    const { foreignInvoiceId, associatedExpenses, distributionMethod } = body;

    if (!foreignInvoiceId || !associatedExpenses || !distributionMethod) {
      return NextResponse.json({ error: 'Faltan parámetros requeridos.' }, { status: 400 });
    }

    // 1. Obtener la factura de importación (Foreign Invoice)
    const foreignInvoice = await Transaction.findById(foreignInvoiceId).lean();
    if (!foreignInvoice) {
      return NextResponse.json({ error: 'Factura internacional no encontrada.' }, { status: 404 });
    }

    // Calcular el total de gastos asociados en CRC
    const totalExpensesCrc = associatedExpenses.reduce((sum: number, exp: any) => sum + (Number(exp.amountCrc) || 0), 0);

    // 2. Crear borrador de liquidación (no aplicado aún)
    const liquidation = await LandedCostLiquidation.create({
      foreignInvoiceId,
      associatedExpenses,
      totalExpensesCrc,
      distributionMethod,
      isApplied: false,
    });

    // 3. Calcular prorrateo de ítems
    const items = foreignInvoice.items || [];
    const exchangeRate = foreignInvoice.exchangeRate || 1.0;

    let totalValueCrc = 0;
    let totalQuantity = 0;

    items.forEach((item: any) => {
      const lineCostCrc = item.quantity * item.unitPriceForeign * exchangeRate;
      totalValueCrc += lineCostCrc;
      totalQuantity += item.quantity;
    });

    if (totalValueCrc === 0 || totalQuantity === 0) {
      return NextResponse.json({ error: 'La factura internacional seleccionada no contiene artículos o cantidades válidas.' }, { status: 400 });
    }

    const calculations = items.map((item: any) => {
      const baseCostCrc = item.unitPriceForeign * exchangeRate;
      const totalLineCrc = item.quantity * baseCostCrc;

      let allocatedExpenseCrc = 0;
      if (distributionMethod === 'VALUE') {
        const weight = totalLineCrc / totalValueCrc;
        allocatedExpenseCrc = totalExpensesCrc * weight;
      } else { // QUANTITY
        const weight = item.quantity / totalQuantity;
        allocatedExpenseCrc = totalExpensesCrc * weight;
      }

      const unitExpenseCrc = allocatedExpenseCrc / item.quantity;
      const unitLandedCostCrc = baseCostCrc + unitExpenseCrc;

      return {
        sku: item.sku || item.description.substring(0, 12).toUpperCase().replace(/\s/g, '-'),
        name: item.description,
        quantity: item.quantity,
        baseCostCrc,
        allocatedExpenseCrc,
        unitExpenseCrc,
        unitLandedCostCrc,
      };
    });

    return NextResponse.json({
      success: true,
      liquidationId: liquidation._id,
      totalExpensesCrc,
      distributionMethod,
      calculations,
    });
  } catch (error) {
    console.error('Error calculando importación:', error);
    return NextResponse.json({ error: 'Error al calcular la importación.' }, { status: 500 });
  }
}

// PATCH: Aplicar la liquidación de costos al inventario y registrar asiento contable
export async function PATCH(request: Request) {
  try {
    await dbConnect();
    const { liquidationId } = await request.json();

    if (!liquidationId) {
      return NextResponse.json({ error: 'ID de liquidación requerido.' }, { status: 400 });
    }

    const liquidation = await LandedCostLiquidation.findById(liquidationId);
    if (!liquidation) {
      return NextResponse.json({ error: 'Liquidación no encontrada.' }, { status: 404 });
    }

    if (liquidation.isApplied) {
      return NextResponse.json({ error: 'Esta liquidación ya ha sido aplicada al inventario anteriormente.' }, { status: 400 });
    }

    // 1. Obtener la factura de importación asociada
    const foreignInvoice = await Transaction.findById(liquidation.foreignInvoiceId);
    if (!foreignInvoice) {
      return NextResponse.json({ error: 'Factura internacional asociada no encontrada.' }, { status: 404 });
    }

    const exchangeRate = foreignInvoice.exchangeRate || 1.0;
    const items = foreignInvoice.items || [];
    const totalExpensesCrc = liquidation.totalExpensesCrc;
    const distributionMethod = liquidation.distributionMethod;

    let totalValueCrc = 0;
    let totalQuantity = 0;

    items.forEach((item: any) => {
      totalValueCrc += item.quantity * item.unitPriceForeign * exchangeRate;
      totalQuantity += item.quantity;
    });

    if (totalValueCrc === 0 || totalQuantity === 0) {
      return NextResponse.json({ error: 'La factura internacional asociada no tiene artículos válidos.' }, { status: 400 });
    }

    // 2. Actualizar el costo landed de cada producto en Inventory
    for (const item of items) {
      const sku = item.sku || item.description.substring(0, 12).toUpperCase().replace(/\s/g, '-');
      const baseCostCrc = item.unitPriceForeign * exchangeRate;
      const totalLineCrc = item.quantity * baseCostCrc;

      let allocatedExpenseCrc = 0;
      if (distributionMethod === 'VALUE') {
        const weight = totalLineCrc / totalValueCrc;
        allocatedExpenseCrc = totalExpensesCrc * weight;
      } else { // QUANTITY
        const weight = item.quantity / totalQuantity;
        allocatedExpenseCrc = totalExpensesCrc * weight;
      }

      const unitExpenseCrc = allocatedExpenseCrc / item.quantity;
      const unitLandedCostCrc = baseCostCrc + unitExpenseCrc;

      // Actualizamos o creamos en el inventario
      await Inventory.findOneAndUpdate(
        { sku },
        {
          $set: {
            landedCost: Math.round(unitLandedCostCrc * 100) / 100,
            lastImportId: liquidation._id,
          },
        },
        { upsert: true }
      );
    }

    // 3. Crear asiento contable (Journal Entry) de capitalización
    // Debit: 1-1-03-01 (Inventario de Mercancías) para sumar el valor capitalizado de fletes/aduanas
    // Credit: 5-1-04-01 (Gasto por Fletes y Transportes) para descargar los gastos asociados capitalizados
    await JournalEntry.create({
      date: new Date(),
      description: `Capitalización costos de importación - Invoice ${foreignInvoice.documentId}`,
      lines: [
        {
          accountCode: '1-1-03-01',
          accountName: 'Inventario de Mercancías',
          type: 'DEBIT',
          amountCrc: totalExpensesCrc,
        },
        {
          accountCode: '5-1-04-01',
          accountName: 'Gasto por Fletes y Transportes',
          type: 'CREDIT',
          amountCrc: totalExpensesCrc,
        },
      ],
    });

    // 4. Marcar la liquidación como aplicada
    liquidation.isApplied = true;
    await liquidation.save();

    return NextResponse.json({
      success: true,
      message: 'Liquidación aplicada con éxito. Se actualizó el inventario y se registró el asiento contable.',
    });
  } catch (error) {
    console.error('Error aplicando importación:', error);
    return NextResponse.json({ error: 'Error al aplicar los costos de importación.' }, { status: 500 });
  }
}
