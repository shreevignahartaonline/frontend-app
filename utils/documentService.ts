
// Response Interfaces
interface UploadResponse {
  success: boolean;
  url?: string;
  error?: string;
}

interface WhatsAppSendResponse {
  success: boolean;
  message?: string;
  messageId?: string;
  status?: string;
  error?: string;
  statusCode?: number;
  details?: any;
}

// Document Service - Thin wrapper around backend
export class DocumentService {
  // Backend Configuration
  private static readonly BACKEND_URL = 'https://backend-app-v43g.onrender.com'; // Update this to your backend URL

  // ============================================================================
  // PDF UPLOAD METHODS
  // ============================================================================

  /**
   * Upload PDF via backend (recommended for all environments)
   * @param pdfUri - Local file URI of the PDF
   * @param fileName - Name for the file (optional)
   */
  static async uploadPdf(pdfUri: string, fileName?: string): Promise<UploadResponse> {
    try {
      const formData = new FormData();
      const finalFileName = fileName || `document-${Date.now()}.pdf`;
      
      const fileData = {
        uri: pdfUri,
        type: 'application/pdf',
        name: finalFileName,
      };
      
      formData.append('file', fileData as any);

      const uploadResponse = await fetch(`${this.BACKEND_URL}/upload`, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        return {
          success: false,
          error: `Upload failed: ${errorText}`,
        };
      }

      const result = await uploadResponse.json();
      return {
        success: true,
        url: result.url,
      };

    } catch (error) {
      console.error('Upload error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  }

  /**
   * Upload invoice PDF
   * @param pdfUri - Local file URI of the invoice PDF
   * @param invoiceNo - Invoice number for naming
   */
  static async uploadInvoicePdf(pdfUri: string, invoiceNo: string): Promise<UploadResponse> {
    const fileName = `invoice-${invoiceNo}-${Date.now()}.pdf`;
    return this.uploadPdf(pdfUri, fileName);
  }

  /**
   * Upload purchase bill PDF
   * @param pdfUri - Local file URI of the purchase bill PDF
   * @param billNo - Bill number for naming
   */
  static async uploadPurchaseBillPdf(pdfUri: string, billNo: string): Promise<UploadResponse> {
    const fileName = `purchase-bill-${billNo}-${Date.now()}.pdf`;
    return this.uploadPdf(pdfUri, fileName);
  }

  // ============================================================================
  // WHATSAPP SENDING METHODS
  // ============================================================================

  /**
   * Send PDF document via WhatsApp
   * @param phoneNumber - Recipient's phone number
   * @param documentUrl - URL of the PDF document
   * @param fileName - Name of the file
   * @param documentType - Type of document
   * @param documentData - Document-specific data
   */
  static async sendDocumentViaWhatsApp(
    phoneNumber: string,
    documentUrl: string,
    fileName: string,
    documentType: 'invoice' | 'purchase-bill' | 'payment-receipt' | 'payment-voucher',
    documentData: {
      invoiceNo?: string;
      customerName?: string;
      amount?: number;
      billNo?: string;
      supplierName?: string;
      receiptNo?: string;
      voucherNo?: string;
    }
  ): Promise<WhatsAppSendResponse> {
    try {
      const payload = {
        phoneNumber,
        documentUrl,
        fileName,
        documentType,
        ...documentData
      };

      const response = await fetch(`${this.BACKEND_URL}/upload/send-whatsapp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        return {
          success: true,
          message: result.message,
          messageId: result.messageId,
          status: result.status,
        };
      } else {
        return {
          success: false,
          error: result.error || 'Failed to send document via WhatsApp',
          statusCode: response.status,
          details: result.details,
        };
      }

    } catch (error) {
      console.error('WhatsApp send error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error occurred',
      };
    }
  }

  /**
   * Send invoice via WhatsApp
   * @param phoneNumber - Customer's phone number
   * @param documentUrl - Invoice PDF URL
   * @param invoiceNo - Invoice number
   * @param customerName - Customer name
   * @param amount - Invoice amount
   */
  static async sendInvoiceViaWhatsApp(
    phoneNumber: string,
    documentUrl: string,
    invoiceNo: string,
    customerName: string,
    amount: number
  ): Promise<WhatsAppSendResponse> {
    const fileName = `Invoice-${invoiceNo}.pdf`;
    return this.sendDocumentViaWhatsApp(phoneNumber, documentUrl, fileName, 'invoice', {
      invoiceNo,
      customerName,
      amount
    });
  }

  /**
   * Send purchase bill via WhatsApp
   * @param phoneNumber - Supplier's phone number
   * @param documentUrl - Purchase bill PDF URL
   * @param billNo - Bill number
   * @param supplierName - Supplier name
   * @param amount - Bill amount
   */
  static async sendPurchaseBillViaWhatsApp(
    phoneNumber: string,
    documentUrl: string,
    billNo: string,
    supplierName: string,
    amount: number
  ): Promise<WhatsAppSendResponse> {
    const fileName = `Purchase-Bill-${billNo}.pdf`;
    return this.sendDocumentViaWhatsApp(phoneNumber, documentUrl, fileName, 'purchase-bill', {
      billNo,
      supplierName,
      amount
    });
  }

  /**
   * Send payment receipt via WhatsApp
   * @param phoneNumber - Customer's phone number
   * @param documentUrl - Payment receipt PDF URL
   * @param receiptNo - Receipt number
   * @param customerName - Customer name
   * @param amount - Payment amount
   */
  static async sendPaymentReceiptViaWhatsApp(
    phoneNumber: string,
    documentUrl: string,
    receiptNo: string,
    customerName: string,
    amount: number
  ): Promise<WhatsAppSendResponse> {
    const fileName = `Payment-Receipt-${receiptNo}.pdf`;
    return this.sendDocumentViaWhatsApp(phoneNumber, documentUrl, fileName, 'payment-receipt', {
      receiptNo,
      customerName,
      amount
    });
  }

  /**
   * Send payment voucher via WhatsApp
   * @param phoneNumber - Supplier's phone number
   * @param documentUrl - Payment voucher PDF URL
   * @param voucherNo - Voucher number
   * @param supplierName - Supplier name
   * @param amount - Payment amount
   */
  static async sendPaymentVoucherViaWhatsApp(
    phoneNumber: string,
    documentUrl: string,
    voucherNo: string,
    supplierName: string,
    amount: number
  ): Promise<WhatsAppSendResponse> {
    const fileName = `Payment-Voucher-${voucherNo}.pdf`;
    return this.sendDocumentViaWhatsApp(phoneNumber, documentUrl, fileName, 'payment-voucher', {
      voucherNo,
      supplierName,
      amount
    });
  }

  /**
   * Test WhatsApp service connection
   */
  static async testWhatsAppConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.BACKEND_URL}/upload/test-whatsapp`);
      const result = await response.json();

      if (response.ok && result.success) {
        return { success: true };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error occurred'
      };
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Check if backend server is running
   */
  static async checkBackendStatus(): Promise<boolean> {
    try {
      const response = await fetch(`${this.BACKEND_URL}/`);
      return response.ok;
    } catch (error) {
      console.error('Backend server not reachable:', error);
      return false;
    }
  }

  /**
   * Get upload service status including WhatsApp configuration
   */
  static async getUploadServiceStatus(): Promise<{
    success: boolean;
    message: string;
    cloudinary: any;
    wasender: any;
    uploads: any;
  }> {
    try {
      const response = await fetch(`${this.BACKEND_URL}/upload/status`);
      const result = await response.json();

      if (response.ok) {
        return result;
      } else {
        throw new Error(result.error || 'Failed to get upload service status');
      }
    } catch (error) {
      console.error('Upload service status error:', error);
      throw error;
    }
  }
}

// Export for backward compatibility
export const CloudinaryUploader = DocumentService;
