import { PartyApiService, PaymentApiService, PurchaseApiService, SaleApiService } from './api';

export interface Party {
  id: string;
  name: string;
  phoneNumber: string;
  balance: number;
  address?: string;
  email?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PartyTransaction {
  id: string;
  partyId: string;
  type: 'invoice' | 'bill' | 'payment-in' | 'payment-out';
  amount: number;
  date: string;
  reference: string; // Invoice No, Bill No, or Payment No
}

export class PartyManager {
  /**
   * Get party balance based on all transactions
   * Balance calculation rules:
   * 
   * If Net Balance is Positive:
   * 1. Sale Invoice: (Net Balance) + Invoice Amount
   * 2. Purchase Bill: (Net Balance) - Purchase Amount  
   * 3. Payment In: (Net Balance) - Payment In Amount
   * 4. Payment Out: (Net Balance) + Payment Out Amount
   * 
   * If Net Balance is Negative:
   * 1. Sale Invoice: (Net Balance) + Invoice Amount
   * 2. Purchase Bill: (Net Balance) - Purchase Amount
   * 3. Payment In: (Net Balance) - Payment In Amount
   * 4. Payment Out: (Net Balance) + Payment Out Amount
   * 
   * @param partyName - Party name
   * @param phoneNumber - Phone number
   */
  static async getPartyBalance(partyName: string, phoneNumber: string): Promise<number> {
    try {
      // Get all transactions for this party
      const transactions = await this.getPartyTransactions(partyName, phoneNumber);
      
      let balance = 0;
      
      transactions.forEach(transaction => {
        switch (transaction.type) {
          case 'invoice':
            // Sale Invoice: Always (Net Balance) + Invoice Amount
            balance = balance + transaction.amount;
            break;
          case 'bill':
            // Purchase Bill: Always (Net Balance) - Purchase Amount
            balance = balance - transaction.amount;
            break;
          case 'payment-in':
            // Payment In: Always (Net Balance) - Payment In Amount
            balance = balance - transaction.amount;
            break;
          case 'payment-out':
            // Payment Out: Always (Net Balance) + Payment Out Amount
            balance = balance + transaction.amount;
            break;
        }
      });
      
      return balance;
    } catch (error) {
      console.error('Error calculating party balance:', error);
      return 0;
    }
  }

  /**
   * Get all parties from the backend
   */
  static async getAllParties(): Promise<Party[]> {
    try {
      return await PartyApiService.getParties();
    } catch (error) {
      console.error('Error getting all parties:', error);
      return [];
    }
  }

  /**
   * Get party transactions for a specific party
   */
  static async getPartyTransactions(partyName: string, phoneNumber: string): Promise<PartyTransaction[]> {
    try {
      const transactions: PartyTransaction[] = [];
      const partyId = `${partyName.toLowerCase()}-${phoneNumber}`;
      
      // Get sales (invoices)
      const sales = await SaleApiService.getSales();
      sales.forEach(sale => {
        if (sale.partyName.toLowerCase() === partyName.toLowerCase() && 
            sale.phoneNumber === phoneNumber) {
            transactions.push({
            id: sale.id,
              partyId,
              type: 'invoice',
            amount: sale.totalAmount,
            date: sale.date,
            reference: sale.invoiceNo,
            });
          }
        });
        
      // Get purchases (bills)
      const purchases = await PurchaseApiService.getPurchases();
      purchases.forEach(purchase => {
        if (purchase.partyName.toLowerCase() === partyName.toLowerCase() &&
            purchase.phoneNumber === phoneNumber) {
            transactions.push({
            id: purchase.id,
              partyId,
              type: 'bill',
            amount: purchase.totalAmount,
            date: purchase.date,
            reference: purchase.billNo,
            });
          }
        });
        
      // Get payments
      const payments = await PaymentApiService.getPayments();
        payments.forEach(payment => {
          if (payment.partyName.toLowerCase() === partyName.toLowerCase() && 
              payment.phoneNumber === phoneNumber) {
            transactions.push({
              id: payment.id,
              partyId,
            type: payment.type as 'payment-in' | 'payment-out',
              amount: payment.amount,
              date: payment.date,
              reference: payment.paymentNo,
            });
          }
        });
      
      // Sort by date (newest first)
      return transactions.sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
    } catch (error) {
      console.error('Error getting party transactions:', error);
      return [];
    }
  }

  /**
   * Find or create a party
   */
  static async findOrCreateParty(partyData: {
    name: string;
    phoneNumber: string;
    address?: string;
    email?: string;
  }): Promise<Party> {
    try {
      return await PartyApiService.findOrCreateParty({
        ...partyData,
        balance: 0
      });
    } catch (error) {
      console.error('Error finding or creating party:', error);
      throw error;
    }
  }

  /**
   * Update party balance
   */
  static async updatePartyBalance(partyId: string, amount: number, operation: 'add' | 'subtract' | 'set'): Promise<Party> {
    try {
      return await PartyApiService.updatePartyBalance(partyId, amount, operation);
    } catch (error) {
      console.error('Error updating party balance:', error);
      throw error;
    }
  }

  /**
   * Search parties by name or phone number
   */
  static async searchParties(query: string): Promise<Party[]> {
    try {
      return await PartyApiService.getParties({ search: query });
    } catch (error) {
      console.error('Error searching parties:', error);
      return [];
    }
  }

  /**
   * Get party by ID
   */
  static async getPartyById(id: string): Promise<Party> {
    try {
      return await PartyApiService.getPartyById(id);
    } catch (error) {
      console.error('Error getting party by ID:', error);
      throw error;
    }
  }

  /**
   * Create a new party
   */
  static async createParty(partyData: {
    name: string;
    phoneNumber: string;
    address?: string;
    email?: string;
  }): Promise<Party> {
    try {
      return await PartyApiService.createParty({
        ...partyData,
        balance: 0
      });
    } catch (error) {
      console.error('Error creating party:', error);
      throw error;
    }
  }

  /**
   * Update an existing party
   */
  static async updateParty(id: string, partyData: {
    name?: string;
    phoneNumber?: string;
    address?: string;
    email?: string;
    balance?: number;
  }): Promise<Party> {
    try {
      return await PartyApiService.updateParty(id, partyData);
    } catch (error) {
      console.error('Error updating party:', error);
      throw error;
    }
  }

  /**
   * Delete a party
   */
  static async deleteParty(id: string): Promise<void> {
    try {
      await PartyApiService.deleteParty(id);
    } catch (error) {
      console.error('Error deleting party:', error);
      throw error;
    }
  }

  /**
   * Calculate party balance from transactions (alternative method)
   * This method calculates balance by fetching all transactions and computing the balance
   * Uses the exact formula: Payment In always subtracts, Payment Out always adds
   */
  static async calculatePartyBalanceFromTransactions(partyName: string, phoneNumber: string): Promise<{
    balance: number;
    totalInvoiced: number;
    totalBilled: number;
    totalPaymentIn: number;
    totalPaymentOut: number;
    transactionCount: number;
  }> {
    try {
      const transactions = await this.getPartyTransactions(partyName, phoneNumber);
      
      let balance = 0;
      let totalInvoiced = 0;
      let totalBilled = 0;
      let totalPaymentIn = 0;
      let totalPaymentOut = 0;
      
      transactions.forEach(transaction => {
        switch (transaction.type) {
          case 'invoice':
            // Sale Invoice: Always (Net Balance) + Invoice Amount
            balance = balance + transaction.amount;
            totalInvoiced += transaction.amount;
            break;
          case 'bill':
            // Purchase Bill: Always (Net Balance) - Purchase Amount
            balance = balance - transaction.amount;
            totalBilled += transaction.amount;
            break;
          case 'payment-in':
            totalPaymentIn += transaction.amount;
            // Payment In: Always (Net Balance) - Payment In Amount
            balance = balance - transaction.amount;
            break;
          case 'payment-out':
            totalPaymentOut += transaction.amount;
            // Payment Out: Always (Net Balance) + Payment Out Amount
            balance = balance + transaction.amount;
            break;
        }
      });
      
      return {
        balance,
        totalInvoiced,
        totalBilled,
        totalPaymentIn,
        totalPaymentOut,
        transactionCount: transactions.length
      };
    } catch (error) {
      console.error('Error calculating party balance from transactions:', error);
      return {
        balance: 0,
        totalInvoiced: 0,
        totalBilled: 0,
        totalPaymentIn: 0,
        totalPaymentOut: 0,
        transactionCount: 0
      };
    }
  }

  /**
   * Get parties with their calculated balances
   */
  static async getPartiesWithBalances(): Promise<Array<Party & {
    calculatedBalance: number;
    totalInvoiced: number;
    totalBilled: number;
    totalPaymentIn: number;
    totalPaymentOut: number;
    transactionCount: number;
  }>> {
    try {
      const parties = await this.getAllParties();
      const partiesWithBalances = await Promise.all(
        parties.map(async (party) => {
          const balanceData = await this.calculatePartyBalanceFromTransactions(party.name, party.phoneNumber);
          return {
            ...party,
            calculatedBalance: balanceData.balance,
            totalInvoiced: balanceData.totalInvoiced,
            totalBilled: balanceData.totalBilled,
            totalPaymentIn: balanceData.totalPaymentIn,
            totalPaymentOut: balanceData.totalPaymentOut,
            transactionCount: balanceData.transactionCount
          };
        })
      );
      
      return partiesWithBalances;
    } catch (error) {
      console.error('Error getting parties with balances:', error);
      return [];
    }
  }
}