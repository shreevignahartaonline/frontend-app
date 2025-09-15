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
    View,
} from 'react-native';
import { Colors } from '../constants/Colors';
import { PurchaseApiService, PurchaseBill, PurchaseItem } from '../utils/api';

// PurchaseBill and PurchaseItem interfaces are now imported from api.ts

export default function EditPurchaseScreen() {
  const router = useRouter();
  const { billId } = useLocalSearchParams<{ billId: string }>();
  const [bill, setBill] = useState<PurchaseBill | null>(null);
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<PurchaseItem | null>(null);
  
  // Form states
  const [formData, setFormData] = useState({
    billNo: '',
    partyName: '',
    phoneNumber: '',
    date: '',
  });

  const [itemForm, setItemForm] = useState({
    quantity: '',
    rate: '',
  });

  useEffect(() => {
    if (billId) {
      loadBill();
    }
  }, [billId]);

  // Handle incoming selected items from add-items screen
  useFocusEffect(
    useCallback(() => {
      const handleIncomingItems = async () => {
        try {
          // Check for selected items from add-items screen
          const tempData = (global as any).tempSelectedItems;
          if (tempData && tempData.mode === 'purchase' && tempData.items && tempData.items.length > 0) {
            // Check if this data is recent (within last 30 seconds)
            const isRecent = Date.now() - tempData.timestamp < 30000;
            
            if (isRecent && bill) {
              // Add the selected items to the current bill
              const updatedBill = {
                ...bill,
                items: [...bill.items, ...tempData.items],
                totalAmount: bill.items.reduce((sum, item) => sum + item.total, 0) + 
                           tempData.items.reduce((sum: number, item: any) => sum + item.total, 0)
              };
              setBill(updatedBill);
              
              // Clear the temporary data to prevent duplicate processing
              delete (global as any).tempSelectedItems;
            }
          }
        } catch (error) {
          console.error('Error handling incoming items:', error);
        }
      };

      handleIncomingItems();
    }, [bill])
  );

  const loadBill = async () => {
    try {
      const foundBill = await PurchaseApiService.getPurchaseById(billId!);
      
      if (foundBill) {
        setBill(foundBill);
        setFormData({
          billNo: foundBill.billNo,
          partyName: foundBill.partyName,
          phoneNumber: foundBill.phoneNumber,
          date: foundBill.date,
        });
      } else {
        Alert.alert('Error', 'Purchase bill not found');
        router.back();
      }
    } catch (error) {
      console.error('Error loading bill:', error);
      Alert.alert('Error', 'Failed to load purchase bill');
    }
  };

  const handleSaveBill = async () => {
    if (!bill || !formData.partyName || !formData.phoneNumber || !formData.billNo) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }

    if (bill.items.length === 0) {
      Alert.alert('Error', 'Please add at least one item');
      return;
    }

    try {
      // Update the bill via API
      const updatedBill = await PurchaseApiService.updatePurchase(bill.id, {
        partyName: formData.partyName,
        phoneNumber: formData.phoneNumber,
        date: formData.date,
        items: bill.items,
        totalAmount: bill.items.reduce((sum, item) => sum + item.total, 0),
      });

      // Generate new PDF with updated purchase bill data
      const { BasePdfGenerator } = await import('../utils/basePdfGenerator');
      const pdfUri = await BasePdfGenerator.generatePurchaseBillPDF(updatedBill);
      if (pdfUri) {
        await PurchaseApiService.updatePurchase(bill.id, { pdfUri });
      }

      Alert.alert('Success', 'Purchase bill updated successfully!');
      router.back();
    } catch (error) {
      console.error('Error updating bill:', error);
      Alert.alert('Error', 'Failed to update purchase bill');
    }
  };

  const addItem = () => {
    setShowItemModal(false);
    // Navigate to add-items screen with purchase mode
    // Note: Mode will be passed via navigation params instead of storage
    setTimeout(() => {
      router.push('/add-items?mode=purchase');
    }, 100);
  };

  const editItem = (item: PurchaseItem) => {
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

    const updatedItem: PurchaseItem = {
      ...editingItem,
      quantity,
      rate,
      total,
    };

    if (bill) {
      setBill({
        ...bill,
        items: bill.items.map(item => 
          item.id === editingItem.id ? updatedItem : item
        ),
      });
    }

    setItemForm({ quantity: '', rate: '' });
    setEditingItem(null);
    setShowItemModal(false);
  };

  const deleteItem = (itemId: string) => {
    if (bill) {
      setBill({
        ...bill,
        items: bill.items.filter(item => item.id !== itemId),
      });
    }
  };

  const renderItem = ({ item }: { item: PurchaseItem }) => (
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

  if (!bill) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Purchase Bill</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  const totalAmount = bill.items.reduce((sum, item) => sum + (item.total || 0), 0);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Purchase Bill</Text>
        <TouchableOpacity onPress={handleSaveBill} style={styles.saveButton}>
          <Ionicons name="checkmark" size={24} color={Colors.success} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Bill Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bill Details</Text>
          
          <Text style={styles.fieldLabel}>Bill No *</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter bill number..."
            placeholderTextColor={Colors.textTertiary}
            value={formData.billNo}
            onChangeText={(text) => setFormData(prev => ({ ...prev, billNo: text }))}
          />
          
          <Text style={styles.fieldLabel}>Supplier Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter supplier name..."
            placeholderTextColor={Colors.textTertiary}
            value={formData.partyName}
            onChangeText={(text) => setFormData(prev => ({ ...prev, partyName: text }))}
          />
          
          <Text style={styles.fieldLabel}>Phone Number *</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter phone number..."
            placeholderTextColor={Colors.textTertiary}
            value={formData.phoneNumber}
            onChangeText={(text) => setFormData(prev => ({ ...prev, phoneNumber: text }))}
            keyboardType="phone-pad"
          />
          
          <Text style={styles.fieldLabel}>Date</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter date..."
            placeholderTextColor={Colors.textTertiary}
            value={formData.date}
            onChangeText={(text) => setFormData(prev => ({ ...prev, date: text }))}
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
          
          {bill.items.length > 0 ? (
            <FlatList
              data={bill.items}
              renderItem={renderItem}
              keyExtractor={(item) => `edit-purchase-${item.id}`}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
            />
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="cube-outline" size={48} color={Colors.textTertiary} />
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
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textSecondary,
    marginBottom: 8,
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
