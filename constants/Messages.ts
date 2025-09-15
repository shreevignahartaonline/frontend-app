export const Messages = {
  // Success messages
  SUCCESS: {
    INVOICE_CREATED: 'Invoice created successfully!',
    INVOICE_UPDATED: 'Invoice updated successfully! Stock levels have been updated.',
    PURCHASE_BILL_CREATED: 'Purchase bill created successfully!',
    PURCHASE_BILL_UPDATED: 'Purchase bill updated successfully!',
    PAYMENT_RECORDED: 'Payment recorded successfully!',
    PAYMENT_UPDATED: 'Payment updated successfully!',
    PAYMENT_DELETED: 'Payment deleted successfully!',
    PRODUCT_CREATED: 'Product created successfully!',
    PRODUCT_DELETED: 'Product deleted successfully!',
    TRANSACTION_DELETED: 'Transaction deleted successfully!',
    ITEMS_ADDED: 'Items have been added to your bill.',
    COMPANY_DETAILS_SAVED: 'Company details saved successfully!',
  },

  // Error messages
  ERROR: {
    FILL_REQUIRED_FIELDS: 'Please fill in all required fields',
    FILL_ALL_REQUIRED_FIELDS: 'Please fill all required fields',
    ADD_AT_LEAST_ONE_ITEM: 'Please add at least one item',
    FILL_ALL_ITEM_FIELDS: 'Please fill all item fields',
    ENTER_VALID_PAID_AMOUNT: 'Please enter a valid paid amount',
    ENTER_VALID_RECEIVED_AMOUNT: 'Please enter a valid received amount',
    ENTER_VALID_PURCHASE_PRICE: 'Please enter a valid purchase price',
    ENTER_VALID_SALE_PRICE: 'Please enter a valid sale price',
    ENTER_VALID_OPENING_STOCK: 'Please enter a valid opening stock',
    ENTER_VALID_LOW_STOCK_ALERT: 'Please enter a valid low stock alert',
    PRODUCT_EXISTS: 'A product with this name already exists',
    INVOICE_NOT_FOUND: 'Invoice not found',
    PURCHASE_BILL_NOT_FOUND: 'Purchase bill not found',
    PAYMENT_NOT_FOUND: 'Payment not found',
    FAILED_TO_LOAD_INVOICE: 'Failed to load invoice',
    FAILED_TO_LOAD_PURCHASE_BILL: 'Failed to load purchase bill',
    FAILED_TO_LOAD_PAYMENT: 'Failed to load payment',
    FAILED_TO_SAVE_INVOICE: 'Failed to save invoice. Please try again.',
    FAILED_TO_UPDATE_INVOICE: 'Failed to update invoice',
    FAILED_TO_CREATE_PURCHASE_BILL: 'Failed to create purchase bill. Please try again.',
    FAILED_TO_UPDATE_PURCHASE_BILL: 'Failed to update purchase bill',
    FAILED_TO_SAVE_PAYMENT: 'Failed to save payment. Please try again.',
    FAILED_TO_UPDATE_PAYMENT: 'Failed to update payment',
    FAILED_TO_DELETE_PAYMENT: 'Failed to delete payment',
    FAILED_TO_SAVE_PRODUCT: 'Failed to save product. Please try again.',
    FAILED_TO_DELETE_PRODUCT: 'Failed to delete product. Please try again.',
    FAILED_TO_DELETE_TRANSACTION: 'Failed to delete transaction. Please try again.',
    FAILED_TO_ADD_ITEMS: 'Failed to add items. Please try again.',
    FAILED_TO_SAVE_COMPANY_DETAILS: 'Failed to save company details. Please try again.',
  },

  // Confirmation messages
  CONFIRM: {
    DELETE_TRANSACTION: 'Are you sure you want to delete this transaction?',
    DELETE_PRODUCT: 'Are you sure you want to delete this product?',
    DELETE_PAYMENT: 'Are you sure you want to delete this payment?',
  },

  // Info messages
  INFO: {
    COMING_SOON_SHARE: 'Share functionality will be available soon.',
    COMING_SOON_PRINT: 'Print functionality will be available soon.',
  },
} as const;
