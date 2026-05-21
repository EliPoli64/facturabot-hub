import mongoose, { Schema, Document, Model } from 'mongoose';

// Inventory Schema
export interface IInventory extends Document {
  sku: string;
  name: string;
  currentStock: number;
  purchasePrice: number;
  salePrice: number;
}

const inventorySchema = new Schema<IInventory>({
  sku: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  currentStock: { type: Number, required: true, default: 0 },
  purchasePrice: { type: Number, required: true },
  salePrice: { type: Number, required: true },
}, { timestamps: true });

// Transactions Schema
export interface ITransaction extends Document {
  type: 'PURCHASE' | 'SALE';
  source: 'XML' | 'OCR' | 'TELEGRAM';
  merchantName: string;
  subTotal: number;
  taxAmount: number;
  createdAt: Date;
}

const transactionSchema = new Schema<ITransaction>({
  type: { type: String, enum: ['PURCHASE', 'SALE'], required: true },
  source: { type: String, enum: ['XML', 'OCR', 'TELEGRAM'], required: true },
  merchantName: { type: String, required: true },
  subTotal: { type: Number, required: true },
  taxAmount: { type: Number, required: true },
}, { timestamps: true });

// Alerts Schema
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

// Model exports
export const Inventory: Model<IInventory> = mongoose.models.Inventory || mongoose.model<IInventory>('Inventory', inventorySchema);
export const Transaction: Model<ITransaction> = mongoose.models.Transaction || mongoose.model<ITransaction>('Transaction', transactionSchema);
export const Alert: Model<IAlert> = mongoose.models.Alert || mongoose.model<IAlert>('Alert', alertSchema);
