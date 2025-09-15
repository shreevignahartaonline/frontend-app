import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import Modal from 'react-native-modal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { Party, PartyApiService, SaleApiService } from '../../utils/api';
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

interface SaleInvoice {
  id: string;
  invoiceNo: string;
  partyName: string;
  phoneNumber: string;
  items: SaleItem[];
  totalAmount: number;
  date: string;
  pdfUri?: string; // Store the generated PDF URI
}

interface SaleItem {
  id: string;
  itemName: string;
  quantity: number;
  rate: number;
  total: number;
}

export default function SalesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [saleInvoices, setSaleInvoices] = useState<SaleInvoice[]>([]);
  const [customers, setCustomers] = useState<Party[]>([]);
  
  // Modal states
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  
  // Invoice form states
  const [invoiceForm, setInvoiceForm] = useState({
    partyName: '',
    phoneNumber: '',
    items: [] as SaleItem[],
  });

  // Dropdown visibility state
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  
  // Auto-generated invoice number
  const [generatedInvoiceNo, setGeneratedInvoiceNo] = useState<string>('');
  
  // Selected customer balance state
  const [selectedCustomerBalance, setSelectedCustomerBalance] = useState<number | null>(null);
  
  // Customer balances state for dropdown suggestions
  const [customerBalances, setCustomerBalances] = useState<Record<string, number>>({});

  useEffect(() => {
    loadSalesData();
    loadCustomers();
  }, []);

  // Generate invoice number when sales data changes
  useEffect(() => {
    setGeneratedInvoiceNo(generateNextInvoiceNumber());
  }, [saleInvoices]);

  // Reload customers when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadCustomers();
    }, [])
  );

  // Handle incoming selected items from add-items screen
  useFocusEffect(
    useCallback(() => {
      const handleIncomingItems = async () => {
        try {
          // Check for selected items from add-items screen
          const tempData = (global as any).tempSelectedItems;
          if (tempData && tempData.mode === 'sales' && tempData.items && tempData.items.length > 0) {
            // Check if this data is recent (within last 30 seconds)
            const isRecent = Date.now() - tempData.timestamp < 30000;
            if (isRecent) {
              // Add the selected items to the current invoice form
              setInvoiceForm(prev => ({
                ...prev,
                items: [...prev.items, ...tempData.items]
              }));
              
              // Recalculate total
              const newTotal = invoiceForm.items.reduce((sum: number, item: SaleItem) => sum + item.total, 0) + 
                             tempData.items.reduce((sum: number, item: any) => sum + item.total, 0);
              setInvoiceForm(prev => ({ ...prev, totalAmount: newTotal }));
              
              // Reopen the modal since it was closed when navigating to add-items
              setShowInvoiceModal(true);
              
              // Clear the temporary data to prevent duplicate processing
              delete (global as any).tempSelectedItems;
            }
          }
        } catch (error) {
          console.error('Error handling incoming items:', error);
        }
      };

      handleIncomingItems();
    }, [])
  );

  const loadSalesData = async () => {
    try {
      const invoicesData = await SaleApiService.getSales();
      setSaleInvoices(invoicesData);
    } catch (error) {
      console.error('Error loading sales data:', error);
    }
  };



  const loadCustomers = async () => {
    try {
      const customersData = await PartyApiService.getParties();
      setCustomers(customersData);
      
      // Calculate latest balances for all customers
      await calculateCustomerBalances(customersData);
    } catch (error) {
      console.error('Error loading customers:', error);
    }
  };

  // Calculate latest party balance for each customer
  const calculateCustomerBalances = async (customersData: Party[]) => {
    try {
      const balances: Record<string, number> = {};
      
      // Calculate balance for each customer
      for (const customer of customersData) {
        const balance = await PartyManager.getPartyBalance(customer.name, customer.phoneNumber);
        const customerKey = `${customer.name}-${customer.phoneNumber}`;
        balances[customerKey] = balance;
      }
      
      setCustomerBalances(balances);
    } catch (error) {
      console.error('Error calculating customer balances:', error);
    }
  };

  // Helper function to get balance color and text
  const getBalanceDisplay = (balance: number) => {
    if (balance === 0) {
      return {
        color: Colors.textSecondary,
        text: 'Settled',
        showAmount: false
      };
    } else if (balance > 0) {
      return {
        color: Colors.success, // Green for positive balance
        text: `₹${balance.toLocaleString()}`,
        showAmount: true
      };
    } else {
      return {
        color: Colors.error, // Red for negative balance
        text: `₹${Math.abs(balance).toLocaleString()}`,
        showAmount: true
      };
    }
  };

  // Generate next invoice number
  const generateNextInvoiceNumber = () => {
    if (saleInvoices.length === 0) {
      return '1';
    }
    
    // Find the highest invoice number
    const invoiceNumbers = saleInvoices
      .map(invoice => {
        const num = parseInt(invoice.invoiceNo);
        return isNaN(num) ? 0 : num;
      })
      .sort((a, b) => b - a);
    
    const nextNumber = (invoiceNumbers[0] || 0) + 1;
    return nextNumber.toString();
  };

  // Reset form function
  const resetForm = () => {
    setInvoiceForm({
      partyName: '',
      phoneNumber: '',
      items: [],
    });
    setShowCustomerDropdown(false);
    setSelectedCustomerBalance(null);
    setShowInvoiceModal(false);
  };



  const updateInvoiceItem = (index: number, field: keyof SaleItem, value: any) => {
    const updatedItems = [...invoiceForm.items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    
    // Calculate total for this item
    if (field === 'quantity' || field === 'rate') {
      updatedItems[index].total = updatedItems[index].quantity * updatedItems[index].rate;
    }
    
    setInvoiceForm(prev => ({
      ...prev,
      items: updatedItems,
    }));
  };

  const removeInvoiceItem = (index: number) => {
    setInvoiceForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const calculateInvoiceTotal = () => {
    return invoiceForm.items.reduce((sum: number, item: SaleItem) => sum + item.total, 0);
  };

  const handleCreateInvoice = async () => {
    if (!invoiceForm.partyName || !invoiceForm.phoneNumber) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }

    if (invoiceForm.items.length === 0) {
      Alert.alert('Error', 'Please add at least one item');
      return;
    }

    // Check if this is an existing customer and get their latest balance
    const existingCustomer = customers.find(customer => 
      customer.name.toLowerCase() === invoiceForm.partyName.toLowerCase() &&
      customer.phoneNumber === invoiceForm.phoneNumber
    );

    if (existingCustomer) {
      const customerKey = `${existingCustomer.name}-${existingCustomer.phoneNumber}`;
      const latestBalance = customerBalances[customerKey] ?? existingCustomer.balance;
      
      if (latestBalance > 0) {
        Alert.alert(
          'Customer Has Outstanding Balance',
          `${invoiceForm.partyName} has an outstanding balance of ₹${latestBalance.toLocaleString()}. Do you want to proceed with creating this invoice?`,
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Proceed',
              onPress: () => createInvoice(),
            },
          ]
        );
        return;
      }
    }

    // If no outstanding balance or new customer, proceed directly
    createInvoice();
  };

  const createInvoice = async () => {
    const newInvoice: SaleInvoice = {
      id: Date.now().toString(),
      invoiceNo: generatedInvoiceNo,
        partyName: invoiceForm.partyName,
      phoneNumber: invoiceForm.phoneNumber,
      items: invoiceForm.items,
      totalAmount: calculateInvoiceTotal(),
      date: new Date().toLocaleDateString(),
    };

    // Generate PDF in the background
    let pdfUri: string | undefined;
    try {
      const generatedPdfUri = await BasePdfGenerator.generateInvoicePDF(newInvoice);
      if (generatedPdfUri) {
        pdfUri = generatedPdfUri;
        newInvoice.pdfUri = pdfUri;
        
        // Add a small delay to ensure file is fully written
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        console.error('PDF generation returned null');
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      // Continue with invoice creation even if PDF generation fails
    }

    // Create invoice using API
    try {
      const createdInvoice = await SaleApiService.createSale({
        partyName: newInvoice.partyName,
        phoneNumber: newInvoice.phoneNumber,
        items: newInvoice.items,
        totalAmount: newInvoice.totalAmount,
        date: newInvoice.date,
        pdfUri: pdfUri
      });
      
      // Send invoice via WhatsApp if PDF was generated successfully
      if (pdfUri && invoiceForm.phoneNumber) {
        try {
          const whatsappResult = await DocumentService.sendInvoiceViaWhatsApp(
            invoiceForm.phoneNumber,
            pdfUri,
            generatedInvoiceNo,
            invoiceForm.partyName,
            calculateInvoiceTotal()
          );

          if (whatsappResult.success) {
            console.log('Invoice sent via WhatsApp successfully:', whatsappResult.messageId);
          } else {
            console.warn('Failed to send invoice via WhatsApp:', whatsappResult.error);
          }
        } catch (whatsappError) {
          console.error('Error sending invoice via WhatsApp:', whatsappError);
          // Don't show error to user as invoice creation was successful
        }
      }
      
      // Update local state
      setSaleInvoices(prev => [...prev, createdInvoice]);
      
      // Reset form
      resetForm();
      
      Alert.alert('Success', 'Invoice created successfully!');
    } catch (error) {
      console.error('Error creating invoice:', error);
      Alert.alert('Error', 'Failed to create invoice. Please try again.');
    }
  };


  const renderInvoiceItem = ({ item, index }: { item: SaleItem; index: number }) => {
    return (
      <View style={styles.invoiceItemContainer}>
        <View style={styles.invoiceItemRow}>
          <View style={styles.itemNameContainer}>
            <Text style={styles.fieldLabel}>Item Name</Text>
            <TextInput
              style={[styles.input, styles.readOnlyInput]}
              placeholder="Item name..."
              placeholderTextColor={Colors.textTertiary}
              value={item.itemName}
              editable={false}
              selectTextOnFocus={false}
            />
          </View>
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => removeInvoiceItem(index)}
            activeOpacity={isAndroid ? 0.7 : 0.2}
            {...(isAndroid && {
              android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
            })}
          >
            <Ionicons name="close-circle" size={20} color={Colors.error} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.invoiceItemDetails}>
          <View style={styles.quantityContainer}>
            <Text style={styles.fieldLabel}>Quantity</Text>
            <TextInput
              style={[styles.input, styles.quantityInput]}
              placeholder="Qty"
              placeholderTextColor={Colors.textTertiary}
              value={item.quantity.toString()}
              onChangeText={(text) => {
                const qty = parseInt(text) || 0;
                updateInvoiceItem(index, 'quantity', qty);
              }}
              keyboardType="numeric"
            />
          </View>
          
          <View style={styles.priceContainer}>
            <Text style={styles.fieldLabel}>Price</Text>
            <TextInput
              style={[styles.input, styles.priceInput]}
              placeholder="Price"
              placeholderTextColor={Colors.textTertiary}
              value={item.rate.toString()}
              onChangeText={(text) => updateInvoiceItem(index, 'rate', parseFloat(text) || 0)}
              keyboardType="numeric"
            />
          </View>
          
          <View style={styles.totalContainer}>
            <Text style={styles.fieldLabel}>Total</Text>
            <Text style={styles.totalText}>₹{item.total}</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderInvoiceModal = () => (
    <Modal
      isVisible={showInvoiceModal}
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
      <TouchableWithoutFeedback onPress={resetForm}>
        <View style={styles.customBackdrop} />
      </TouchableWithoutFeedback>

      <View style={[styles.modalContent, { 
        paddingTop: 15,
        paddingBottom: Math.max(insets.bottom, 10),
        height: height - insets.top - insets.bottom
      }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Sale Invoice</Text>
            <TouchableOpacity 
              onPress={resetForm}
              activeOpacity={isAndroid ? 0.7 : 0.2}
              {...(isAndroid && {
                android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
              })}
            >
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>
          
          <KeyboardAvoidingView 
            style={styles.keyboardAvoidingContent} 
            behavior="padding"
            keyboardVerticalOffset={0}
          >
            <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
          <View style={styles.formSection}>
            <View style={styles.invoiceBalanceRow}>
              <View style={styles.invoiceNumberLeft}>
                <Text style={styles.invoiceNumberLabel}>Invoice No:</Text>
                <Text style={styles.invoiceNumberValue}>#{generatedInvoiceNo}</Text>
              </View>
              {selectedCustomerBalance !== null && (
                <View key="customer-balance" style={styles.balanceDisplayWithSpacing}>
                  <Text style={styles.balanceLabel}>Balance Amount:</Text>
                  <Text style={[
                    styles.balanceAmount,
                    { color: getBalanceDisplay(selectedCustomerBalance).color }
                  ]}>
                    {getBalanceDisplay(selectedCustomerBalance).text}
                  </Text>
                </View>
              )}
            </View>
            
            <View style={styles.customerInputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Customer Name"
                placeholderTextColor={Colors.textTertiary}
                value={invoiceForm.partyName}
                onChangeText={(text) => {
                  setInvoiceForm(prev => ({ ...prev, partyName: text }));
                  setShowCustomerDropdown(true);
                }}
                onFocus={() => setShowCustomerDropdown(true)}
              />
              {showCustomerDropdown && invoiceForm.partyName.length > 0 && (() => {
                const matchingCustomers = customers.filter(customer => 
                  customer.name.toLowerCase().includes(invoiceForm.partyName.toLowerCase())
                );
                
                if (matchingCustomers.length === 0) {
                  return null; // Don't show dropdown if no matches
                }
                
                return (
                  <View key="customer-suggestions" style={styles.customerSuggestions}>
                    {matchingCustomers.length > 3 ? (
                      <ScrollView 
                        style={styles.suggestionsScrollView}
                        showsVerticalScrollIndicator={true}
                        nestedScrollEnabled={true}
                      >
                        {matchingCustomers.map((customer, index) => (
                      <TouchableOpacity
                        key={customer.id || `sales-customer-${index}`}
                        style={styles.suggestionItem}
                        onPress={() => {
                          const customerKey = `${customer.name}-${customer.phoneNumber}`;
                          const latestBalance = customerBalances[customerKey] ?? customer.balance;
                          
                          setInvoiceForm(prev => ({
                            ...prev,
                            partyName: customer.name,
                            phoneNumber: customer.phoneNumber,
                          }));
                          setSelectedCustomerBalance(latestBalance);
                          setShowCustomerDropdown(false);
                        }}
                        activeOpacity={isAndroid ? 0.7 : 0.2}
                        {...(isAndroid && {
                          android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
                        })}
                      >
                        <Text style={styles.suggestionName}>{customer.name}</Text>
                        <Text style={[
                          styles.suggestionAmount,
                          { color: getBalanceDisplay(customerBalances[`${customer.name}-${customer.phoneNumber}`] ?? customer.balance).color }
                        ]}>
                          {getBalanceDisplay(customerBalances[`${customer.name}-${customer.phoneNumber}`] ?? customer.balance).text}
                        </Text>
                      </TouchableOpacity>
                    ))}
                      </ScrollView>
                    ) : (
                      // Show first 3 customers without scroll when 3 or fewer
                      matchingCustomers.slice(0, 3).map((customer, index) => (
                        <TouchableOpacity
                          key={customer.id || `sales-customer-short-${index}`}
                          style={styles.suggestionItem}
                          onPress={() => {
                            const customerKey = `${customer.name}-${customer.phoneNumber}`;
                            const latestBalance = customerBalances[customerKey] ?? customer.balance;
                            
                            setInvoiceForm(prev => ({
                              ...prev,
                              partyName: customer.name,
                              phoneNumber: customer.phoneNumber,
                            }));
                            setSelectedCustomerBalance(latestBalance);
                            setShowCustomerDropdown(false);
                          }}
                          activeOpacity={isAndroid ? 0.7 : 0.2}
                          {...(isAndroid && {
                            android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
                          })}
                        >
                          <Text style={styles.suggestionName}>{customer.name}</Text>
                          <Text style={[
                            styles.suggestionAmount,
                            { color: getBalanceDisplay(customerBalances[`${customer.name}-${customer.phoneNumber}`] ?? customer.balance).color }
                          ]}>
                            {getBalanceDisplay(customerBalances[`${customer.name}-${customer.phoneNumber}`] ?? customer.balance).text}
                          </Text>
                        </TouchableOpacity>
                      ))
                    )}
                  </View>
                );
              })()}
            </View>
            <TextInput
              style={styles.phoneInput}
              placeholder="Phone Number"
              placeholderTextColor={Colors.textTertiary}
              value={invoiceForm.phoneNumber}
              onChangeText={(text) => setInvoiceForm(prev => ({ ...prev, phoneNumber: text }))}
              keyboardType="phone-pad"
            />
          </View>
          
          <View style={styles.formSection}>
            <TouchableOpacity 
              style={styles.fullWidthAddItemsButton} 
              onPress={() => {
                setShowInvoiceModal(false);
                // Navigate to add-items screen with sales mode
                // Note: Mode will be passed via navigation params instead of storage
                setTimeout(() => {
                  router.push('/add-items?mode=sales');
                }, 100);
              }}
              activeOpacity={isAndroid ? 0.7 : 0.2}
              {...(isAndroid && {
                android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
              })}
            >
              <Ionicons name="add" size={20} color={Colors.text} />
              <Text style={styles.fullWidthAddItemsButtonText}>Add Items</Text>
            </TouchableOpacity>
            
            <FlatList
              data={invoiceForm.items}
              renderItem={renderInvoiceItem}
              keyExtractor={(item, index) => item.id || `invoice-item-${index}`}
              scrollEnabled={false}
            />
            
            {invoiceForm.items.length > 0 && (
              <View style={styles.totalSection}>
                <Text style={styles.totalLabel}>Total Amount:</Text>
                <Text style={styles.totalAmount}>₹{calculateInvoiceTotal()}</Text>
              </View>
            )}
          </View>
        </ScrollView>
          </KeyboardAvoidingView>
          
          <View style={styles.modalFooter}>
            <TouchableOpacity 
              style={styles.cancelButton} 
              onPress={resetForm}
              activeOpacity={isAndroid ? 0.7 : 0.2}
              {...(isAndroid && {
                android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
              })}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.createButton} 
              onPress={handleCreateInvoice}
              activeOpacity={isAndroid ? 0.7 : 0.2}
              {...(isAndroid && {
                android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
              })}
            >
              <Text style={styles.createButtonText}>Create Invoice</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );





  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        // Android-specific: Optimize scrolling
        {...(isAndroid && {
          overScrollMode: 'never',
          nestedScrollEnabled: true,
        })}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.companyName}>Sales</Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
                  <TouchableOpacity 
          style={styles.primaryButton} 
          onPress={() => setShowInvoiceModal(true)}
          activeOpacity={isAndroid ? 0.7 : 0.2}
          {...(isAndroid && {
            android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
          })}
        >
          <Ionicons name="add" size={20} color={Colors.text} />
          <Text style={styles.primaryButtonText}>New Invoice</Text>
        </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.primaryButton, { backgroundColor: Colors.success }]} 
            onPress={() => router.push('/payment-in')}
            activeOpacity={isAndroid ? 0.7 : 0.2}
            {...(isAndroid && {
              android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
            })}
          >
            <Ionicons name="arrow-down-circle" size={20} color={Colors.text} />
            <Text style={styles.primaryButtonText}>Payment In</Text>
          </TouchableOpacity>
        </View>

        {/* Invoices List */}
          <View style={styles.listContainer}>
            <Text style={styles.sectionTitle}>Recent Invoices</Text>
            {saleInvoices.length > 0 ? (
              saleInvoices.slice(0, 10).map((invoice, index) => (
                <TouchableOpacity 
                  key={invoice.id || `sale-invoice-${index}`} 
                  style={styles.listItem}
                  onPress={() => router.push(`/edit-invoice?invoiceId=${invoice.id}`)}
                  activeOpacity={isAndroid ? 0.7 : 0.2}
                  {...(isAndroid && {
                    android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
                  })}
                >
                  <View style={styles.listItemHeader}>
                    <Text style={styles.listItemTitle}>#{invoice.invoiceNo}</Text>
                    <Text style={styles.listItemAmount}>₹{invoice.totalAmount}</Text>
                  </View>
                  <Text style={styles.listItemSubtitle}>{invoice.partyName}</Text>
                  <Text style={styles.listItemDate}>{invoice.date}</Text>
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="receipt-outline" size={64} color={Colors.textTertiary} />
                <Text style={styles.emptyStateTitle}>No Invoices Yet</Text>
                <Text style={styles.emptyStateSubtitle}>
                  Create your first sale invoice to get started
                </Text>
              </View>
            )}
          </View>
      </ScrollView>

      {renderInvoiceModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
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
  },

  companyName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
  },
  headerStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 20,
    gap: 12,
  },
  statCard: {
    width: '48%',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
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
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 24,
    gap: 12,
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 12,
    padding: 16,
    gap: 8,
    // Android-specific: Add elevation and ensure minimum touch target
    ...(isAndroid && {
      elevation: ANDROID_CONSTANTS.elevation.medium,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      minHeight: ANDROID_CONSTANTS.touchTargetMinSize,
    }),
  },
  primaryButtonText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  listContainer: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 16,
  },
  listItem: {
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
  listItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  listItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  listItemAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.success,
  },
  listItemSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  listItemDate: {
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
  keyboardAvoidingContent: {
    flex: 1,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  formSection: {
    marginBottom: 20,
    paddingHorizontal: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  fullWidthAddItemsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 16,
    marginTop: 4,
    // Android-specific: Add elevation and ensure minimum touch target
    ...(isAndroid && {
      elevation: ANDROID_CONSTANTS.elevation.medium,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      minHeight: ANDROID_CONSTANTS.touchTargetMinSize,
    }),
  },
  fullWidthAddItemsButtonText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },

  input: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 12,
    color: Colors.text,
    fontSize: 16,
    // Android-specific: Optimize text input
    ...(isAndroid && {
      textAlignVertical: 'center',
      includeFontPadding: false,
      elevation: ANDROID_CONSTANTS.elevation.low,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.22,
      shadowRadius: 2.22,
    }),
  },
  readOnlyInput: {
    backgroundColor: Colors.background,
    color: Colors.textSecondary,
    opacity: 0.8,
  },
  phoneInput: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 8,
    color: Colors.text,
    fontSize: 16,
    // Android-specific: Optimize text input
    ...(isAndroid && {
      textAlignVertical: 'center',
      includeFontPadding: false,
      elevation: ANDROID_CONSTANTS.elevation.low,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.22,
      shadowRadius: 2.22,
    }),
  },
  invoiceItemContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  invoiceItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },

  removeButton: {
    padding: 4,
    // Android-specific: Ensure minimum touch target
    minWidth: ANDROID_CONSTANTS.touchTargetMinSize,
    minHeight: ANDROID_CONSTANTS.touchTargetMinSize,
    justifyContent: 'center',
    alignItems: 'center',
  },
  invoiceItemDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quantityInput: {
    flex: 1,
    marginBottom: 0,
  },
  unitInput: {
    flex: 1,
    marginBottom: 0,
  },
  rateInput: {
    flex: 1,
    marginBottom: 0,
  },
  totalContainer: {
    flex: 1,
    alignItems: 'flex-end',
  },
  totalText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  totalSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.success,
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
  createButton: {
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
  createButtonText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },


  // New styles for refined item layout
  quantityContainer: {
    flex: 1,
    marginRight: 8,
  },
  priceContainer: {
    flex: 1,
    marginRight: 8,
  },
  fieldLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 4,
    fontWeight: '500',
  },
  priceInput: {
    marginBottom: 0,
  },
  itemNameContainer: {
    flex: 1,
    marginRight: 8,
  },

  // Customer suggestions styles
  customerInputContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  customerSuggestions: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    zIndex: 1000,
    maxHeight: 250,
    // Android-specific: Enhanced elevation for dropdown
    ...(isAndroid && {
      elevation: ANDROID_CONSTANTS.elevation.high,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 6,
    }),
  },
  suggestionsScrollView: {
    maxHeight: 144, // Height for exactly 3 items (48px each)
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    // Android-specific: Ensure minimum touch target
    minHeight: ANDROID_CONSTANTS.touchTargetMinSize,
  },
  suggestionName: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
    flex: 1,
  },
  suggestionAmount: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Balance display styles
  invoiceBalanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 20,
    marginBottom: 16,
    paddingHorizontal: 2,
  },
  invoiceNumberLeft: {
    alignItems: 'flex-start',
  },
  invoiceNumberLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 2,
    fontWeight: '500',
  },
  invoiceNumberValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  balanceDisplayWithSpacing: {
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  balanceLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 2,
    fontWeight: '500',
  },
  balanceAmount: {
    fontSize: 16,
    fontWeight: 'bold',
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
});
