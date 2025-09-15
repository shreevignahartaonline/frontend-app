import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { Colors } from '../constants/Colors';
import { Party, PartyApiService, SaleApiService } from '../utils/api';

interface SaleInvoice {
  id: string;
  invoiceNo: string;
  partyName: string;
  phoneNumber: string;
  items: SaleItem[];
  totalAmount: number;
  date: string;
  pdfUri?: string;
}

interface SaleItem {
  id: string;
  itemName: string;
  quantity: number;
  rate: number;
  total: number;
}

export default function EditInvoiceScreen() {
  const router = useRouter();
  const { invoiceId } = useLocalSearchParams<{ invoiceId: string }>();
  const [invoice, setInvoice] = useState<SaleInvoice | null>(null);
  const [customers, setCustomers] = useState<Party[]>([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [selectedCustomerBalance, setSelectedCustomerBalance] = useState<number | null>(null);
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<SaleItem | null>(null);
  
  // Form states
  const [formData, setFormData] = useState({
    partyName: '',
    phoneNumber: '',
  });

  const [itemForm, setItemForm] = useState({
    quantity: '',
    rate: '',
  });

  const [refreshing, setRefreshing] = useState(false);
  const [processingItems, setProcessingItems] = useState(false);

  useEffect(() => {
    if (invoiceId) {
      loadInvoice();
      loadCustomers();
    }
  }, [invoiceId]);

    // Additional check for incoming items when component mounts
    useEffect(() => {
      const checkForIncomingItems = async () => {
        try {
          // Note: Temporary item storage will be handled via navigation params in the future
          // For now, this functionality is disabled as we're moving away from AsyncStorage
        } catch (error) {
          console.error('useEffect error handling incoming items:', error);
        }
      };

    // Check after a short delay to ensure invoice is loaded
    const timer = setTimeout(() => {
      checkForIncomingItems();
    }, 500);

    return () => clearTimeout(timer);
  }, [invoice, invoiceId]);



  // Handle incoming selected items from add-items screen
  useFocusEffect(
    useCallback(() => {
      const handleIncomingItems = async () => {
        try {
          // Check for selected items from add-items screen
          const tempData = (global as any).tempSelectedItems;
          if (tempData && tempData.mode === 'sales' && tempData.items && tempData.items.length > 0) {
            // Check if this data is recent (within last 30 seconds) and matches current invoice
            const isRecent = Date.now() - tempData.timestamp < 30000;
            const isForThisInvoice = !tempData.editingInvoiceId || tempData.editingInvoiceId === invoiceId;
            
            if (isRecent && isForThisInvoice && invoice) {
              // Generate unique IDs for new items to prevent duplicate key issues
              const itemsWithUniqueIds = tempData.items.map((item: any) => ({
                ...item,
                id: `${item.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
              }));
              
              // Add the selected items to the current invoice
              const updatedInvoice = {
                ...invoice,
                items: [...invoice.items, ...itemsWithUniqueIds],
                totalAmount: invoice.items.reduce((sum, item) => sum + item.total, 0) + 
                           tempData.items.reduce((sum: number, item: any) => sum + item.total, 0)
              };
              setInvoice(updatedInvoice);
              
              // Clear the temporary data to prevent duplicate processing
              delete (global as any).tempSelectedItems;
            }
          }
        } catch (error) {
          console.error('Error handling incoming items:', error);
        }
      };

      handleIncomingItems();
    }, [invoice, invoiceId])
  );

  const loadInvoice = async () => {
    try {
      const foundInvoice = await SaleApiService.getSaleById(invoiceId);
      if (foundInvoice) {
        setInvoice(foundInvoice);
        setFormData({
          partyName: foundInvoice.partyName,
          phoneNumber: foundInvoice.phoneNumber,
        });
      } else {
        Alert.alert('Error', 'Invoice not found');
        router.back();
      }
    } catch (error) {
      console.error('Error loading invoice:', error);
      Alert.alert('Error', 'Failed to load invoice');
      router.back();
    }
  };

  const refreshInvoice = async () => {
    try {
      setRefreshing(true);
      const foundInvoice = await SaleApiService.getSaleById(invoiceId);
      if (foundInvoice) {
        setInvoice(foundInvoice);
      }
      
      // Also check for incoming items
      // Note: Temporary item storage will be handled via navigation params in the future
    } catch (error) {
      console.error('Error refreshing invoice:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const loadCustomers = async () => {
    try {
      const customersData = await PartyApiService.getParties();
      setCustomers(customersData);
    } catch (error) {
      console.error('Error loading customers:', error);
    }
  };

  const handleSaveInvoice = async () => {
    if (!invoice || !formData.partyName || !formData.phoneNumber) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }

    if (invoice.items.length === 0) {
      Alert.alert('Error', 'Please add at least one item');
      return;
    }

    // Calculate total amount from current items
    const totalAmount = invoice.items.reduce((sum, item) => sum + (item.total || 0), 0);

    const updatedInvoice: SaleInvoice = {
      ...invoice,
      partyName: formData.partyName,
      phoneNumber: formData.phoneNumber,
      totalAmount: totalAmount,
    };

    try {
      // Generate new PDF with updated invoice data
      const { BasePdfGenerator } = await import('../utils/basePdfGenerator');
      const pdfUri = await BasePdfGenerator.generateInvoicePDF(updatedInvoice);
      if (pdfUri) {
        updatedInvoice.pdfUri = pdfUri;
      }

      // Update invoice using API
      await SaleApiService.updateSale(invoiceId, {
        partyName: updatedInvoice.partyName,
        phoneNumber: updatedInvoice.phoneNumber,
        items: updatedInvoice.items,
        date: updatedInvoice.date,
        pdfUri: updatedInvoice.pdfUri
      });
      
      Alert.alert('Success', 'Invoice updated successfully!');
      router.back();
    } catch (error) {
      console.error('Error updating invoice:', error);
      Alert.alert('Error', 'Failed to update invoice');
    }
  };

  const addItem = () => {
    // Navigate to add-items screen with sales mode
    // Note: Mode will be passed via navigation params instead of storage
    router.push('/add-items?mode=sales&editingInvoiceId=' + invoiceId);
  };

  const editItem = (item: SaleItem) => {
    setEditingItem(item);
    setItemForm({
      quantity: item.quantity.toString(),
      rate: item.rate.toString(),
    });
    setShowItemModal(true);
  };

  const updateItem = () => {
    if (!editingItem || !itemForm.quantity || !itemForm.rate) {
      Alert.alert('Error', 'Please fill all item fields');
      return;
    }

    const quantity = parseFloat(itemForm.quantity);
    const rate = parseFloat(itemForm.rate);
    const total = quantity * rate;

    const updatedItem: SaleItem = {
      ...editingItem,
      quantity,
      rate,
      total,
    };

    if (invoice) {
      setInvoice({
        ...invoice,
        items: invoice.items.map(item => 
          item.id === editingItem.id ? updatedItem : item
        ),
      });
    }

    setItemForm({ quantity: '', rate: '' });
    setEditingItem(null);
    setShowItemModal(false);
  };

  const deleteItem = (itemId: string) => {
    if (invoice) {
      setInvoice({
        ...invoice,
        items: invoice.items.filter(item => item.id !== itemId),
      });
    }
  };



  const renderItem = ({ item }: { item: SaleItem }) => (
    <View style={styles.itemCard}>
      <View style={styles.itemHeader}>
        <Text style={styles.itemName}>{item.itemName}</Text>
        <View style={styles.itemActions}>
          <TouchableOpacity onPress={() => editItem(item)} style={styles.actionButton}>
            <Ionicons name="pencil" size={16} color={Colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => deleteItem(item.id)} style={styles.actionButton}>
            <Ionicons name="trash" size={16} color={Colors.error} />
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.itemDetails}>
        <Text style={styles.itemDetail}>Qty: {item.quantity}</Text>
        <Text style={styles.itemDetail}>Rate: ₹{item.rate}</Text>
        <Text style={styles.itemAmount}>₹{(item.total || 0).toLocaleString()}</Text>
      </View>
    </View>
  );

  const renderItemModal = () => (
    <Modal
      visible={showItemModal}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <KeyboardAvoidingView 
        style={styles.modalContainer} 
        behavior="padding"
        keyboardVerticalOffset={100}
      >
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>
            Edit Item
          </Text>
          <TouchableOpacity onPress={() => {
            setShowItemModal(false);
            setEditingItem(null);
            setItemForm({ quantity: '', rate: '' });
          }}>
            <Ionicons name="close" size={24} color={Colors.text} />
          </TouchableOpacity>
        </View>
        
        <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
          <View style={styles.formSection}>
            <Text style={styles.fieldLabel}>Item Name</Text>
            <Text style={styles.itemNameDisplay}>{editingItem?.itemName}</Text>
            
            <Text style={styles.fieldLabel}>Quantity *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter quantity..."
              placeholderTextColor={Colors.textTertiary}
              value={itemForm.quantity}
              onChangeText={(text) => setItemForm(prev => ({ ...prev, quantity: text }))}
              keyboardType="numeric"
            />
            
            <Text style={styles.fieldLabel}>Rate *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter rate..."
              placeholderTextColor={Colors.textTertiary}
              value={itemForm.rate}
              onChangeText={(text) => setItemForm(prev => ({ ...prev, rate: text }))}
              keyboardType="numeric"
            />
          </View>
        </ScrollView>
        
        <View style={styles.modalFooter}>
          <TouchableOpacity 
            style={styles.cancelButton} 
            onPress={() => {
              setShowItemModal(false);
              setEditingItem(null);
              setItemForm({ quantity: '', rate: '' });
            }}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.createButton} 
            onPress={updateItem}
          >
            <Text style={styles.createButtonText}>
              Update Item
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  if (!invoice) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Invoice</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  const totalAmount = invoice.items.reduce((sum, item) => sum + (item.total || 0), 0);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Invoice #{invoice.invoiceNo}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={refreshInvoice} style={styles.refreshButton}>
            <Ionicons name="refresh" size={20} color={Colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSaveInvoice} style={styles.saveButton}>
            <Ionicons name="checkmark" size={24} color={Colors.success} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
      >
        {/* Invoice Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Invoice Details</Text>
          <View style={styles.invoiceInfo}>
            <Text style={styles.invoiceNumber}>#{invoice.invoiceNo}</Text>
          </View>
          <Text style={styles.invoiceDate}>Date: {invoice.date}</Text>
        </View>

        {/* Customer Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer Information</Text>
          
          <Text style={styles.fieldLabel}>Customer Name *</Text>
          <View style={styles.customerInputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Enter customer name..."
              placeholderTextColor={Colors.textTertiary}
              value={formData.partyName}
              onChangeText={(text) => {
                setFormData(prev => ({ ...prev, partyName: text }));
                setShowCustomerDropdown(true);
              }}
              onFocus={() => setShowCustomerDropdown(true)}
            />
            {showCustomerDropdown && formData.partyName.length > 0 && (() => {
              const matchingCustomers = customers.filter(customer => 
                customer.name.toLowerCase().includes(formData.partyName.toLowerCase())
              );
              
              if (matchingCustomers.length === 0) {
                return null;
              }
              
              return (
                <View style={styles.customerSuggestions}>
                  {matchingCustomers.slice(0, 3).map((customer) => (
                    <TouchableOpacity
                      key={customer.id}
                      style={styles.suggestionItem}
                      onPress={() => {
                        setFormData(prev => ({
                          ...prev,
                          partyName: customer.name,
                          phoneNumber: customer.phoneNumber,
                        }));
                        setSelectedCustomerBalance(customer.balance);
                        setShowCustomerDropdown(false);
                      }}
                    >
                      <Text style={styles.suggestionName}>{customer.name}</Text>
                      <Text style={[
                        styles.suggestionAmount,
                        { color: customer.balance <= 0 ? Colors.success : Colors.error }
                      ]}>
                        ₹{customer.balance.toLocaleString()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              );
            })()}
          </View>
          
          <Text style={styles.fieldLabel}>Phone Number *</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter phone number..."
            placeholderTextColor={Colors.textTertiary}
            value={formData.phoneNumber}
            onChangeText={(text) => setFormData(prev => ({ ...prev, phoneNumber: text }))}
            keyboardType="phone-pad"
          />
        </View>

        {/* Items Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Items</Text>
            <TouchableOpacity 
              style={styles.addButton} 
              onPress={addItem}
            >
              <Ionicons name="add" size={20} color={Colors.text} />
              <Text style={styles.addButtonText}>Add Item</Text>
            </TouchableOpacity>
          </View>
          
          {invoice.items.length > 0 ? (
            <FlatList
              data={invoice.items}
              renderItem={renderItem}
              keyExtractor={(item) => `edit-invoice-${item.id}`}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
            />
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={48} color={Colors.textTertiary} />
              <Text style={styles.emptyStateText}>No items added yet</Text>
            </View>
          )}
        </View>

        {/* Total */}
        <View style={styles.totalSection}>
          <Text style={styles.totalLabel}>Total Amount</Text>
          <Text style={styles.totalAmount}>₹{(totalAmount || 0).toLocaleString()}</Text>
        </View>
      </ScrollView>

      {showItemModal && renderItemModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
  },
  saveButton: {
    padding: 8,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  refreshButton: {
    padding: 8,
  },
  headerSpacer: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  invoiceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  invoiceNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
  },

  invoiceDate: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  customerInputContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: Colors.text,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
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
    maxHeight: 150,
  },
  suggestionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  suggestionName: {
    fontSize: 16,
    color: Colors.text,
    flex: 1,
  },
  suggestionAmount: {
    fontSize: 14,
    fontWeight: '600',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  addButtonText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
  itemCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    flex: 1,
  },
  itemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 4,
  },
  itemDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemDetail: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  itemAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 8,
  },
  totalSection: {
    padding: 20,
    backgroundColor: Colors.surface,
    margin: 20,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  formSection: {
    marginBottom: 20,
  },
  itemNameDisplay: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: Colors.textSecondary,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    fontStyle: 'italic',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  createButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
});
