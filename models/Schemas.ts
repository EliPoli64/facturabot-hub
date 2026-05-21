import mongoose, { Schema, Document, Model } from 'mongoose';

// ==========================================
// 1. CHART OF ACCOUNTS SCHEMA (Catálogo de Cuentas)
// ==========================================
export interface IChartOfAccounts extends Document {
  code: string;       // Ej: "1-1-03-01", "5-1-99-01"
  name: string;       // Ej: "Inventario de Mercancías", "Gastos No Deducibles"
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE' | 'COST';
  isActive: boolean;
}

const chartOfAccountsSchema = new Schema<IChartOfAccounts>({
  code: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE', 'COST'], required: true },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });


// ==========================================
// 2. JOURNAL ENTRIES SCHEMA (Asientos Contables)
// ==========================================
interface IJournalLine {
  accountCode: string;
  accountName: string;
  type: 'DEBIT' | 'CREDIT';
  amountCrc: number; // Siempre asentado en la moneda local por ley de Costa Rica
}

export interface IJournalEntry extends Document {
  date: Date;
  description: string;
  transactionId?: mongoose.Types.ObjectId; // Referencia opcional a la factura origen
  liquidationId?: mongoose.Types.ObjectId;   // Referencia opcional si viene de un cierre de fletes
  lines: IJournalLine[];
}

const journalEntrySchema = new Schema<IJournalEntry>({
  date: { type: Date, required: true },
  description: { type: String, required: true },
  transactionId: { type: Schema.Types.ObjectId, ref: 'Transaction' },
  liquidationId: { type: Schema.Types.ObjectId, ref: 'LandedCostLiquidation' },
  lines: [{
    accountCode: { type: String, required: true },
    accountName: { type: String, required: true },
    type: { type: String, enum: ['DEBIT', 'CREDIT'], required: true },
    amountCrc: { type: Number, required: true }
  }]
}, { timestamps: true });


// ==========================================
// 3. INVENTORY SCHEMA (Expandido con Costeo)
// ==========================================
export interface IInventory extends Document {
  sku: string;
  name: string;
  currentStock: number;
  purchasePrice: number;      // Precio FOB / Precio base de compra
  landedCost: number;         // Costo real unitario puesto en bodega (Base + Prorrateo de Fletes)
  salePrice?: number;
  lastImportId?: mongoose.Types.ObjectId; // ID de la última liquidación de aduanas que afectó el costo
}

const inventorySchema = new Schema<IInventory>({
  sku: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  currentStock: { type: Number, required: true, default: 0 },
  purchasePrice: { type: Number, required: true },
  landedCost: { type: Number, required: true }, // Al crear un producto inicial, se iguala a purchasePrice
  salePrice: { type: Number },
  lastImportId: { type: Schema.Types.ObjectId, ref: 'LandedCostLiquidation' }
}, { timestamps: true });


// ==========================================
// 4. TRANSACTIONS SCHEMA (Expandido Fiscal e Internacional)
// ==========================================
interface IFiscalAnalysis {
  purchaseType: 'product_purchase' | 'service_contract' | 'operational_expense';
  isDeductibleHacienda: boolean;
  haciendaJustification: string;
  suggestedAccountCode: string;
  suggestedAccountName: string;
}

interface ITransactionItem {
  sku?: string;
  description: string;
  quantity: number;
  unitPriceForeign: number;
  discount: number;
  taxAmountForeign: number;
  totalLineForeign: number;
}

export interface ITransaction extends Document {
  type: 'PURCHASE' | 'SALE';
  source: 'XML' | 'OCR' | 'TELEGRAM' | 'MANUAL';
  documentType: 'hacienda_xml' | 'national_pdf' | 'foreign_invoice' | 'pos_ticket' | 'customs_policy';
  origin: 'national' | 'international';
  documentId: string;       // Clave de 50 dígitos o número de Invoice internacional
  merchantName: string;
  merchantTaxId: string;     // Cédula jurídica/física o Tax ID extranjero
  currency: string;          // CRC, USD, EUR
  exchangeRate: number;      // Tipo de cambio respecto al CRC a la fecha de emisión
  items: ITransactionItem[];
  subTotalForeign: number;
  taxAmountForeign: number;
  grandTotalForeign: number;
  grandTotalCrc: number;     // Guardado estático para reportería ágil en Costa Rica
  fiscalAnalysis?: IFiscalAnalysis; // Nulo si type es 'SALE'
}

const transactionSchema = new Schema<ITransaction>({
  type: { type: String, enum: ['PURCHASE', 'SALE'], required: true },
  source: { type: String, enum: ['XML', 'OCR', 'TELEGRAM', 'MANUAL'], required: true },
  documentType: { type: String, enum: ['hacienda_xml', 'national_pdf', 'foreign_invoice', 'pos_ticket'], required: true },
  origin: { type: String, enum: ['national', 'international'], required: true },
  documentId: { type: String, required: true, unique: true },
  merchantName: { type: String, required: true },
  merchantTaxId: { type: String, required: true },
  currency: { type: String, required: true, default: 'CRC' },
  exchangeRate: { type: Number, required: true, default: 1.0 },
  items: [{
    sku: { type: String },
    description: { type: String, required: true },
    quantity: { type: Number, required: true },
    unitPriceForeign: { type: Number, required: true },
    discount: { type: Number, required: true, default: 0 },
    taxAmountForeign: { type: Number, required: true, default: 0 },
    totalLineForeign: { type: Number, required: true }
  }],
  subTotalForeign: { type: Number, required: true },
  taxAmountForeign: { type: Number, required: true },
  grandTotalForeign: { type: Number, required: true },
  grandTotalCrc: { type: Number, required: true },
  fiscalAnalysis: {
    purchaseType: { type: String, enum: ['product_purchase', 'service_contract', 'operational_expense'] },
    isDeductibleHacienda: { type: Boolean },
    haciendaJustification: { type: String },
    suggestedAccountCode: { type: String },
    suggestedAccountName: { type: String }
  }
}, { timestamps: true });

transactionSchema.post('save', async function(doc) {
  if (!doc.items || doc.items.length === 0) {
    return;
  }

  for (const item of doc.items) {
    // If an SKU is missing, generate one from the first 12 chars of the description.
    const sku = item.sku || item.description.substring(0, 12).toUpperCase().replace(/\s/g, '-');

    // If we still don't have a SKU (e.g., empty description), we must skip it.
    if (!sku) {
      continue;
    }

    const quantityChange = doc.type === 'PURCHASE' ? item.quantity : -item.quantity;

    if (doc.type === 'PURCHASE') {
      const purchasePrice = item.unitPriceForeign * doc.exchangeRate;
      await mongoose.model('Inventory').findOneAndUpdate(
        { sku: sku },
        {
          $inc: { currentStock: quantityChange },
          $set: {
            name: item.description,
            purchasePrice: purchasePrice,
            landedCost: purchasePrice, // Default landedCost to purchasePrice initially
          }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } else if (doc.type === 'SALE') {
      // For a sale, just decrement the stock. Do not create the item if it doesn't exist.
      await mongoose.model('Inventory').updateOne(
        { sku: sku },
        { $inc: { currentStock: quantityChange } }
      );
    }
  }
});


// ==========================================
// 5. LANDED COST LIQUIDATION SCHEMA (Nuevo - Prorrateo de Importaciones)
// ==========================================
interface IAssociatedExpense {
  transactionId: mongoose.Types.ObjectId; // Referencia a la factura local del flete/aduana (ej: DHL, Naviera)
  expenseType: 'freight' | 'customs_duty' | 'handling';
  amountCrc: number;
}

export interface ILandedCostLiquidation extends Document {
  foreignInvoiceId: mongoose.Types.ObjectId; // Referencia a la factura internacional (`foreign_invoice`)
  associatedExpenses: IAssociatedExpense[];
  totalExpensesCrc: number;
  distributionMethod: 'VALUE' | 'QUANTITY'; // Criterio seleccionado por el retail
  isApplied: boolean;                       // Bandera que indica si ya modificó el stock/costo de Inventory
}

const landedCostLiquidationSchema = new Schema<ILandedCostLiquidation>({
  foreignInvoiceId: { type: Schema.Types.ObjectId, ref: 'Transaction', required: true },
  associatedExpenses: [{
    transactionId: { type: Schema.Types.ObjectId, ref: 'Transaction', required: true },
    expenseType: { type: String, enum: ['freight', 'customs_duty', 'handling'], required: true },
    amountCrc: { type: Number, required: true }
  }],
  totalExpensesCrc: { type: Number, required: true },
  distributionMethod: { type: String, enum: ['VALUE', 'QUANTITY'], required: true },
  isApplied: { type: Boolean, default: false }
}, { timestamps: true });


// ==========================================
// 6. ALERTS SCHEMA (Original - Sin cambios)
// ==========================================
export interface IAlert extends Document {
  sku: string;
  message: string;
  isActive: boolean;
  createdAt: Date;
}

const alertSchema = new Schema<IAlert>({
  sku: { type: String, required: true },
  message: { type: String, required: true },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });


// ==========================================
// MODEL EXPORTS (Haciendo uso del Cache de Next.js / Hot Reload)
// ==========================================
export const ChartOfAccounts: Model<IChartOfAccounts> = mongoose.models.ChartOfAccounts || mongoose.model<IChartOfAccounts>('ChartOfAccounts', chartOfAccountsSchema);
export const JournalEntry: Model<IJournalEntry> = mongoose.models.JournalEntry || mongoose.model<IJournalEntry>('JournalEntry', journalEntrySchema);
export const Inventory: Model<IInventory> = mongoose.models.Inventory || mongoose.model<IInventory>('Inventory', inventorySchema);
export const Transaction: Model<ITransaction> = mongoose.models.Transaction || mongoose.model<ITransaction>('Transaction', transactionSchema);
export const LandedCostLiquidation: Model<ILandedCostLiquidation> = mongoose.models.LandedCostLiquidation || mongoose.model<ILandedCostLiquidation>('LandedCostLiquidation', landedCostLiquidationSchema);
export const Alert: Model<IAlert> = mongoose.models.Alert || mongoose.model<IAlert>('Alert', alertSchema);