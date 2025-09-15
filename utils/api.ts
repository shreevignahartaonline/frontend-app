// API Configuration
const API_BASE_URL = 'https://backend-app-v43g.onrender.com'; // Update this to your backend URL

// Company Details Interface
export interface CompanyDetails {
  id?: string;
  businessName: string;
  phoneNumber1: string;
  phoneNumber2: string;
  emailId: string;
  businessAddress: string;
  pincode: string;
  businessDescription: string;
  signature: string;
  profileImage?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Item Interface
export interface Item {
  _id?: string;
  id?: string;
  productName: string;
  category: 'Primary' | 'Kirana';
  purchasePrice: number;
  salePrice: number;
  openingStock: number; // in bags
  asOfDate: string;
  lowStockAlert: number; // in bags
  isUniversal?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// Item Summary Statistics Interface
export interface ItemSummaryStats {
  totalItems: number;
  primaryItems: number;
  kiranaItems: number;
  universalItems: number;
  totalStockValue: number;
  lowStockCount: number;
  lowStockItems: Array<{
    id: string;
    productName: string;
    currentStock: number;
    lowStockAlert: number;
    stockInKg: number;
  }>;
}

// Party Interface
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

// Sale Item Interface
export interface SaleItem {
  id: string;
  itemName: string;
  quantity: number;
  rate: number;
  total: number;
}

// Sale Invoice Interface
export interface SaleInvoice {
  id: string;
  invoiceNo: string;
  partyName: string;
  phoneNumber: string;
  items: SaleItem[];
  totalAmount: number;
  date: string;
  pdfUri?: string;
  partyId?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Purchase Item Interface
export interface PurchaseItem {
  id: string;
  itemName: string;
  quantity: number;
  rate: number;
  total: number;
}

// Purchase Bill Interface
export interface PurchaseBill {
  id: string;
  billNo: string;
  partyName: string;
  phoneNumber: string;
  items: PurchaseItem[];
  totalAmount: number;
  date: string;
  pdfUri?: string;
  partyId?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Payment Interface
export interface Payment {
  id: string;
  paymentNo: string;
  type: 'payment-in' | 'payment-out';
  partyName: string;
  phoneNumber: string;
  amount: number;
  totalAmount: number;
  date: string;
  description?: string;
  paymentMethod: 'cash' | 'bank_transfer' | 'cheque' | 'upi' | 'card' | 'other';
  reference?: string;
  partyId?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Payment Summary Interface
export interface PaymentSummary {
  _id: string;
  totalAmount: number;
  totalCount: number;
}

// API Response Interface
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  details?: string[];
}

// API Error Class
class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public details?: string[]
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Request deduplication cache
const requestCache = new Map<string, Promise<any>>();

// Generic API request function with deduplication
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  // Create cache key for GET requests
  const isGetRequest = !options.method || options.method === 'GET';
  const cacheKey = isGetRequest ? `${options.method || 'GET'}:${url}` : null;
  
  // Check if request is already in progress (for GET requests)
  if (cacheKey && requestCache.has(cacheKey)) {
    return requestCache.get(cacheKey);
  }
  
  const defaultOptions: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const config = { ...defaultOptions, ...options };

  const requestPromise = (async () => {
    try {
      const response = await fetch(url, config);
      const data: ApiResponse<T> = await response.json();

      if (!response.ok) {
        throw new ApiError(
          data.error || 'Request failed',
          response.status,
          data.details
        );
      }

      if (!data.success) {
        throw new ApiError(
          data.error || 'API request failed',
          response.status,
          data.details
        );
      }

      return data.data as T;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      
      // Network or other errors
      throw new ApiError(
        error instanceof Error ? error.message : 'Network error occurred'
      );
    } finally {
      // Remove from cache when done (for GET requests)
      if (cacheKey) {
        requestCache.delete(cacheKey);
      }
    }
  })();

  // Cache the promise for GET requests
  if (cacheKey) {
    requestCache.set(cacheKey, requestPromise);
  }

  return requestPromise;
}

// Company API Service
export class CompanyApiService {
  // Get company details
  static async getCompanyDetails(): Promise<CompanyDetails> {
    return apiRequest<CompanyDetails>('/company/details');
  }

  // Create or update company details
  static async saveCompanyDetails(companyData: CompanyDetails): Promise<CompanyDetails> {
    return apiRequest<CompanyDetails>('/company/details', {
      method: 'POST',
      body: JSON.stringify(companyData),
    });
  }

  // Update company details
  static async updateCompanyDetails(companyData: CompanyDetails): Promise<CompanyDetails> {
    return apiRequest<CompanyDetails>('/company/details', {
      method: 'PUT',
      body: JSON.stringify(companyData),
    });
  }

  // Delete company details
  static async deleteCompanyDetails(): Promise<void> {
    return apiRequest<void>('/company/details', {
      method: 'DELETE',
    });
  }

  // Get default company details template
  static async getDefaultCompanyDetails(): Promise<CompanyDetails> {
    return apiRequest<CompanyDetails>('/company/details/default');
  }

  // Validate company details without saving
  static async validateCompanyDetails(companyData: CompanyDetails): Promise<CompanyDetails> {
    return apiRequest<CompanyDetails>('/company/details/validate', {
      method: 'POST',
      body: JSON.stringify(companyData),
    });
  }

  // Get company service status
  static async getCompanyServiceStatus(): Promise<{
    success: boolean;
    message: string;
    timestamp: string;
    endpoints: Record<string, string>;
  }> {
    return apiRequest('/company/status');
  }
}

// Utility functions for error handling
export const handleApiError = (error: unknown): string => {
  if (error instanceof ApiError) {
    if (error.details && error.details.length > 0) {
      return error.details.join(', ');
    }
    return error.message;
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  return 'An unexpected error occurred';
};

// Check if API is available
export const checkApiHealth = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE_URL}/`);
    return response.ok;
  } catch {
    return false;
  }
};

// Check all services health
export const checkAllServicesHealth = async (): Promise<{
  api: boolean;
  company: boolean;
  items: boolean;
  parties: boolean;
  sales: boolean;
  purchases: boolean;
  payments: boolean;
}> => {
  const [api, company, items, parties, sales, purchases, payments] = await Promise.all([
    checkApiHealth(),
    checkCompanyServiceHealth(),
    checkItemsServiceHealth(),
    checkPartyServiceHealth(),
    checkSaleServiceHealth(),
    checkPurchaseServiceHealth(),
    checkPaymentServiceHealth(),
  ]);

  return {
    api,
    company,
    items,
    parties,
    sales,
    purchases,
    payments,
  };
};

// Company service health check
export const checkCompanyServiceHealth = async (): Promise<boolean> => {
  try {
    await CompanyApiService.getCompanyServiceStatus();
    return true;
  } catch {
    return false;
  }
};

// Items API Service
export class ItemsApiService {
  // Get all items with optional filtering
  static async getItems(params?: {
    category?: 'Primary' | 'Kirana' | 'all';
    search?: string;
    isUniversal?: boolean;
  }): Promise<Item[]> {
    const queryParams = new URLSearchParams();
    
    if (params?.category && params.category !== 'all') {
      queryParams.append('category', params.category);
    }
    
    if (params?.search) {
      queryParams.append('search', params.search);
    }
    
    if (params?.isUniversal !== undefined) {
      queryParams.append('isUniversal', params.isUniversal.toString());
    }
    
    const endpoint = `/api/items${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return apiRequest<Item[]>(endpoint);
  }

  // Get single item by ID
  static async getItemById(id: string): Promise<Item> {
    return apiRequest<Item>(`/api/items/${id}`);
  }

  // Create new item
  static async createItem(itemData: Omit<Item, '_id' | 'id' | 'createdAt' | 'updatedAt'>): Promise<Item> {
    return apiRequest<Item>('/api/items', {
      method: 'POST',
      body: JSON.stringify(itemData),
    });
  }

  // Update existing item
  static async updateItem(id: string, itemData: Partial<Omit<Item, '_id' | 'id' | 'createdAt' | 'updatedAt'>>): Promise<Item> {
    return apiRequest<Item>(`/api/items/${id}`, {
      method: 'PUT',
      body: JSON.stringify(itemData),
    });
  }

  // Delete item
  static async deleteItem(id: string): Promise<void> {
    return apiRequest<void>(`/api/items/${id}`, {
      method: 'DELETE',
    });
  }

  // Get items summary statistics
  static async getItemsSummary(): Promise<ItemSummaryStats> {
    return apiRequest<ItemSummaryStats>('/api/items/stats/summary');
  }

  // Initialize Bardana universal item
  static async initializeBardana(): Promise<Item> {
    return apiRequest<Item>('/api/items/initialize-bardana', {
      method: 'POST',
    });
  }

  // Get Bardana universal item
  static async getBardana(): Promise<Item> {
    return apiRequest<Item>('/api/items/bardana');
  }

  // Update Bardana stock (for internal use)
  static async updateBardanaStock(operation: 'add' | 'subtract', quantity: number): Promise<Item> {
    return apiRequest<Item>('/api/items/bardana/stock', {
      method: 'PUT',
      body: JSON.stringify({ operation, quantity }),
    });
  }
}

// Items service health check
export const checkItemsServiceHealth = async (): Promise<boolean> => {
  try {
    await ItemsApiService.getItemsSummary();
    return true;
  } catch {
    return false;
  }
};

// Party API Service
export class PartyApiService {
  // Get all parties with optional filtering
  static async getParties(params?: {
    search?: string;
  }): Promise<Party[]> {
    const queryParams = new URLSearchParams();
    
    if (params?.search) {
      queryParams.append('search', params.search);
    }
    
    const endpoint = `/api/parties${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const parties = await apiRequest<any[]>(endpoint);
    
    // Map _id to id field for frontend compatibility
    return parties.map(party => ({
      ...party,
      id: party._id || party.id
    }));
  }

  // Get single party by ID
  static async getPartyById(id: string): Promise<Party> {
    const party = await apiRequest<any>(`/api/parties/${id}`);
    
    // Map _id to id field for frontend compatibility
    return {
      ...party,
      id: party._id || party.id
    };
  }

  // Create new party
  static async createParty(partyData: Omit<Party, 'id' | 'createdAt' | 'updatedAt'>): Promise<Party> {
    const party = await apiRequest<any>('/api/parties', {
      method: 'POST',
      body: JSON.stringify(partyData),
    });
    
    // Map _id to id field for frontend compatibility
    return {
      ...party,
      id: party._id || party.id
    };
  }

  // Update existing party
  static async updateParty(id: string, partyData: Partial<Omit<Party, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Party> {
    const party = await apiRequest<any>(`/api/parties/${id}`, {
      method: 'PUT',
      body: JSON.stringify(partyData),
    });
    
    // Map _id to id field for frontend compatibility
    return {
      ...party,
      id: party._id || party.id
    };
  }

  // Update party balance
  static async updatePartyBalance(id: string, amount: number, operation: 'add' | 'subtract' | 'set'): Promise<Party> {
    const party = await apiRequest<any>(`/api/parties/${id}/balance`, {
      method: 'PATCH',
      body: JSON.stringify({ amount, operation }),
    });
    
    // Map _id to id field for frontend compatibility
    return {
      ...party,
      id: party._id || party.id
    };
  }

  // Find existing party or create new one
  static async findOrCreateParty(partyData: Omit<Party, 'id' | 'createdAt' | 'updatedAt'>): Promise<Party> {
    const party = await apiRequest<any>('/api/parties/find-or-create', {
      method: 'POST',
      body: JSON.stringify(partyData),
    });
    
    // Map _id to id field for frontend compatibility
    return {
      ...party,
      id: party._id || party.id
    };
  }

  // Delete party
  static async deleteParty(id: string): Promise<void> {
    return apiRequest<void>(`/api/parties/${id}`, {
      method: 'DELETE',
    });
  }

  // Get all transactions for a party
  static async getPartyTransactions(id: string): Promise<{
    party: Party;
    transactions: Array<{
      id: string;
      type: 'sale' | 'purchase' | 'payment-in' | 'payment-out';
      transactionId: string;
      partyName: string;
      phoneNumber: string;
      totalAmount?: number;
      amount?: number;
      date: string;
      status: string;
      pdfUri?: string;
      description?: string;
      paymentMethod?: string;
      reference?: string;
      createdAt: string;
      updatedAt: string;
      items?: any[];
    }>;
  }> {
    const result = await apiRequest<any>(`/api/parties/${id}/transactions`);
    
    // Map _id to id field for frontend compatibility
    return {
      ...result,
      party: {
        ...result.party,
        id: result.party._id || result.party.id
      }
    };
  }
}

// Sale API Service
export class SaleApiService {
  // Get all sales with optional filtering
  static async getSales(params?: {
    partyName?: string;
    phoneNumber?: string;
    date?: string;
    search?: string;
  }): Promise<SaleInvoice[]> {
    const queryParams = new URLSearchParams();
    
    if (params?.partyName) {
      queryParams.append('partyName', params.partyName);
    }
    
    if (params?.phoneNumber) {
      queryParams.append('phoneNumber', params.phoneNumber);
    }
    
    if (params?.date) {
      queryParams.append('date', params.date);
    }
    
    if (params?.search) {
      queryParams.append('search', params.search);
    }
    
    const endpoint = `/api/sales${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return apiRequest<SaleInvoice[]>(endpoint);
  }

  // Get single sale by ID
  static async getSaleById(id: string): Promise<SaleInvoice> {
    return apiRequest<SaleInvoice>(`/api/sales/${id}`);
  }

  // Create new sale
  static async createSale(saleData: Omit<SaleInvoice, 'id' | 'invoiceNo' | 'createdAt' | 'updatedAt'>): Promise<SaleInvoice> {
    return apiRequest<SaleInvoice>('/api/sales', {
      method: 'POST',
      body: JSON.stringify(saleData),
    });
  }

  // Update existing sale
  static async updateSale(id: string, saleData: Partial<Omit<SaleInvoice, 'id' | 'invoiceNo' | 'createdAt' | 'updatedAt'>>): Promise<SaleInvoice> {
    return apiRequest<SaleInvoice>(`/api/sales/${id}`, {
      method: 'PUT',
      body: JSON.stringify(saleData),
    });
  }

  // Delete sale
  static async deleteSale(id: string): Promise<void> {
    return apiRequest<void>(`/api/sales/${id}`, {
      method: 'DELETE',
    });
  }

  // Get sales by party name
  static async getSalesByParty(partyName: string, phoneNumber?: string): Promise<SaleInvoice[]> {
    const queryParams = new URLSearchParams();
    
    if (phoneNumber) {
      queryParams.append('phoneNumber', phoneNumber);
    }
    
    const endpoint = `/api/sales/party/${encodeURIComponent(partyName)}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return apiRequest<SaleInvoice[]>(endpoint);
  }

  // Get sales by date range
  static async getSalesByDateRange(startDate: string, endDate: string): Promise<SaleInvoice[]> {
    const queryParams = new URLSearchParams();
    queryParams.append('startDate', startDate);
    queryParams.append('endDate', endDate);
    
    const endpoint = `/api/sales/date-range?${queryParams.toString()}`;
    return apiRequest<SaleInvoice[]>(endpoint);
  }
}

// Purchase API Service
export class PurchaseApiService {
  // Get all purchases with optional filtering
  static async getPurchases(params?: {
    partyName?: string;
    phoneNumber?: string;
    date?: string;
    search?: string;
  }): Promise<PurchaseBill[]> {
    const queryParams = new URLSearchParams();
    
    if (params?.partyName) {
      queryParams.append('partyName', params.partyName);
    }
    
    if (params?.phoneNumber) {
      queryParams.append('phoneNumber', params.phoneNumber);
    }
    
    if (params?.date) {
      queryParams.append('date', params.date);
    }
    
    if (params?.search) {
      queryParams.append('search', params.search);
    }
    
    const endpoint = `/api/purchases${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return apiRequest<PurchaseBill[]>(endpoint);
  }

  // Get single purchase by ID
  static async getPurchaseById(id: string): Promise<PurchaseBill> {
    return apiRequest<PurchaseBill>(`/api/purchases/${id}`);
  }

  // Create new purchase
  static async createPurchase(purchaseData: Omit<PurchaseBill, 'id' | 'billNo' | 'createdAt' | 'updatedAt'>): Promise<PurchaseBill> {
    return apiRequest<PurchaseBill>('/api/purchases', {
      method: 'POST',
      body: JSON.stringify(purchaseData),
    });
  }

  // Update existing purchase
  static async updatePurchase(id: string, purchaseData: Partial<Omit<PurchaseBill, 'id' | 'billNo' | 'createdAt' | 'updatedAt'>>): Promise<PurchaseBill> {
    return apiRequest<PurchaseBill>(`/api/purchases/${id}`, {
      method: 'PUT',
      body: JSON.stringify(purchaseData),
    });
  }

  // Delete purchase
  static async deletePurchase(id: string): Promise<void> {
    return apiRequest<void>(`/api/purchases/${id}`, {
      method: 'DELETE',
    });
  }

  // Get purchases by party name
  static async getPurchasesByParty(partyName: string, phoneNumber?: string): Promise<PurchaseBill[]> {
    const queryParams = new URLSearchParams();
    
    if (phoneNumber) {
      queryParams.append('phoneNumber', phoneNumber);
    }
    
    const endpoint = `/api/purchases/party/${encodeURIComponent(partyName)}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return apiRequest<PurchaseBill[]>(endpoint);
  }

  // Get purchases by date range
  static async getPurchasesByDateRange(startDate: string, endDate: string): Promise<PurchaseBill[]> {
    const queryParams = new URLSearchParams();
    queryParams.append('startDate', startDate);
    queryParams.append('endDate', endDate);
    
    const endpoint = `/api/purchases/date-range?${queryParams.toString()}`;
    return apiRequest<PurchaseBill[]>(endpoint);
  }
}

// Payment API Service
export class PaymentApiService {
  // Get all payments with optional filtering
  static async getPayments(params?: {
    type?: 'payment-in' | 'payment-out' | 'all';
    partyName?: string;
    phoneNumber?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
  }): Promise<Payment[]> {
    const queryParams = new URLSearchParams();
    
    if (params?.type && params.type !== 'all') {
      queryParams.append('type', params.type);
    }
    
    if (params?.partyName) {
      queryParams.append('partyName', params.partyName);
    }
    
    if (params?.phoneNumber) {
      queryParams.append('phoneNumber', params.phoneNumber);
    }
    
    if (params?.startDate) {
      queryParams.append('startDate', params.startDate);
    }
    
    if (params?.endDate) {
      queryParams.append('endDate', params.endDate);
    }
    
    if (params?.search) {
      queryParams.append('search', params.search);
    }
    
    const endpoint = `/api/payments${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return apiRequest<Payment[]>(endpoint);
  }

  // Get payment summary
  static async getPaymentSummary(params?: {
    type?: 'payment-in' | 'payment-out';
    startDate?: string;
    endDate?: string;
  }): Promise<PaymentSummary[]> {
    const queryParams = new URLSearchParams();
    
    if (params?.type) {
      queryParams.append('type', params.type);
    }
    
    if (params?.startDate) {
      queryParams.append('startDate', params.startDate);
    }
    
    if (params?.endDate) {
      queryParams.append('endDate', params.endDate);
    }
    
    const endpoint = `/api/payments/summary${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return apiRequest<PaymentSummary[]>(endpoint);
  }

  // Get single payment by ID
  static async getPaymentById(id: string): Promise<Payment> {
    return apiRequest<Payment>(`/api/payments/${id}`);
  }

  // Create new payment
  static async createPayment(paymentData: Omit<Payment, 'id' | 'paymentNo' | 'createdAt' | 'updatedAt'>): Promise<Payment> {
    return apiRequest<Payment>('/api/payments', {
      method: 'POST',
      body: JSON.stringify(paymentData),
    });
  }

  // Update existing payment
  static async updatePayment(id: string, paymentData: Partial<Omit<Payment, 'id' | 'paymentNo' | 'createdAt' | 'updatedAt'>>): Promise<Payment> {
    return apiRequest<Payment>(`/api/payments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(paymentData),
    });
  }

  // Delete payment
  static async deletePayment(id: string): Promise<void> {
    return apiRequest<void>(`/api/payments/${id}`, {
      method: 'DELETE',
    });
  }

  // Get payments by type
  static async getPaymentsByType(type: 'payment-in' | 'payment-out', params?: {
    partyName?: string;
    phoneNumber?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
  }): Promise<Payment[]> {
    const queryParams = new URLSearchParams();
    
    if (params?.partyName) {
      queryParams.append('partyName', params.partyName);
    }
    
    if (params?.phoneNumber) {
      queryParams.append('phoneNumber', params.phoneNumber);
    }
    
    if (params?.startDate) {
      queryParams.append('startDate', params.startDate);
    }
    
    if (params?.endDate) {
      queryParams.append('endDate', params.endDate);
    }
    
    if (params?.search) {
      queryParams.append('search', params.search);
    }
    
    const endpoint = `/api/payments/type/${type}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return apiRequest<Payment[]>(endpoint);
  }

  // Get payment-in payments (convenience method)
  static async getPaymentInPayments(params?: {
    partyName?: string;
    phoneNumber?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
  }): Promise<Payment[]> {
    return this.getPaymentsByType('payment-in', params);
  }

  // Get payment-out payments (convenience method)
  static async getPaymentOutPayments(params?: {
    partyName?: string;
    phoneNumber?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
  }): Promise<Payment[]> {
    return this.getPaymentsByType('payment-out', params);
  }

  // Clean up duplicate payments
  static async cleanupDuplicates(): Promise<{
    cleanedCount: number;
    duplicateGroups: number;
  }> {
    return apiRequest<{
      cleanedCount: number;
      duplicateGroups: number;
    }>('/api/payments/cleanup', {
      method: 'POST',
    });
  }
}

// Party service health check
export const checkPartyServiceHealth = async (): Promise<boolean> => {
  try {
    await PartyApiService.getParties();
    return true;
  } catch {
    return false;
  }
};

// Sale service health check
export const checkSaleServiceHealth = async (): Promise<boolean> => {
  try {
    await SaleApiService.getSales();
    return true;
  } catch {
    return false;
  }
};

// Purchase service health check
export const checkPurchaseServiceHealth = async (): Promise<boolean> => {
  try {
    await PurchaseApiService.getPurchases();
    return true;
  } catch {
    return false;
  }
};

// Payment service health check
export const checkPaymentServiceHealth = async (): Promise<boolean> => {
  try {
    await PaymentApiService.getPaymentSummary();
    return true;
  } catch {
    return false;
  }
};

export default CompanyApiService;
