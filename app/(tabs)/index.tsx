import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import Modal from 'react-native-modal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { CompanyApiService, Party, PaymentApiService, PurchaseApiService, SaleApiService } from '../../utils/api';
import { BasePdfGenerator } from '../../utils/basePdfGenerator';
import { DocumentService } from '../../utils/documentService';
import { PartyManager } from '../../utils/partyManager';

// Android-specific utilities
const isAndroid = Platform.OS === 'android';
const { width, height } = Dimensions.get('window');
const { height: screenHeight, width: screenWidth } = Dimensions.get('screen');

// Android-specific constants
const ANDROID_CONSTANTS = {
  statusBarHeight: isAndroid ? StatusBar.currentHeight || 24 : 0,
  navigationBarHeight: isAndroid ? 48 : 0,
  touchTargetMinSize: 48, // Android Material Design minimum touch target
  elevation: {
    low: isAndroid ? 2 : 0,
    medium: isAndroid ? 4 : 0,
    high: isAndroid ? 8 : 0,
  },
  rippleColor: isAndroid ? 'rgba(0, 0, 0, 0.1)' : undefined,
};

interface Transaction {
  id: string;
  type: 'sale' | 'purchase' | 'payment-in' | 'payment-out';
  reference: string;
  partyName: string;
  amount: number;
  date: string;
  items?: any[];
  pdfUri?: string; // For sale invoices and purchase bills
}

interface FilterOptions {
  all: boolean;
  sales: boolean;
  purchases: boolean;
  paymentIn: boolean;
  paymentOut: boolean;
}

// Use Party interface directly since it already has all the needed properties

// Helper function to check if a string is a valid MongoDB ObjectId
const isValidObjectId = (id: string): boolean => {
  return /^[0-9a-fA-F]{24}$/.test(id);
};

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<'transactions' | 'party'>('transactions');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [activeFilterOptions, setActiveFilterOptions] = useState<FilterOptions>({
    all: true,
    sales: false,
    purchases: false,
    paymentIn: false,
    paymentOut: false,
  });
  const [modalFilterOptions, setModalFilterOptions] = useState<FilterOptions>({
    all: true,
    sales: false,
    purchases: false,
    paymentIn: false,
    paymentOut: false,
  });
  const [unifiedParties, setUnifiedParties] = useState<Array<Party & { netBalance: number }>>([]);
  const [filteredUnifiedParties, setFilteredUnifiedParties] = useState<Array<Party & { netBalance: number }>>([]);
  const [showPartyFilterModal, setShowPartyFilterModal] = useState(false);
  const [partyFilterOptions, setPartyFilterOptions] = useState({
    all: true,
    customers: false,
    suppliers: false,
  });
  const [activePartyFilter, setActivePartyFilter] = useState('all');
  const [companyDetails, setCompanyDetails] = useState<{ businessName: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);

  useEffect(() => {
    loadDashboardData();
    loadUnifiedParties();
    loadCompanyDetails();
  }, []);

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
      loadUnifiedParties();
      loadCompanyDetails();
    }, [])
  );

  // Monitor for transaction updates and refresh party balances
  useEffect(() => {
    // Reload all data periodically to reflect any changes
    const interval = setInterval(() => {
      loadDashboardData();
      loadUnifiedParties();
    }, 10000); // Check every 10 seconds for better performance
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    filterTransactions();
  }, [transactions, activeFilterOptions, searchQuery]);

  useEffect(() => {
    filterUnifiedParties();
  }, [unifiedParties]);



  const loadDashboardData = async () => {
    try {
      // Load sales invoices from API
      const salesInvoices = await SaleApiService.getSales();
      const salesPayments = await PaymentApiService.getPayments({ type: 'payment-in' });
      const purchaseBills = await PurchaseApiService.getPurchases();
      const purchasePayments = await PaymentApiService.getPayments({ type: 'payment-out' });
      
      // Combine all transactions
      const allTransactions: Transaction[] = [];

      // Add sales invoices
      salesInvoices?.forEach((invoice: any, index: number) => {
        // Only use fallback ID if the invoice truly has no ID
        const transactionId = invoice.id && invoice.id.trim() !== '' ? invoice.id : `sale-${index}-${Date.now()}`;
        
        
        allTransactions.push({
          id: transactionId,
          type: 'sale',
          reference: `INV-${invoice.invoiceNo || ''}`,
          partyName: invoice.partyName || '',
          amount: invoice.totalAmount || 0,
          date: invoice.date || invoice.createdAt || '',
          items: invoice.items || [],
          pdfUri: invoice.pdfUri || undefined, // Include PDF URI
        });
      });

      // Add sales payments (Payment In)
      salesPayments?.forEach((payment, index) => {
        allTransactions.push({
          id: payment.id || `payment-in-${index}-${Date.now()}`,
          type: 'payment-in',
          reference: payment.paymentNo || `PAY-${payment.id || ''}`,
          partyName: payment.partyName || '',
          amount: payment.amount || 0,
          date: payment.date || payment.createdAt || '',
        });
      });

      // Add purchase bills
      purchaseBills?.forEach((bill, index) => {
        // Only use fallback ID if the bill truly has no ID
        const transactionId = bill.id && bill.id.trim() !== '' ? bill.id : `purchase-${index}-${Date.now()}`;
        
        allTransactions.push({
          id: transactionId,
          type: 'purchase',
          reference: `BILL-${bill.billNo || ''}`,
          partyName: bill.partyName || '',
          amount: bill.totalAmount || 0,
          date: bill.date || bill.createdAt || '',
          items: bill.items || [],
          pdfUri: bill.pdfUri || undefined, // Include PDF URI
        });
      });

      // Add purchase payments (Payment Out)
      purchasePayments?.forEach((payment, index) => {
        allTransactions.push({
          id: payment.id || `payment-out-${index}-${Date.now()}`,
          type: 'payment-out',
          reference: payment.paymentNo || `PAY-${payment.id || ''}`,
          partyName: payment.partyName || '',
          amount: payment.amount || 0,
          date: payment.date || payment.createdAt || '',
        });
      });

      // Sort by date and time (newest first) with improved sorting
      allTransactions.sort((a, b) => {
        // Helper function to get the best available timestamp
        const getTimestamp = (transaction: any): number => {
          // Try date first
          const dateTime = new Date(transaction.date || '').getTime();
          if (!isNaN(dateTime) && dateTime > 0) {
            return dateTime;
          }
          
          // Try createdAt as fallback
          const createdAtTime = new Date(transaction.createdAt || '').getTime();
          if (!isNaN(createdAtTime) && createdAtTime > 0) {
            return createdAtTime;
          }
          
          // Try to extract timestamp from ID
          const idTimestamp = transaction.id?.match(/\d{13}/)?.[0];
          if (idTimestamp) {
            return parseInt(idTimestamp);
          }
          
          return 0;
        };
        
        const timestampA = getTimestamp(a);
        const timestampB = getTimestamp(b);
        
        // Handle invalid timestamps - put them at the end
        const isValidTimestampA = timestampA > 0;
        const isValidTimestampB = timestampB > 0;
        
        if (!isValidTimestampA && !isValidTimestampB) {
          // Both invalid timestamps - sort by ID
          return (b.id || '').localeCompare(a.id || '');
        }
        
        if (!isValidTimestampA) {
          // A has invalid timestamp, put it at the end
          return 1;
        }
        
        if (!isValidTimestampB) {
          // B has invalid timestamp, put it at the end
          return -1;
        }
        
        // Both have valid timestamps - sort by timestamp (newest first)
        if (timestampA !== timestampB) {
          return timestampB - timestampA;
        }
        
        // Same timestamp - sort by ID
        return (b.id || '').localeCompare(a.id || '');
      });
      
      setTransactions(allTransactions);
      setLastRefreshTime(new Date());
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        loadDashboardData(),
        loadUnifiedParties(),
        loadCompanyDetails()
      ]);
      setLastRefreshTime(new Date());
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const filterTransactions = () => {
    let filtered = transactions;

    // Filter by type
    const activeFilters = Object.keys(activeFilterOptions).filter(key => activeFilterOptions[key as keyof FilterOptions]);
    
    if (!activeFilterOptions.all && activeFilters.length > 0) {
      const filterMap = {
        'sales': 'sale',
        'purchases': 'purchase',
        'paymentIn': 'payment-in',
        'paymentOut': 'payment-out'
      };
      filtered = filtered.filter(transaction => 
        activeFilters.some(filter => {
          const filterValue = filterMap[filter as keyof typeof filterMap];
          return transaction.type === filterValue;
        })
      );
    }

    // Filter by search query (customer name)
    if (searchQuery.trim()) {
      filtered = filtered.filter(transaction =>
        transaction.partyName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredTransactions(filtered);
  };

  const loadUnifiedParties = async () => {
    try {
      // Use PartyManager to get parties with calculated balances
      const partiesWithBalances = await PartyManager.getPartiesWithBalances();
      
      // Map to the expected format with netBalance property
      const partiesWithNetBalance = partiesWithBalances.map(party => ({
        ...party,
        netBalance: party.calculatedBalance
      }));
      
      // Show all parties including settled ones (netBalance = 0)
      setUnifiedParties(partiesWithNetBalance);
    } catch (error) {
      console.error('Error loading unified parties:', error);
    }
  };

  const loadCompanyDetails = async () => {
    try {
      const details = await CompanyApiService.getCompanyDetails();
      setCompanyDetails(details);
    } catch (error) {
      console.error('Error loading company details:', error);
      // Don't show alert for company details as it's not critical for dashboard
      // Alert.alert('Error', handleApiError(error));
    }
  };



  const sharePDF = async (transaction: Transaction) => {
    try {
      if (!transaction.pdfUri) {
        Alert.alert('Error', 'PDF not found for this document');
        return;
      }

      const isSharingAvailable = await Sharing.isAvailableAsync();
      if (isSharingAvailable) {
        await Sharing.shareAsync(transaction.pdfUri, {
          mimeType: 'application/pdf',
          dialogTitle: `${transaction.type === 'sale' ? 'Invoice' : 'Purchase Bill'} #${transaction.reference}`,
        });
      } else {
        Alert.alert('Error', 'Sharing not available on this device');
      }
    } catch (error) {
      console.error('Error sharing PDF:', error);
      Alert.alert('Error', 'Failed to share PDF');
    }
  };

  const generateAndShareInvoicePDF = async (transaction: Transaction) => {
    try {
      // Get the sale invoice from API
      const saleInvoice = await SaleApiService.getSaleById(transaction.id);
      
      if (saleInvoice) {
        // Generate PDF and get the URI
        const pdfUri = await BasePdfGenerator.generateInvoicePDF(saleInvoice);
        
        if (pdfUri) {
          // Update the invoice with the PDF URI
          await SaleApiService.updateSale(transaction.id, { pdfUri });
          
          // Send invoice via WhatsApp if phone number is available
          if (saleInvoice.phoneNumber) {
            try {
              const whatsappResult = await DocumentService.sendInvoiceViaWhatsApp(
                saleInvoice.phoneNumber,
                pdfUri,
                saleInvoice.invoiceNo,
                saleInvoice.partyName,
                saleInvoice.totalAmount
              );

              if (whatsappResult.success) {
                console.log('Invoice sent via WhatsApp successfully:', whatsappResult.messageId);
                Alert.alert('Success', 'Invoice sent via WhatsApp successfully!');
                return; // Don't show sharing dialog if WhatsApp was successful
              } else {
                console.warn('Failed to send invoice via WhatsApp:', whatsappResult.error);
                // Continue with local sharing as fallback
              }
            } catch (whatsappError) {
              console.error('Error sending invoice via WhatsApp:', whatsappError);
              // Continue with local sharing as fallback
            }
          }
          
          // Reload dashboard data to ensure consistency
          try {
            await loadDashboardData();
          } catch (error) {
            console.error('Error reloading dashboard data:', error);
          }
          
          // Share the PDF locally as fallback
          const isSharingAvailable = await Sharing.isAvailableAsync();
          if (isSharingAvailable) {
            await Sharing.shareAsync(pdfUri, {
              mimeType: 'application/pdf',
              dialogTitle: `Invoice #${saleInvoice.invoiceNo}`,
            });
          } else {
            Alert.alert('Error', 'Sharing not available on this device');
          }
        } else {
          Alert.alert('Error', 'Failed to generate invoice PDF');
        }
      } else {
        Alert.alert('Error', 'Sale invoice not found');
      }
    } catch (error) {
      console.error('Error generating and sharing invoice PDF:', error);
      Alert.alert('Error', 'Failed to generate and share invoice PDF');
    }
  };

  const generateAndSharePurchaseBillPDF = async (transaction: Transaction) => {
    try {
      // Get the purchase bill from API
      const purchaseBill = await PurchaseApiService.getPurchaseById(transaction.id);
      
      if (purchaseBill) {
        // Generate PDF and get the URI
        const pdfUri = await BasePdfGenerator.generatePurchaseBillPDF(purchaseBill);
        
        if (pdfUri) {
          // Update the bill with the PDF URI
          await PurchaseApiService.updatePurchase(transaction.id, { pdfUri });
          
          // Send purchase bill via WhatsApp if phone number is available
          if (purchaseBill.phoneNumber) {
            try {
              const whatsappResult = await DocumentService.sendPurchaseBillViaWhatsApp(
                purchaseBill.phoneNumber,
                pdfUri,
                purchaseBill.billNo,
                purchaseBill.partyName,
                purchaseBill.totalAmount
              );

              if (whatsappResult.success) {
                console.log('Purchase bill sent via WhatsApp successfully:', whatsappResult.messageId);
                Alert.alert('Success', 'Purchase bill sent via WhatsApp successfully!');
                return; // Don't show sharing dialog if WhatsApp was successful
              } else {
                console.warn('Failed to send purchase bill via WhatsApp:', whatsappResult.error);
                // Continue with local sharing as fallback
              }
            } catch (whatsappError) {
              console.error('Error sending purchase bill via WhatsApp:', whatsappError);
              // Continue with local sharing as fallback
            }
          }
          
          // Reload dashboard data to ensure consistency
          try {
            await loadDashboardData();
          } catch (error) {
            console.error('Error reloading dashboard data:', error);
          }
          
          // Share the PDF locally as fallback
          const isSharingAvailable = await Sharing.isAvailableAsync();
          if (isSharingAvailable) {
            await Sharing.shareAsync(pdfUri, {
              mimeType: 'application/pdf',
              dialogTitle: `Purchase Bill #${purchaseBill.billNo}`,
            });
          } else {
            Alert.alert('Error', 'Sharing not available on this device');
          }
        } else {
          Alert.alert('Error', 'Failed to generate purchase bill PDF');
        }
      } else {
        Alert.alert('Error', 'Purchase bill not found');
      }
    } catch (error) {
      console.error('Error generating and sharing purchase bill PDF:', error);
      Alert.alert('Error', 'Failed to generate and share purchase bill PDF');
    }
  };

  const filterUnifiedParties = () => {
    // Since we removed search functionality, just show all parties
    setFilteredUnifiedParties(unifiedParties);
  };

  const openPartyFilterModal = () => {
    setShowPartyFilterModal(true);
  };

  const handlePartyFilterToggle = (filter: string) => {
    setPartyFilterOptions(prev => {
      const newOptions = {
        all: false,
        customers: false,
        suppliers: false,
      };
      newOptions[filter as keyof typeof newOptions] = true;
      return newOptions;
    });
  };

  const applyPartyFilters = () => {
    if (partyFilterOptions.all) {
      setActivePartyFilter('all');
    } else if (partyFilterOptions.customers) {
      setActivePartyFilter('customers');
    } else if (partyFilterOptions.suppliers) {
      setActivePartyFilter('suppliers');
    }
    setShowPartyFilterModal(false);
  };

  const clearPartyFilters = () => {
    setPartyFilterOptions({
      all: true,
      customers: false,
      suppliers: false,
    });
    setActivePartyFilter('all');
  };

  const getFilteredParties = () => {
    return filteredUnifiedParties;
  };

  const handleFilterToggle = (filterKey: keyof FilterOptions) => {
    if (filterKey === 'all') {
      setModalFilterOptions({
        all: true,
        sales: false,
        purchases: false,
        paymentIn: false,
        paymentOut: false,
      });
    } else {
      const newOptions = {
        ...modalFilterOptions,
        all: false,
        [filterKey]: !modalFilterOptions[filterKey],
      };
      
      // If no specific filters are selected, default to 'all'
      if (!newOptions.sales && !newOptions.purchases && !newOptions.paymentIn && !newOptions.paymentOut) {
        newOptions.all = true;
      }
      
      setModalFilterOptions(newOptions);
    }
  };

  const clearFilters = () => {
    setModalFilterOptions({
      all: true,
      sales: false,
      purchases: false,
      paymentIn: false,
      paymentOut: false,
    });
  };

  const applyFilters = () => {
    setActiveFilterOptions(modalFilterOptions);
    setShowFilterModal(false);
  };

  const openFilterModal = () => {
    setModalFilterOptions(activeFilterOptions);
    setShowFilterModal(true);
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'sale':
        return 'trending-up';
      case 'purchase':
        return 'cart';
      case 'payment-in':
        return 'arrow-down-circle';
      case 'payment-out':
        return 'arrow-up-circle';
      default:
        return 'help-circle';
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'sale':
        return Colors.success; // Green
      case 'purchase':
        return Colors.info; // Blue
      case 'payment-in':
        return '#8b5cf6'; // Purple for Payment In
      case 'payment-out':
        return Colors.error; // Red
      default:
        return Colors.textTertiary;
    }
  };

  const getTransactionTypeLabel = (type: string) => {
    switch (type) {
      case 'sale':
        return 'Sale';
      case 'purchase':
        return 'Purchase';
      case 'payment-in':
        return 'PAY IN';
      case 'payment-out':
        return 'PAY OUT';
      default:
        return 'Transaction';
    }
  };

  const navigateToTransaction = (transaction: Transaction) => {
    switch (transaction.type) {
      case 'sale':
        router.push({
          pathname: '/edit-invoice',
          params: { invoiceId: transaction.id }
        });
        break;
      case 'purchase':
        router.push({
          pathname: '/edit-purchase',
          params: { billId: transaction.id }
        });
        break;
      case 'payment-in':
        router.push({
          pathname: '/edit-payin',
          params: { paymentId: transaction.id }
        });
        break;
      case 'payment-out':
        router.push({
          pathname: '/edit-payout',
          params: { paymentId: transaction.id }
        });
        break;
    }
  };

  const deleteTransaction = async (transaction: Transaction) => {
    // Check if this is a valid MongoDB ObjectId for database transactions
    const isDatabaseTransaction = isValidObjectId(transaction.id);
    
    // Check if this is a generated ID (can't be deleted from database)
    const isGeneratedId = transaction.id.startsWith('sale-') || 
                         transaction.id.startsWith('purchase-');
    
    if (isGeneratedId || !isDatabaseTransaction) {
      Alert.alert(
        'Cannot Delete',
        'This transaction cannot be deleted as it appears to be corrupted or incomplete. Please refresh the dashboard and try again.',
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert(
      'Delete Transaction',
      `Are you sure you want to delete ${transaction.reference}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              let updatedData: any[] = [];
              
              switch (transaction.type) {
                case 'sale':
                  // Delete sale from API
                  await SaleApiService.deleteSale(transaction.id);
                  break;
                  
                case 'payment-in':
                  await PaymentApiService.deletePayment(transaction.id);
                  break;
                  
                case 'purchase':
                  // Delete purchase from API
                  await PurchaseApiService.deletePurchase(transaction.id);
                  break;
                  
                case 'payment-out':
                  await PaymentApiService.deletePayment(transaction.id);
                  break;
              }
              
              // Reload dashboard data to reflect changes
              loadDashboardData();
              Alert.alert('Success', 'Transaction deleted successfully!');
            } catch (error) {
              console.error('Error deleting transaction:', error);
              Alert.alert('Error', 'Failed to delete transaction. Please try again.');
            }
          },
        },
      ]
    );
  };

  const FilterCheckbox = ({ label, checked, onToggle }: {
    label: string;
    checked: boolean;
    onToggle: () => void;
  }) => (
    <TouchableOpacity 
      style={styles.checkboxContainer} 
      onPress={onToggle}
      activeOpacity={isAndroid ? 0.7 : 0.2}
      {...(isAndroid && {
        android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
      })}
    >
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked && <Ionicons name="checkmark" size={16} color={Colors.text} />}
      </View>
      <Text style={styles.checkboxLabel}>{label}</Text>
    </TouchableOpacity>
  );

  const TransactionItem = ({ transaction }: { transaction: Transaction }) => {
    return (
    <TouchableOpacity 
      style={styles.transactionItem}
      onPress={() => navigateToTransaction(transaction)}
      activeOpacity={isAndroid ? 0.7 : 0.2}
      {...(isAndroid && {
        android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
      })}
    >
      <View style={styles.transactionHeader}>
        <View style={styles.transactionLeft}>
          <View style={[styles.transactionIcon, { backgroundColor: getTransactionColor(transaction.type) }]}>
            <Ionicons name={getTransactionIcon(transaction.type) as any} size={20} color={Colors.text} />
          </View>
          <View style={styles.transactionInfo}>
            <Text style={styles.transactionReference}>{transaction.reference}</Text>
            <Text style={styles.transactionCustomer}>{transaction.partyName}</Text>
            <Text style={styles.transactionDate}>{transaction.date}</Text>
          </View>
        </View>
        <View style={styles.transactionRight}>
          <Text style={[styles.transactionAmount, { color: getTransactionColor(transaction.type) }]}>
            ₹{(transaction.amount || 0).toLocaleString()}
          </Text>
          <View style={styles.transactionTypeContainer}>
            <View style={[styles.transactionBadge, { backgroundColor: getTransactionColor(transaction.type) }]}>
              <Text style={styles.transactionBadgeText}>{getTransactionTypeLabel(transaction.type)}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Action Icons */}
      <View style={styles.actionIconsContainer}>
        {transaction.type === 'sale' && transaction.pdfUri && (
          <TouchableOpacity 
            style={styles.actionIcon} 
            onPress={(e) => {
              e.stopPropagation();
              sharePDF(transaction);
            }}
            activeOpacity={isAndroid ? 0.7 : 0.2}
            {...(isAndroid && {
              android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
            })}
          >
            <Ionicons name="share-outline" size={20} color={Colors.primary} />
          </TouchableOpacity>
        )}
        {transaction.type === 'sale' && !transaction.pdfUri && (
          <TouchableOpacity 
            style={styles.actionIcon} 
            onPress={(e) => {
              e.stopPropagation();
              generateAndShareInvoicePDF(transaction);
            }}
            activeOpacity={isAndroid ? 0.7 : 0.2}
            {...(isAndroid && {
              android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
            })}
          >
            <Ionicons name="share-outline" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        )}
        {transaction.type === 'purchase' && transaction.pdfUri && (
          <TouchableOpacity 
            style={styles.actionIcon} 
            onPress={(e) => {
              e.stopPropagation();
              sharePDF(transaction);
            }}
            activeOpacity={isAndroid ? 0.7 : 0.2}
            {...(isAndroid && {
              android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
            })}
          >
            <Ionicons name="share-outline" size={20} color={Colors.primary} />
          </TouchableOpacity>
        )}
        {transaction.type === 'purchase' && !transaction.pdfUri && (
          <TouchableOpacity 
            style={styles.actionIcon} 
            onPress={(e) => {
              e.stopPropagation();
              generateAndSharePurchaseBillPDF(transaction);
            }}
            activeOpacity={isAndroid ? 0.7 : 0.2}
            {...(isAndroid && {
              android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
            })}
          >
            <Ionicons name="share-outline" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        )}
        <TouchableOpacity 
          style={styles.actionIcon} 
          onPress={(e) => {
            e.stopPropagation();
            Alert.alert('Coming Soon!', 'Print functionality will be available soon.');
          }}
          activeOpacity={isAndroid ? 0.7 : 0.2}
          {...(isAndroid && {
            android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
          })}
        >
          <Ionicons name="print-outline" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.actionIcon} 
          onPress={(e) => {
            e.stopPropagation();
            deleteTransaction(transaction);
          }}
          activeOpacity={isAndroid ? 0.7 : 0.2}
          {...(isAndroid && {
            android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
          })}
        >
          <Ionicons name="trash-outline" size={20} color={Colors.error} />
        </TouchableOpacity>
      </View>
      

    </TouchableOpacity>
    );
  };


  const PartyItem = ({ party }: { party: Party & { netBalance: number } }) => {
    // Determine text color and arrow based on net balance
    let balanceColor: string;
    let arrowSymbol = '';
    let transactionLabel = '';
    
    if (party.netBalance === 0) {
      balanceColor = Colors.textSecondary; // White/gray color for zero balance
    } else if (party.netBalance > 0) {
      // Positive balance = party owes us money (incoming)
      balanceColor = Colors.success; // Green
      arrowSymbol = '←'; // Inward arrow
      transactionLabel = 'Incoming';
    } else {
      // Negative balance = we owe party money (outgoing)
      balanceColor = Colors.error; // Red
      arrowSymbol = '→'; // Outward arrow
      transactionLabel = 'Outgoing';
    }
    
    const handlePartyPress = () => {
      if (party.id) {
        router.push(`/partyTransactions?partyId=${party.id}`);
      } else {
        Alert.alert('Error', 'Party ID not found');
      }
    };
    
    return (
      <TouchableOpacity 
        style={styles.customerItem}
        onPress={handlePartyPress}
        activeOpacity={isAndroid ? 0.7 : 0.2}
        {...(isAndroid && {
          android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
        })}
      >
        <View style={styles.customerHeader}>
          <View style={styles.partyInfo}>
            <Text style={styles.customerName}>{party.name}</Text>
            <Text style={styles.partyType}>
              Party
            </Text>
          </View>
          <View style={styles.balanceContainer}>
            <Text style={[
              styles.customerBalance,
              { color: balanceColor }
            ]}>
              {arrowSymbol} {Math.abs(party.netBalance || 0).toLocaleString()}
            </Text>
            <Text style={[
              styles.transactionLabel,
              { color: balanceColor }
            ]}>
              {transactionLabel}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>Welcome to</Text>
          <Text style={styles.companyName}>
            {companyDetails?.businessName || 'Vignaharta Plastic Industries'}
          </Text>
        </View>
        <TouchableOpacity 
          style={styles.settingsButton}
          onPress={() => router.push('/company-details')}
          activeOpacity={isAndroid ? 0.7 : 0.2}
          {...(isAndroid && {
            android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
          })}
        >
          <Ionicons name="settings-outline" size={24} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.primary]} // Android
            tintColor={Colors.primary} // iOS
          />
        }
        // Android-specific: Optimize scrolling
        {...(isAndroid && {
          overScrollMode: 'never',
          nestedScrollEnabled: true,
        })}
      >

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'transactions' && styles.activeTab]}
          onPress={() => setActiveTab('transactions')}
          activeOpacity={isAndroid ? 0.7 : 0.2}
          {...(isAndroid && {
            android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
          })}
        >
          <Text style={[styles.tabText, activeTab === 'transactions' && styles.activeTabText]}>
            Transactions
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'party' && styles.activeTab]}
          onPress={() => setActiveTab('party')}
          activeOpacity={isAndroid ? 0.7 : 0.2}
          {...(isAndroid && {
            android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
          })}
        >
          <Text style={[styles.tabText, activeTab === 'party' && styles.activeTabText]}>
            Party
          </Text>
        </TouchableOpacity>
      </View>



      {/* Transactions Tab Content */}
      {activeTab === 'transactions' && (
        <View style={styles.searchContainer}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          <View style={styles.searchInputContainer}>
            <Ionicons name="search" size={20} color={Colors.textSecondary} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by customer name..."
              placeholderTextColor={Colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
                          {searchQuery.length > 0 && (
                <TouchableOpacity 
                  onPress={() => setSearchQuery('')} 
                  style={styles.clearButton}
                  activeOpacity={isAndroid ? 0.7 : 0.2}
                  {...(isAndroid && {
                    android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
                  })}
                >
                  <Ionicons name="close-circle" size={20} color={Colors.textSecondary} />
                </TouchableOpacity>
              )}
              <TouchableOpacity 
                onPress={openFilterModal} 
                style={styles.filterButton}
                activeOpacity={isAndroid ? 0.7 : 0.2}
                {...(isAndroid && {
                  android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
                })}
              >
                <Ionicons name="filter" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Transactions Tab Content */}
      {activeTab === 'transactions' && (
        <View style={styles.transactionsContainer}>
          {filteredTransactions.length > 0 ? (
            <FlatList
              data={filteredTransactions.slice(0, 20)} // Show last 20 transactions
              renderItem={({ item }) => <TransactionItem transaction={item} />}
              keyExtractor={(item, index) => item.id || `dashboard-transaction-${index}`}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
            />
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={64} color={Colors.textTertiary} />
              <Text style={styles.emptyStateTitle}>
                {searchQuery.trim() ? 'No Matching Transactions' : 'No Transactions Yet'}
              </Text>
              <Text style={styles.emptyStateSubtitle}>
                {searchQuery.trim() 
                  ? `No transactions found for "${searchQuery}"`
                  : 'Your transactions will appear here'
                }
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Party Tab Content */}
      {activeTab === 'party' && (
        <>
          <View style={styles.searchContainer}>
            <Text style={styles.sectionTitle}>All Parties</Text>
          </View>
          
          <View style={styles.transactionsContainer}>
            {getFilteredParties().length > 0 ? (
              <FlatList
                data={getFilteredParties()}
                renderItem={({ item }) => <PartyItem party={item} />}
                keyExtractor={(item, index) => `dashboard-party-${item.id || index}`}
                scrollEnabled={false}
                showsVerticalScrollIndicator={false}
              />
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={64} color={Colors.textTertiary} />
                <Text style={styles.emptyStateTitle}>
                  No Parties Yet
                </Text>
                <Text style={styles.emptyStateSubtitle}>
                  Parties will appear here when you create transactions
                </Text>
              </View>
            )}
          </View>
        </>
      )}

      {/* Filter Modal */}
      <Modal
        isVisible={showFilterModal}
        animationIn="slideInUp"
        animationOut="slideOutDown"
        style={styles.modal}
        hasBackdrop={false}
        coverScreen={true}
        deviceHeight={screenHeight}
        deviceWidth={screenWidth}
        statusBarTranslucent={true}
        useNativeDriverForBackdrop={true}
        hideModalContentWhileAnimating={false}
      >
        <TouchableWithoutFeedback onPress={() => setShowFilterModal(false)}>
          <View style={styles.customBackdrop} />
        </TouchableWithoutFeedback>

        <View style={[styles.modalContent, { 
          paddingTop: 15,
          paddingBottom: Math.max(insets.bottom, 10),
          height: height - insets.top - insets.bottom
        }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Filter Transactions</Text>
            <TouchableOpacity 
              onPress={() => setShowFilterModal(false)}
              activeOpacity={isAndroid ? 0.7 : 0.2}
              {...(isAndroid && {
                android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
              })}
            >
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
            <View style={styles.filterOptions}>
              <FilterCheckbox
                label="All Transactions"
                checked={modalFilterOptions.all}
                onToggle={() => handleFilterToggle('all')}
              />
              <FilterCheckbox
                label="Sales"
                checked={modalFilterOptions.sales}
                onToggle={() => handleFilterToggle('sales')}
              />
              <FilterCheckbox
                label="Purchase"
                checked={modalFilterOptions.purchases}
                onToggle={() => handleFilterToggle('purchases')}
              />
              <FilterCheckbox
                label="Payment In"
                checked={modalFilterOptions.paymentIn}
                onToggle={() => handleFilterToggle('paymentIn')}
              />
              <FilterCheckbox
                label="Payment Out"
                checked={modalFilterOptions.paymentOut}
                onToggle={() => handleFilterToggle('paymentOut')}
              />
            </View>
          </ScrollView>
          
          <View style={styles.modalFooter}>
            <TouchableOpacity 
              style={styles.cancelButton} 
              onPress={() => setShowFilterModal(false)}
              activeOpacity={isAndroid ? 0.7 : 0.2}
              {...(isAndroid && {
                android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
              })}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.clearFiltersButton} 
              onPress={clearFilters}
              activeOpacity={isAndroid ? 0.7 : 0.2}
              {...(isAndroid && {
                android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
              })}
            >
              <Text style={styles.clearFiltersText}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.applyFiltersButton} 
              onPress={applyFilters}
              activeOpacity={isAndroid ? 0.7 : 0.2}
              {...(isAndroid && {
                android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
              })}
            >
              <Text style={styles.applyFiltersText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Party Filter Modal */}
      <Modal
        isVisible={showPartyFilterModal}
        animationIn="slideInUp"
        animationOut="slideOutDown"
        style={styles.modal}
        hasBackdrop={false}
        coverScreen={true}
        deviceHeight={screenHeight}
        deviceWidth={screenWidth}
        statusBarTranslucent={true}
        useNativeDriverForBackdrop={true}
        hideModalContentWhileAnimating={false}
      >
        <TouchableWithoutFeedback onPress={() => setShowPartyFilterModal(false)}>
          <View style={styles.customBackdrop} />
        </TouchableWithoutFeedback>

        <View style={[styles.modalContent, { 
          paddingTop: 15,
          paddingBottom: Math.max(insets.bottom, 10),
          height: height - insets.top - insets.bottom
        }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Filter Parties</Text>
            <TouchableOpacity 
              onPress={() => setShowPartyFilterModal(false)}
              activeOpacity={isAndroid ? 0.7 : 0.2}
              {...(isAndroid && {
                android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
              })}
            >
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
            <View style={styles.filterOptions}>
              <FilterCheckbox
                label="All Parties"
                checked={partyFilterOptions.all}
                onToggle={() => handlePartyFilterToggle('all')}
              />
              <FilterCheckbox
                label="Customers"
                checked={partyFilterOptions.customers}
                onToggle={() => handlePartyFilterToggle('customers')}
              />
              <FilterCheckbox
                label="Suppliers"
                checked={partyFilterOptions.suppliers}
                onToggle={() => handlePartyFilterToggle('suppliers')}
              />
            </View>
          </ScrollView>
          
          <View style={styles.modalFooter}>
            <TouchableOpacity 
              style={styles.cancelButton} 
              onPress={() => setShowPartyFilterModal(false)}
              activeOpacity={isAndroid ? 0.7 : 0.2}
              {...(isAndroid && {
                android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
              })}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.clearFiltersButton} 
              onPress={clearPartyFilters}
              activeOpacity={isAndroid ? 0.7 : 0.2}
              {...(isAndroid && {
                android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
              })}
            >
              <Text style={styles.clearFiltersText}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.applyFiltersButton} 
              onPress={applyPartyFilters}
              activeOpacity={isAndroid ? 0.7 : 0.2}
              {...(isAndroid && {
                android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
              })}
            >
              <Text style={styles.applyFiltersText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
    // Android-specific: Optimize scrolling performance
    ...(isAndroid && {
      overScrollMode: 'never',
      nestedScrollEnabled: true,
    }),
  },
  header: {
    padding: 20,
    paddingTop: isAndroid ? 60 : 20, // Increased padding for Android status bar
    paddingBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerLeft: {
    flex: 1,
  },
  settingsButton: {
    padding: 8,
    marginTop: 4,
    // Android-specific: Ensure minimum touch target
    minWidth: ANDROID_CONSTANTS.touchTargetMinSize,
    minHeight: ANDROID_CONSTANTS.touchTargetMinSize,
    justifyContent: 'center',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  companyName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 4,
    // Android-specific: Add elevation for Material Design
    ...(isAndroid && {
      elevation: ANDROID_CONSTANTS.elevation.low,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.22,
      shadowRadius: 2.22,
    }),
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    // Android-specific: Ensure minimum touch target
    minHeight: ANDROID_CONSTANTS.touchTargetMinSize,
    justifyContent: 'center',
  },
  activeTab: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  activeTabText: {
    color: Colors.text,
  },

  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 16,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    // Android-specific: Add elevation and optimize input
    ...(isAndroid && {
      elevation: ANDROID_CONSTANTS.elevation.low,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.22,
      shadowRadius: 2.22,
    }),
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
    // Android-specific: Optimize text input
    ...(isAndroid && {
      textAlignVertical: 'center',
      includeFontPadding: false,
    }),
  },
  clearButton: {
    marginLeft: 8,
    // Android-specific: Ensure minimum touch target
    minWidth: ANDROID_CONSTANTS.touchTargetMinSize,
    minHeight: ANDROID_CONSTANTS.touchTargetMinSize,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterButton: {
    marginLeft: 8,
    // Android-specific: Ensure minimum touch target
    minWidth: ANDROID_CONSTANTS.touchTargetMinSize,
    minHeight: ANDROID_CONSTANTS.touchTargetMinSize,
    justifyContent: 'center',
    alignItems: 'center',
  },
  transactionsContainer: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  transactionItem: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    // Android-specific: Add elevation and optimize touch
    ...(isAndroid && {
      elevation: ANDROID_CONSTANTS.elevation.low,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.22,
      shadowRadius: 2.22,
    }),
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  transactionLeft: {
    flexDirection: 'row',
    flex: 1,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionReference: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  transactionCustomer: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 2,
  },
  transactionDate: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  transactionRight: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    minHeight: 60,
  },
  transactionAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  transactionTypeContainer: {
    alignItems: 'flex-end',
  },
  transactionType: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  transactionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  transactionBadgeText: {
    fontSize: 10,
    color: Colors.text,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  itemsPreview: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  itemsPreviewText: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  // Modal styles
  modal: {
    justifyContent: 'flex-end',
    margin: 0,
    padding: 0,
  },
  customBackdrop: {
    position: 'absolute',
    top: StatusBar.currentHeight ? -StatusBar.currentHeight : 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    zIndex: 0,
  },
  modalContent: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    zIndex: 1,
    position: 'relative',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  filterOptions: {
    marginTop: 20,
    marginBottom: 20,
    paddingHorizontal: 2,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: Colors.border,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkboxLabel: {
    fontSize: 16,
    color: Colors.text,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    // Android-specific: Ensure minimum touch target
    minHeight: ANDROID_CONSTANTS.touchTargetMinSize,
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  clearFiltersButton: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    // Android-specific: Ensure minimum touch target
    minHeight: ANDROID_CONSTANTS.touchTargetMinSize,
    justifyContent: 'center',
  },
  clearFiltersText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  applyFiltersButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    // Android-specific: Add elevation and ensure minimum touch target
    minHeight: ANDROID_CONSTANTS.touchTargetMinSize,
    justifyContent: 'center',
    ...(isAndroid && {
      elevation: ANDROID_CONSTANTS.elevation.medium,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
    }),
  },
  applyFiltersText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  actionIconsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
  },

  actionIcon: {
    padding: 8,
    marginLeft: 8,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    // Android-specific: Ensure minimum touch target
    minWidth: ANDROID_CONSTANTS.touchTargetMinSize,
    minHeight: ANDROID_CONSTANTS.touchTargetMinSize,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Customer styles
  customerItem: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    // Android-specific: Add elevation for Material Design
    ...(isAndroid && {
      elevation: ANDROID_CONSTANTS.elevation.low,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.22,
      shadowRadius: 2.22,
    }),
  },
  customerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  customerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
    flex: 1,
  },
  customerBalance: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  balanceContainer: {
    alignItems: 'flex-end',
  },
  transactionLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  partyInfo: {
    flex: 1,
  },
  partyType: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});
