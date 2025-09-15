import { Item, ItemsApiService } from './api';

// Environment-based logging helper
const isDevelopment = __DEV__ || process.env.NODE_ENV === 'development';

const log = (message: string, ...args: any[]) => {
  if (isDevelopment) {
    console.log(message, ...args);
  }
};

const logError = (message: string, ...args: any[]) => {
  console.error(message, ...args);
};

const logWarn = (message: string, ...args: any[]) => {
  console.warn(message, ...args);
};

interface SaleItem {
  id: string;
  itemName: string;
  quantity: number; // in kg
  rate: number;
  total: number;
}

export class StockManager {
  // Track processed invoices to prevent duplicate stock updates
  private static processedInvoices = new Set<string>();

  /**
   * Initialize the universal Bardana item if it doesn't exist
   */
  static async initializeBardana(): Promise<void> {
    try {
      // Use backend API to initialize Bardana
      await ItemsApiService.initializeBardana();
      console.log('Bardana universal item initialized successfully via backend');
    } catch (error) {
      console.error('Error initializing Bardana:', error);
      throw error;
    }
  }

  /**
   * Update stock levels when items are sold
   * @param soldItems Array of items that were sold
   * @param invoiceId Optional invoice ID to prevent duplicate processing
   */
  static async updateStockOnSale(soldItems: SaleItem[], invoiceId?: string): Promise<void> {
    try {
      // Validate input
      if (!soldItems || soldItems.length === 0) {
        log('No items to update stock for');
        return;
      }

      // Check if this invoice has already been processed
      if (invoiceId && this.processedInvoices.has(invoiceId)) {
        log(`Invoice ${invoiceId} has already been processed for stock update`);
        return;
      }

      log(`Updating stock for ${soldItems.length} sold items`);
      soldItems.forEach(item => {
        log(`- ${item.itemName}: ${item.quantity} kg`);
      });

      // Create a map of sold items by name for quick lookup
      const soldItemsMap = new Map<string, number>();
      soldItems.forEach(item => {
        const currentQty = soldItemsMap.get(item.itemName) || 0;
        soldItemsMap.set(item.itemName, currentQty + item.quantity);
      });

      // Log consolidated quantities for debugging
      log('Consolidated quantities by item:');
      soldItemsMap.forEach((quantity, itemName) => {
        log(`- ${itemName}: ${quantity} kg total`);
      });

      // Calculate total Bardana reduction needed
      let totalBardanaReduction = 0;
      soldItems.forEach(item => {
        // For each kg of item sold, reduce 1 kg of Bardana
        totalBardanaReduction += item.quantity;
      });
      
      log(`Total Bardana reduction needed: ${totalBardanaReduction} kg`);

      // Update Bardana stock using backend API
      if (totalBardanaReduction > 0) {
        await ItemsApiService.updateBardanaStock('subtract', totalBardanaReduction);
        log(`Bardana stock reduced by ${totalBardanaReduction} kg via backend`);
      }

      // Update individual item stocks
      for (const [itemName, quantity] of soldItemsMap) {
        try {
          // Get the item from backend
          const items = await ItemsApiService.getItems({ search: itemName });
          const item = items.find(i => i.productName === itemName);
          
          if (item && item.id) {
            // Convert kg to bags (1 bag = 30 kg)
            const soldBags = quantity / 30;
            const newStock = Math.max(0, Math.round((item.openingStock - soldBags) * 100) / 100);
            
            // Update item stock via backend
            await ItemsApiService.updateItem(item.id, { openingStock: newStock });
            log(`${itemName} stock reduced from ${item.openingStock} bags to ${newStock} bags`);
          } else {
            logWarn(`Item ${itemName} not found in backend`);
          }
        } catch (error) {
          logError(`Error updating stock for ${itemName}:`, error);
        }
      }

      // Mark this invoice as processed if ID was provided
      if (invoiceId) {
        this.processedInvoices.add(invoiceId);
        log(`Invoice ${invoiceId} marked as processed for stock update`);
      }
    } catch (error) {
      logError('Error updating stock on sale:', error);
      throw error;
    }
  }

  /**
   * Update stock levels when items are purchased
   * @param purchasedItems Array of items that were purchased
   */
  static async updateStockOnPurchase(purchasedItems: SaleItem[]): Promise<void> {
    try {
      // Validate input
      if (!purchasedItems || purchasedItems.length === 0) {
        log('No items to update stock for');
        return;
      }

      log(`Updating stock for ${purchasedItems.length} purchased items`);
      purchasedItems.forEach(item => {
        log(`- ${item.itemName}: ${item.quantity} kg`);
      });

      // Create a map of purchased items by name for quick lookup
      const purchasedItemsMap = new Map<string, number>();
      purchasedItems.forEach(item => {
        const currentQty = purchasedItemsMap.get(item.itemName) || 0;
        purchasedItemsMap.set(item.itemName, currentQty + item.quantity);
      });

      // Log consolidated quantities for debugging
      log('Consolidated quantities by item:');
      purchasedItemsMap.forEach((quantity, itemName) => {
        log(`- ${itemName}: ${quantity} kg total`);
      });

      // Calculate total Bardana addition needed
      let totalBardanaAddition = 0;
      purchasedItems.forEach(item => {
        // For each kg of item purchased, add 1 kg of Bardana
        totalBardanaAddition += item.quantity;
      });

      // Update Bardana stock using backend API
      if (totalBardanaAddition > 0) {
        await ItemsApiService.updateBardanaStock('add', totalBardanaAddition);
        log(`Bardana stock increased by ${totalBardanaAddition} kg via backend`);
      }

      // Update individual item stocks
      for (const [itemName, quantity] of purchasedItemsMap) {
        try {
          // Get the item from backend
          const items = await ItemsApiService.getItems({ search: itemName });
          const item = items.find(i => i.productName === itemName);
          
          if (item && item.id) {
            // Convert kg to bags (1 bag = 30 kg)
            const purchasedBags = quantity / 30;
            const newStock = Math.round((item.openingStock + purchasedBags) * 100) / 100;
            
            // Update item stock via backend
            await ItemsApiService.updateItem(item.id, { openingStock: newStock });
            log(`${itemName} stock increased from ${item.openingStock} bags to ${newStock} bags`);
          } else {
            logWarn(`Item ${itemName} not found in backend`);
          }
        } catch (error) {
          logError(`Error updating stock for ${itemName}:`, error);
        }
      }
    } catch (error) {
      logError('Error updating stock on purchase:', error);
      throw error;
    }
  }

  /**
   * Revert stock changes when an invoice is deleted or cancelled
   * @param soldItems Array of items that were sold (to be reverted)
   */
  static async revertStockOnSale(soldItems: SaleItem[]): Promise<void> {
    try {
      // Create a map of sold items by name for quick lookup
      const soldItemsMap = new Map<string, number>();
      soldItems.forEach(item => {
        const currentQty = soldItemsMap.get(item.itemName) || 0;
        soldItemsMap.set(item.itemName, currentQty + item.quantity);
      });

      // Log consolidated quantities for debugging
      console.log('Consolidated quantities by item for reversion:');
      soldItemsMap.forEach((quantity, itemName) => {
        console.log(`- ${itemName}: ${quantity} kg total to restore`);
      });

      // Calculate total Bardana restoration needed
      let totalBardanaRestoration = 0;
      soldItems.forEach(item => {
        // For each kg of item restored, restore 1 kg of Bardana
        totalBardanaRestoration += item.quantity;
      });

      // Restore Bardana stock using backend API
      if (totalBardanaRestoration > 0) {
        await ItemsApiService.updateBardanaStock('add', totalBardanaRestoration);
        console.log(`Bardana stock restored by ${totalBardanaRestoration} kg via backend`);
      }

      // Restore individual item stocks
      for (const [itemName, quantity] of soldItemsMap) {
        try {
          // Get the item from backend
          const items = await ItemsApiService.getItems({ search: itemName });
          const item = items.find(i => i.productName === itemName);
          
          if (item && item.id) {
            // Convert kg to bags (1 bag = 30 kg)
            const soldBags = quantity / 30;
            const newStock = Math.round((item.openingStock + soldBags) * 100) / 100;
            
            // Update item stock via backend
            await ItemsApiService.updateItem(item.id, { openingStock: newStock });
            console.log(`${itemName} stock restored from ${item.openingStock} bags to ${newStock} bags`);
          } else {
            console.warn(`Item ${itemName} not found in backend`);
          }
        } catch (error) {
          console.error(`Error restoring stock for ${itemName}:`, error);
        }
      }
    } catch (error) {
      console.error('Error reverting stock on sale:', error);
      throw error;
    }
  }

  /**
   * Get current stock level for an item
   * @param itemName Name of the item
   * @returns Current stock in kg
   */
  static async getItemStock(itemName: string): Promise<number> {
    try {
      const items = await ItemsApiService.getItems({ search: itemName });
      const item = items.find(i => i.productName === itemName);
      
      if (!item) return 0;

      // Convert bags to kg (1 bag = 30 kg)
      return Math.round(item.openingStock * 30);
    } catch (error) {
      console.error('Error getting item stock:', error);
      return 0;
    }
  }

  /**
   * Check if item has sufficient stock for sale
   * @param itemName Name of the item
   * @param requiredQuantity Required quantity in kg
   * @returns True if sufficient stock is available
   */
  static async hasSufficientStock(itemName: string, requiredQuantity: number): Promise<boolean> {
    const currentStock = await this.getItemStock(itemName);
    return currentStock >= requiredQuantity;
  }

  /**
   * Clear processed invoices tracking (useful for app restart or testing)
   */
  static clearProcessedInvoices(): void {
    this.processedInvoices.clear();
    console.log('Processed invoices tracking cleared');
  }

  /**
   * Check if an invoice has been processed for stock update
   * @param invoiceId Invoice ID to check
   * @returns True if invoice has been processed
   */
  static isInvoiceProcessed(invoiceId: string): boolean {
    return this.processedInvoices.has(invoiceId);
  }

  /**
   * Remove an invoice from processed list (useful for testing or reprocessing)
   * @param invoiceId Invoice ID to remove
   */
  static removeProcessedInvoice(invoiceId: string): void {
    this.processedInvoices.delete(invoiceId);
    console.log(`Invoice ${invoiceId} removed from processed list`);
  }

  /**
   * Get count of processed invoices (useful for debugging)
   * @returns Number of processed invoices
   */
  static getProcessedInvoicesCount(): number {
    return this.processedInvoices.size;
  }

  /**
   * Get all processed invoice IDs (useful for debugging)
   * @returns Array of processed invoice IDs
   */
  static getProcessedInvoiceIds(): string[] {
    return Array.from(this.processedInvoices);
  }

  /**
   * Get Bardana stock level
   * @returns Current Bardana stock in kg
   */
  static async getBardanaStock(): Promise<number> {
    try {
      const bardana = await ItemsApiService.getBardana();
      // Convert bags to kg (1 bag = 30 kg)
      return Math.round(bardana.openingStock * 30);
    } catch (error) {
      console.error('Error getting Bardana stock:', error);
      return 0;
    }
  }

  /**
   * Get all items with their current stock levels
   * @returns Array of items with stock information
   */
  static async getAllItemsWithStock(): Promise<Item[]> {
    try {
      return await ItemsApiService.getItems();
    } catch (error) {
      console.error('Error getting all items with stock:', error);
      return [];
    }
  }

  /**
   * Get low stock items (items below their low stock alert threshold)
   * @returns Array of items with low stock
   */
  static async getLowStockItems(): Promise<Item[]> {
    try {
      const items = await ItemsApiService.getItems();
      return items.filter(item => item.openingStock <= item.lowStockAlert);
    } catch (error) {
      console.error('Error getting low stock items:', error);
      return [];
    }
  }

  /**
   * Check if Bardana has sufficient stock
   * @param requiredQuantity Required quantity in kg
   * @returns True if sufficient Bardana stock is available
   */
  static async hasSufficientBardanaStock(requiredQuantity: number): Promise<boolean> {
    const currentStock = await this.getBardanaStock();
    return currentStock >= requiredQuantity;
  }
}
