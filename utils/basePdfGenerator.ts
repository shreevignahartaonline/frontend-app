import * as FileSystem from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { CompanyApiService, CompanyDetails } from './api';
import { DocumentService } from './documentService';

// Common interfaces - CompanyDetails is now imported from api.ts

interface BaseItem {
  id: string;
  itemName: string;
  quantity: number;
  rate: number;
  total: number;
}

interface SaleInvoice {
  id: string;
  invoiceNo: string;
  partyName: string;
  phoneNumber: string;
  items: BaseItem[];
  totalAmount: number;
  date: string;
}

interface PurchaseBill {
  id: string;
  billNo: string;
  partyName: string;
  phoneNumber: string;
  items: BaseItem[];
  totalAmount: number;
  date: string;
}

interface PaymentIn {
  id: string;
  paymentNo: string;
  partyName: string;
  phoneNumber: string;
  received: number;
  totalAmount: number;
  date: string;
}

interface PaymentOut {
  id: string;
  paymentNo: string;
  partyName: string;
  phoneNumber: string;
  paid: number;
  totalAmount: number;
  date: string;
}

export class BasePdfGenerator {
  private static async getCompanyDetails(): Promise<CompanyDetails | null> {
    try {
      return await CompanyApiService.getCompanyDetails();
    } catch (error) {
      console.error('Error loading company details:', error);
      return null;
    }
  }

  private static generateCommonCSS(primaryColor: string): string {
    return `
      body {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        margin: 0;
        padding: 20px;
        background-color: #ffffff;
        color: #1f2937;
        line-height: 1.6;
      }
      .container {
        max-width: 800px;
        margin: 0 auto;
        background: #ffffff;
        border-radius: 8px;
        overflow: hidden;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      }
      .header {
        background: linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}dd 100%);
        color: white;
        padding: 30px;
        text-align: center;
      }
      .company-name {
        font-size: 28px;
        font-weight: bold;
        margin-bottom: 8px;
      }
      .company-description {
        font-size: 16px;
        opacity: 0.9;
        margin-bottom: 20px;
      }
      .title {
        font-size: 24px;
        font-weight: bold;
        margin-bottom: 10px;
      }
      .number {
        font-size: 18px;
        opacity: 0.9;
      }
      .content {
        padding: 30px;
      }
      .info-section {
        display: flex;
        justify-content: space-between;
        margin-bottom: 30px;
      }
      .info-block {
        flex: 1;
      }
      .info-block:first-child {
        margin-right: 40px;
      }
      .info-title {
        font-size: 16px;
        font-weight: bold;
        color: ${primaryColor};
        margin-bottom: 10px;
        border-bottom: 2px solid ${primaryColor};
        padding-bottom: 5px;
      }
      .info-item {
        margin-bottom: 8px;
        font-size: 14px;
      }
      .info-label {
        font-weight: 600;
        color: #6b7280;
      }
      .info-value {
        color: #1f2937;
      }
      .items-table {
        width: 100%;
        border-collapse: collapse;
        margin: 20px 0;
        background: #f9fafb;
        border-radius: 8px;
        overflow: hidden;
      }
      .table-header {
        background: ${primaryColor};
        color: white;
      }
      .table-header th {
        padding: 15px 12px;
        text-align: left;
        font-weight: 600;
        font-size: 14px;
      }
      .table-header th:first-child { text-align: center; }
      .table-header th:nth-child(3),
      .table-header th:nth-child(4),
      .table-header th:nth-child(5) { text-align: center; }
      .table-header th:last-child { text-align: right; }
      .total-section {
        margin-top: 30px;
        text-align: right;
      }
      .total-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 0;
        font-size: 16px;
      }
      .total-label {
        font-weight: 600;
        color: #6b7280;
      }
      .total-amount {
        font-weight: bold;
        color: #1f2937;
      }
      .grand-total {
        font-size: 20px;
        font-weight: bold;
        color: ${primaryColor};
        border-top: 2px solid #e5e7eb;
        padding-top: 10px;
        margin-top: 10px;
      }
      .footer {
        margin-top: 40px;
        padding-top: 20px;
        border-top: 1px solid #e5e7eb;
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
      }
      .signature-section {
        flex: 1;
      }
      .signature-title {
        font-size: 14px;
        font-weight: 600;
        color: #6b7280;
        margin-bottom: 10px;
      }
      .signature-line {
        width: 200px;
        height: 1px;
        background: #6b7280;
        margin-bottom: 5px;
      }
      .signature-name {
        font-size: 14px;
        font-weight: 600;
        color: #1f2937;
      }
      .terms-section {
        flex: 1;
        margin-left: 40px;
      }
      .terms-title {
        font-size: 14px;
        font-weight: 600;
        color: #6b7280;
        margin-bottom: 10px;
      }
      .terms-text {
        font-size: 12px;
        color: #6b7280;
        line-height: 1.4;
      }
      .watermark {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) rotate(-45deg);
        font-size: 48px;
        color: ${primaryColor}1a;
        font-weight: bold;
        pointer-events: none;
        z-index: -1;
      }
      .payment-details {
        background: ${primaryColor}0a;
        border: 2px solid ${primaryColor}33;
        border-radius: 12px;
        padding: 24px;
        margin: 20px 0;
      }
      .payment-details-title {
        font-size: 18px;
        font-weight: bold;
        color: ${primaryColor};
        margin-bottom: 16px;
        text-align: center;
      }
      .payment-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 0;
        border-bottom: 1px solid ${primaryColor}22;
      }
      .payment-row:last-child {
        border-bottom: none;
        border-top: 2px solid ${primaryColor};
        margin-top: 8px;
        padding-top: 16px;
      }
      .payment-label {
        font-weight: 600;
        color: #374151;
        font-size: 16px;
      }
      .payment-amount {
        font-weight: bold;
        color: ${primaryColor};
        font-size: 18px;
      }
    `;
  }

  private static generateItemsTableHTML(items: BaseItem[]): string {
    return items.map((item, index) => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: left;">${index + 1}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: left;">${item.itemName}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">₹${item.rate.toLocaleString()}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">₹${item.total.toLocaleString()}</td>
      </tr>
    `).join('');
  }

  // Invoice PDF Generation
  static async generateInvoicePDF(invoice: SaleInvoice): Promise<string | null> {
    try {
      const companyDetails = await this.getCompanyDetails();
      const currentDate = new Date().toLocaleDateString('en-IN');
      const invoiceDate = invoice.date || currentDate;
      
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Invoice #${invoice.invoiceNo}</title>
          <style>${this.generateCommonCSS('#6366f1')}</style>
        </head>
        <body>
          <div class="watermark">${companyDetails?.businessName || 'INVOICE'}</div>
          <div class="container">
            <div class="header">
              <div class="company-name">${companyDetails?.businessName || 'Your Business Name'}</div>
              <div class="company-description">${companyDetails?.businessDescription || 'Business Description'}</div>
              <div class="title">TAX INVOICE</div>
              <div class="number">Invoice #${invoice.invoiceNo}</div>
            </div>
            
            <div class="content">
              <div class="info-section">
                <div class="info-block">
                  <div class="info-title">Bill To</div>
                  <div class="info-item">
                    <span class="info-label">Name:</span>
                    <span class="info-value">${invoice.partyName}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">Phone:</span>
                    <span class="info-value">${invoice.phoneNumber}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">Date:</span>
                    <span class="info-value">${invoiceDate}</span>
                  </div>
                </div>
                
                <div class="info-block">
                  <div class="info-title">From</div>
                  <div class="info-item">
                    <span class="info-label">Business:</span>
                    <span class="info-value">${companyDetails?.businessName || 'Your Business Name'}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">Address:</span>
                    <span class="info-value">${companyDetails?.businessAddress || 'Business Address'}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">Pincode:</span>
                    <span class="info-value">${companyDetails?.pincode || 'Pincode'}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">Phone:</span>
                    <span class="info-value">${companyDetails?.phoneNumber1 || 'Phone Number'}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">Email:</span>
                    <span class="info-value">${companyDetails?.emailId || 'Email Address'}</span>
                  </div>
                </div>
              </div>
              
              <table class="items-table">
                <thead class="table-header">
                  <tr>
                    <th>Sr. No.</th>
                    <th>Item Description</th>
                    <th>Quantity</th>
                    <th>Rate (₹)</th>
                    <th>Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>${this.generateItemsTableHTML(invoice.items)}</tbody>
              </table>
              
              <div class="total-section">
                <div class="total-row">
                  <span class="total-label">Total Amount:</span>
                  <span class="total-amount">₹${invoice.totalAmount.toLocaleString()}</span>
                </div>
                <div class="total-row grand-total">
                  <span class="total-label">Grand Total:</span>
                  <span class="total-amount">₹${invoice.totalAmount.toLocaleString()}</span>
                </div>
              </div>
              
              <div class="footer">
                <div class="signature-section">
                  <div class="signature-title">Authorized Signature</div>
                  <div class="signature-line"></div>
                  <div class="signature-name">${companyDetails?.signature || 'Authorized Person'}</div>
                </div>
                
                <div class="terms-section">
                  <div class="terms-title">Terms & Conditions</div>
                  <div class="terms-text">
                    • Payment is due within 30 days of invoice date<br>
                    • Late payments may incur additional charges<br>
                    • Goods once sold will not be taken back<br>
                    • Subject to local jurisdiction
                  </div>
                </div>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;
      
      return await this.generatePDF(html, `invoice-${invoice.invoiceNo}-${Date.now()}.pdf`);
    } catch (error) {
      console.error('Error generating invoice PDF:', error);
      return null;
    }
  }

  // Purchase Bill PDF Generation
  static async generatePurchaseBillPDF(bill: PurchaseBill): Promise<string | null> {
    try {
      const companyDetails = await this.getCompanyDetails();
      const currentDate = new Date().toLocaleDateString('en-IN');
      const billDate = bill.date || currentDate;
      
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Purchase Bill #${bill.billNo}</title>
          <style>${this.generateCommonCSS('#dc2626')}</style>
        </head>
        <body>
          <div class="watermark">${companyDetails?.businessName || 'PURCHASE BILL'}</div>
          <div class="container">
            <div class="header">
              <div class="company-name">${companyDetails?.businessName || 'Your Business Name'}</div>
              <div class="company-description">${companyDetails?.businessDescription || 'Business Description'}</div>
              <div class="title">PURCHASE BILL</div>
              <div class="number">Bill #${bill.billNo}</div>
            </div>
            
            <div class="content">
              <div class="info-section">
                <div class="info-block">
                  <div class="info-title">Bill From</div>
                  <div class="info-item">
                    <span class="info-label">Supplier:</span>
                    <span class="info-value">${bill.partyName}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">Phone:</span>
                    <span class="info-value">${bill.phoneNumber}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">Date:</span>
                    <span class="info-value">${billDate}</span>
                  </div>
                </div>
                
                <div class="info-block">
                  <div class="info-title">Bill To</div>
                  <div class="info-item">
                    <span class="info-label">Business:</span>
                    <span class="info-value">${companyDetails?.businessName || 'Your Business Name'}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">Address:</span>
                    <span class="info-value">${companyDetails?.businessAddress || 'Business Address'}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">Pincode:</span>
                    <span class="info-value">${companyDetails?.pincode || 'Pincode'}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">Phone:</span>
                    <span class="info-value">${companyDetails?.phoneNumber1 || 'Phone Number'}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">Email:</span>
                    <span class="info-value">${companyDetails?.emailId || 'Email Address'}</span>
                  </div>
                </div>
              </div>
              
              <table class="items-table">
                <thead class="table-header">
                  <tr>
                    <th>Sr. No.</th>
                    <th>Item Description</th>
                    <th>Quantity</th>
                    <th>Rate (₹)</th>
                    <th>Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>${this.generateItemsTableHTML(bill.items)}</tbody>
              </table>
              
              <div class="total-section">
                <div class="total-row">
                  <span class="total-label">Total Amount:</span>
                  <span class="total-amount">₹${bill.totalAmount.toLocaleString()}</span>
                </div>
                <div class="total-row grand-total">
                  <span class="total-label">Grand Total:</span>
                  <span class="total-amount">₹${bill.totalAmount.toLocaleString()}</span>
                </div>
              </div>
              
              <div class="footer">
                <div class="signature-section">
                  <div class="signature-title">Authorized Signature</div>
                  <div class="signature-line"></div>
                  <div class="signature-name">${companyDetails?.signature || 'Authorized Person'}</div>
                </div>
                
                <div class="terms-section">
                  <div class="terms-title">Terms & Conditions</div>
                  <div class="terms-text">
                    • Payment will be made within 30 days of bill date<br>
                    • Goods received in good condition<br>
                    • Any defects must be reported within 7 days<br>
                    • Subject to local jurisdiction
                  </div>
                </div>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;
      
      return await this.generatePDF(html, `purchase-bill-${bill.billNo}-${Date.now()}.pdf`);
    } catch (error) {
      console.error('Error generating purchase bill PDF:', error);
      return null;
    }
  }

  // Payment In PDF Generation
  static async generatePaymentInPDF(payment: PaymentIn): Promise<string | null> {
    try {
      const companyDetails = await this.getCompanyDetails();
      const currentDate = new Date().toLocaleDateString('en-IN');
      const paymentDate = payment.date || currentDate;
      
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Payment Receipt #${payment.paymentNo}</title>
          <style>${this.generateCommonCSS('#059669')}</style>
        </head>
        <body>
          <div class="watermark">${companyDetails?.businessName || 'PAYMENT RECEIPT'}</div>
          <div class="container">
            <div class="header">
              <div class="company-name">${companyDetails?.businessName || 'Your Business Name'}</div>
              <div class="company-description">${companyDetails?.businessDescription || 'Business Description'}</div>
              <div class="title">PAYMENT RECEIPT</div>
              <div class="number">Receipt #${payment.paymentNo}</div>
            </div>
            
            <div class="content">
              <div class="info-section">
                <div class="info-block">
                  <div class="info-title">Received From</div>
                  <div class="info-item">
                    <span class="info-label">Customer Name:</span>
                    <span class="info-value">${payment.partyName}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">Phone Number:</span>
                    <span class="info-value">${payment.phoneNumber}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">Date:</span>
                    <span class="info-value">${paymentDate}</span>
                  </div>
                </div>
                
                <div class="info-block">
                  <div class="info-title">Business Details</div>
                  <div class="info-item">
                    <span class="info-label">Business:</span>
                    <span class="info-value">${companyDetails?.businessName || 'Your Business Name'}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">Address:</span>
                    <span class="info-value">${companyDetails?.businessAddress || 'Business Address'}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">Pincode:</span>
                    <span class="info-value">${companyDetails?.pincode || 'Pincode'}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">Phone:</span>
                    <span class="info-value">${companyDetails?.phoneNumber1 || 'Phone Number'}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">Email:</span>
                    <span class="info-value">${companyDetails?.emailId || 'Email Address'}</span>
                  </div>
                </div>
              </div>
              
              <div class="payment-details">
                <div class="payment-details-title">Payment Summary</div>
                
                <div class="payment-row">
                  <span class="payment-label">Outstanding Balance:</span>
                  <span class="payment-amount">₹${payment.totalAmount.toLocaleString()}</span>
                </div>
                
                <div class="payment-row">
                  <span class="payment-label">Amount Received:</span>
                  <span class="payment-amount">₹${payment.received.toLocaleString()}</span>
                </div>
                
                <div class="payment-row">
                  <span class="payment-label">Remaining Balance:</span>
                  <span class="payment-amount">₹${(payment.totalAmount - payment.received).toLocaleString()}</span>
                </div>
              </div>
              
              <div class="footer">
                <div class="signature-section">
                  <div class="signature-title">Authorized Signature</div>
                  <div class="signature-line"></div>
                  <div class="signature-name">${companyDetails?.signature || 'Authorized Person'}</div>
                </div>
                
                <div class="terms-section">
                  <div class="terms-title">Terms & Conditions</div>
                  <div class="terms-text">
                    • This receipt confirms payment received<br>
                    • Payment is non-refundable<br>
                    • Receipt is valid for accounting purposes<br>
                    • Subject to local jurisdiction
                  </div>
                </div>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;
      
      return await this.generatePDF(html, `payment-receipt-${payment.paymentNo}-${Date.now()}.pdf`);
    } catch (error) {
      console.error('Error generating payment receipt PDF:', error);
      return null;
    }
  }

  // Payment Out PDF Generation
  static async generatePaymentOutPDF(payment: PaymentOut): Promise<string | null> {
    try {
      const companyDetails = await this.getCompanyDetails();
      const currentDate = new Date().toLocaleDateString('en-IN');
      const paymentDate = payment.date || currentDate;
      
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Payment Voucher #${payment.paymentNo}</title>
          <style>${this.generateCommonCSS('#dc2626')}</style>
        </head>
        <body>
          <div class="watermark">${companyDetails?.businessName || 'PAYMENT VOUCHER'}</div>
          <div class="container">
            <div class="header">
              <div class="company-name">${companyDetails?.businessName || 'Your Business Name'}</div>
              <div class="company-description">${companyDetails?.businessDescription || 'Business Description'}</div>
              <div class="title">PAYMENT VOUCHER</div>
              <div class="number">Voucher #${payment.paymentNo}</div>
            </div>
            
            <div class="content">
              <div class="info-section">
                <div class="info-block">
                  <div class="info-title">Paid To</div>
                  <div class="info-item">
                    <span class="info-label">Supplier Name:</span>
                    <span class="info-value">${payment.partyName}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">Phone Number:</span>
                    <span class="info-value">${payment.phoneNumber}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">Date:</span>
                    <span class="info-value">${paymentDate}</span>
                  </div>
                </div>
                
                <div class="info-block">
                  <div class="info-title">Business Details</div>
                  <div class="info-item">
                    <span class="info-label">Business:</span>
                    <span class="info-value">${companyDetails?.businessName || 'Your Business Name'}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">Address:</span>
                    <span class="info-value">${companyDetails?.businessAddress || 'Business Address'}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">Pincode:</span>
                    <span class="info-value">${companyDetails?.pincode || 'Pincode'}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">Phone:</span>
                    <span class="info-value">${companyDetails?.phoneNumber1 || 'Phone Number'}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">Email:</span>
                    <span class="info-value">${companyDetails?.emailId || 'Email Address'}</span>
                  </div>
                </div>
              </div>
              
              <div class="payment-details">
                <div class="payment-details-title">Payment Summary</div>
                
                <div class="payment-row">
                  <span class="payment-label">Outstanding Balance:</span>
                  <span class="payment-amount">₹${payment.totalAmount.toLocaleString()}</span>
                </div>
                
                <div class="payment-row">
                  <span class="payment-label">Amount Paid:</span>
                  <span class="payment-amount">₹${payment.paid.toLocaleString()}</span>
                </div>
                
                <div class="payment-row">
                  <span class="payment-label">Remaining Balance:</span>
                  <span class="payment-amount">₹${(payment.totalAmount - payment.paid).toLocaleString()}</span>
                </div>
              </div>
              
              <div class="footer">
                <div class="signature-section">
                  <div class="signature-title">Authorized Signature</div>
                  <div class="signature-line"></div>
                  <div class="signature-name">${companyDetails?.signature || 'Authorized Person'}</div>
                </div>
                
                <div class="terms-section">
                  <div class="terms-title">Terms & Conditions</div>
                  <div class="terms-text">
                    • This voucher confirms payment made<br>
                    • Payment is non-refundable<br>
                    • Voucher is valid for accounting purposes<br>
                    • Subject to local jurisdiction
                  </div>
                </div>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;
      
      return await this.generatePDF(html, `payment-voucher-${payment.paymentNo}-${Date.now()}.pdf`);
    } catch (error) {
      console.error('Error generating payment voucher PDF:', error);
      return null;
    }
  }

  // Common PDF generation method with Cloudinary upload
  private static async generatePDF(html: string, fileName: string): Promise<string | null> {
    try {
      // Generate PDF locally first
      const { uri } = await Print.printToFileAsync({
        html: html,
        base64: false,
      });
      
      if (uri) {
        const fileInfo = await FileSystem.getInfoAsync(uri);
        if (fileInfo.exists && fileInfo.size > 0) {
          // Upload to Cloudinary for permanent storage
          const uploadResult = await DocumentService.uploadPdf(uri, fileName);
          
          if (uploadResult.success && uploadResult.url) {
            // Clean up local file after successful upload
            try {
              await FileSystem.deleteAsync(uri, { idempotent: true });
            } catch (cleanupError) {
              console.warn('Failed to cleanup local PDF file:', cleanupError);
            }
            
            return uploadResult.url; // Return Cloudinary URL
          } else {
            console.error('Failed to upload PDF to Cloudinary:', uploadResult.error);
            // Return local URI as fallback
            return uri;
          }
        }
      }
      return null;
    } catch (error) {
      console.error('Error generating PDF:', error);
      return null;
    }
  }

  // Common sharing method - handles both local URIs and Cloudinary URLs
  static async sharePDF(pdfUri: string, title: string): Promise<boolean> {
    try {
      const isSharingAvailable = await Sharing.isAvailableAsync();
      if (isSharingAvailable) {
        // Check if it's a Cloudinary URL or local URI
        if (pdfUri.startsWith('http')) {
          // For Cloudinary URLs, we need to download the file first
          const localUri = await this.downloadCloudinaryPDF(pdfUri, title);
          if (localUri) {
            await Sharing.shareAsync(localUri, {
              mimeType: 'application/pdf',
              dialogTitle: title,
            });
            // Clean up downloaded file after sharing
            try {
              await FileSystem.deleteAsync(localUri, { idempotent: true });
            } catch (cleanupError) {
              console.warn('Failed to cleanup downloaded PDF file:', cleanupError);
            }
            return true;
          }
          return false;
        } else {
          // For local URIs, share directly
          await Sharing.shareAsync(pdfUri, {
            mimeType: 'application/pdf',
            dialogTitle: title,
          });
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Error sharing PDF:', error);
      return false;
    }
  }

  // Helper method to download PDF from Cloudinary URL
  private static async downloadCloudinaryPDF(cloudinaryUrl: string, title: string): Promise<string | null> {
    try {
      const documentsDir = FileSystem.documentDirectory;
      if (!documentsDir) {
        throw new Error('Documents directory not available');
      }

      // Create a safe filename from the title
      const safeFileName = title.replace(/[^a-zA-Z0-9]/g, '_') + '.pdf';
      const localPath = `${documentsDir}${safeFileName}`;

      // Download the file from Cloudinary
      const downloadResult = await FileSystem.downloadAsync(cloudinaryUrl, localPath);
      
      if (downloadResult.status === 200) {
        const fileInfo = await FileSystem.getInfoAsync(localPath);
        if (fileInfo.exists && fileInfo.size > 0) {
          return localPath;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error downloading PDF from Cloudinary:', error);
      return null;
    }
  }

  // Common save to documents method
  static async saveToDocuments(pdfUri: string, fileName: string): Promise<string | null> {
    try {
      const documentsDir = FileSystem.documentDirectory;
      if (!documentsDir) {
        throw new Error('Documents directory not available');
      }
      
      const destinationUri = `${documentsDir}${fileName}`;
      await FileSystem.copyAsync({
        from: pdfUri,
        to: destinationUri,
      });
      
      return destinationUri;
    } catch (error) {
      console.error('Error saving PDF to documents:', error);
      return null;
    }
  }

  // Convenience methods for sharing
  static async generateAndShareInvoice(invoice: SaleInvoice): Promise<boolean> {
    const pdfUri = await this.generateInvoicePDF(invoice);
    if (pdfUri) {
      return await this.sharePDF(pdfUri, `Invoice #${invoice.invoiceNo}`);
    }
    return false;
  }

  static async generateAndSharePurchaseBill(bill: PurchaseBill): Promise<boolean> {
    const pdfUri = await this.generatePurchaseBillPDF(bill);
    if (pdfUri) {
      return await this.sharePDF(pdfUri, `Purchase Bill #${bill.billNo}`);
    }
    return false;
  }

  static async generateAndSharePaymentReceipt(payment: PaymentIn): Promise<boolean> {
    const pdfUri = await this.generatePaymentInPDF(payment);
    if (pdfUri) {
      return await this.sharePDF(pdfUri, `Payment Receipt #${payment.paymentNo}`);
    }
    return false;
  }

  static async generateAndSharePaymentVoucher(payment: PaymentOut): Promise<boolean> {
    const pdfUri = await this.generatePaymentOutPDF(payment);
    if (pdfUri) {
      return await this.sharePDF(pdfUri, `Payment Voucher #${payment.paymentNo}`);
    }
    return false;
  }

  // Convenience methods for saving to documents
  static async saveInvoiceToDocuments(invoice: SaleInvoice): Promise<string | null> {
    const pdfUri = await this.generateInvoicePDF(invoice);
    if (pdfUri) {
      const fileName = `Invoice_${invoice.invoiceNo}_${Date.now()}.pdf`;
      return await this.saveToDocuments(pdfUri, fileName);
    }
    return null;
  }

  static async savePurchaseBillToDocuments(bill: PurchaseBill): Promise<string | null> {
    const pdfUri = await this.generatePurchaseBillPDF(bill);
    if (pdfUri) {
      const fileName = `PurchaseBill_${bill.billNo}_${Date.now()}.pdf`;
      return await this.saveToDocuments(pdfUri, fileName);
    }
    return null;
  }

  static async savePaymentReceiptToDocuments(payment: PaymentIn): Promise<string | null> {
    const pdfUri = await this.generatePaymentInPDF(payment);
    if (pdfUri) {
      const fileName = `PaymentReceipt_${payment.paymentNo}_${Date.now()}.pdf`;
      return await this.saveToDocuments(pdfUri, fileName);
    }
    return null;
  }

  static async savePaymentVoucherToDocuments(payment: PaymentOut): Promise<string | null> {
    const pdfUri = await this.generatePaymentOutPDF(payment);
    if (pdfUri) {
      const fileName = `PaymentVoucher_${payment.paymentNo}_${Date.now()}.pdf`;
      return await this.saveToDocuments(pdfUri, fileName);
    }
    return null;
  }
}
