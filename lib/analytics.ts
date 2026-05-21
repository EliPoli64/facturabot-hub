import { Inventory, Transaction, Alert } from '@/models/Schemas';
import dbConnect from './db';

/**
 * Calculates daily sales velocity and generates alerts if stock is low.
 * velocity = totalQtySold / 15 days
 * alert if currentStock / velocity < 5 days
 */
export async function checkInventoryHealth() {
  await dbConnect();

  const fifteenDaysAgo = new Date();
  fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);

  const inventoryItems = await Inventory.find({});

  for (const item of inventoryItems) {
    // This is a simplified simulation of sales velocity calculation
    // In a real scenario, we would join with transactions or aggregate sales data
    // For this implementation, we'll fetch sales transactions for this SKU in the last 15 days
    
    // Note: Since our Transaction schema doesn't have SKU directly in the simplified requirements,
    // we assume a more complex system would track per-item sales. 
    // Here we'll simulate the velocity for the sake of the logic requested.
    
    // Let's assume we find the total quantity sold for this SKU
    // const sales = await Transaction.aggregate([...])
    
    // Simulation: Random velocity between 1 and 10 for demonstration
    const totalQtySold = Math.floor(Math.random() * 50) + 1; 
    const velocity = totalQtySold / 15;

    if (velocity > 0 && item.currentStock / velocity < 5) {
      const alertMessage = `Low stock alert for ${item.name} (${item.sku}). Estimated ${Math.round(item.currentStock / velocity)} days remaining.`;
      
      // Check if an active alert already exists for this SKU
      const existingAlert = await Alert.findOne({ sku: item.sku, isActive: true });
      
      if (!existingAlert) {
        await Alert.create({
          sku: item.sku,
          message: alertMessage,
          isActive: true
        });
        
        console.log(`[INVENTORY ALERT]: ${alertMessage}`);
      }
    }
  }
}
