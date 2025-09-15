// API Configuration
const API_BASE_URL = 'https://backend-app-v43g.onrender.com';

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

// Request cache for deduplication
const requestCache = new Map<string, Promise<any>>();

// Generic API request function
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

// Payment service health check
export const checkPaymentServiceHealth = async (): Promise<boolean> => {
  try {
    await PaymentApiService.getPaymentSummary();
    return true;
  } catch {
    return false;
  }
};

export default PaymentApiService;
