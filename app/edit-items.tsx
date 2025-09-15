import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { Colors } from '../constants/Colors';
import { Item, ItemsApiService, handleApiError } from '../utils/api';

// Item interface is now imported from api.ts

export default function EditItemsScreen() {
  const router = useRouter();
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Form states
  const [itemForm, setItemForm] = useState({
    productName: '',
    category: 'Primary' as 'Primary' | 'Kirana',
    purchasePrice: '',
    salePrice: '',
    openingStock: '',
    asOfDate: '',
    lowStockAlert: '',
  });

  useEffect(() => {
    if (itemId) {
      loadItem();
    }
  }, [itemId]);

  const loadItem = async () => {
    try {
      setLoading(true);
      const foundItem = await ItemsApiService.getItemById(itemId);
      
      setItem(foundItem);
      setItemForm({
        productName: foundItem.productName,
        category: foundItem.category,
        purchasePrice: foundItem.purchasePrice.toString(),
        salePrice: foundItem.salePrice.toString(),
        openingStock: (foundItem.openingStock * 30).toString(), // Convert bags to kg
        asOfDate: foundItem.asOfDate,
        lowStockAlert: (foundItem.lowStockAlert * 30).toString(), // Convert bags to kg
      });
    } catch (error) {
      console.error('Error loading item:', error);
      Alert.alert('Error', handleApiError(error));
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleSaveItem = async () => {
    // Validate required fields
    const missingFields = [];
    if (!itemForm.productName.trim()) missingFields.push('Product Name');
    if (!itemForm.purchasePrice.trim()) missingFields.push('Purchase Price');
    if (!itemForm.salePrice.trim()) missingFields.push('Sale Price');
    if (!itemForm.openingStock.trim()) missingFields.push('Opening Stock');
    if (!itemForm.asOfDate.trim()) missingFields.push('As of Date');
    if (!itemForm.lowStockAlert.trim()) missingFields.push('Low Stock Alert');
    
    if (missingFields.length > 0) {
      Alert.alert('Error', `Please fill the following required fields:\n• ${missingFields.join('\n• ')}`);
      return;
    }
    
    // Validate numeric fields
    const purchasePrice = parseFloat(itemForm.purchasePrice);
    const salePrice = parseFloat(itemForm.salePrice);
    const openingStock = parseFloat(itemForm.openingStock);
    const lowStockAlert = parseFloat(itemForm.lowStockAlert);
    
    if (isNaN(purchasePrice) || purchasePrice < 0) {
      Alert.alert('Error', 'Please enter a valid purchase price');
      return;
    }
    
    if (isNaN(salePrice) || salePrice < 0) {
      Alert.alert('Error', 'Please enter a valid sale price');
      return;
    }
    
    if (isNaN(openingStock) || openingStock < 0) {
      Alert.alert('Error', 'Please enter a valid opening stock');
      return;
    }
    
    if (isNaN(lowStockAlert) || lowStockAlert < 0) {
      Alert.alert('Error', 'Please enter a valid low stock alert');
      return;
    }

    try {
      const updateData = {
        productName: itemForm.productName.trim(),
        category: itemForm.category,
        purchasePrice,
        salePrice,
        openingStock: openingStock / 30, // Convert kg to bags
        asOfDate: itemForm.asOfDate,
        lowStockAlert: lowStockAlert / 30, // Convert kg to bags
      };

      const updatedItem = await ItemsApiService.updateItem(itemId, updateData);
      setItem(updatedItem);
      
      Alert.alert('Success', 'Item updated successfully!');
      router.back();
    } catch (error) {
      console.error('Error updating item:', error);
      Alert.alert('Error', handleApiError(error));
    }
  };

  const handleDeleteItem = async () => {
    Alert.alert(
      'Delete Item',
      `Are you sure you want to delete "${itemForm.productName}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await ItemsApiService.deleteItem(itemId);
              Alert.alert('Success', 'Item deleted successfully!');
              router.back();
            } catch (error) {
              console.error('Error deleting item:', error);
              Alert.alert('Error', handleApiError(error));
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Item</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  if (!item) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Item</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Item not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Item</Text>
        <View style={styles.headerActions}>
          {/* Only show delete button for non-universal items */}
          {!item.isUniversal && (
            <TouchableOpacity onPress={handleDeleteItem} style={styles.deleteButton}>
              <Ionicons name="trash-outline" size={20} color={Colors.error} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Universal Item Warning */}
        {item.isUniversal && (
          <View style={styles.universalWarning}>
            <Ionicons name="shield-checkmark" size={20} color={Colors.primary} />
            <Text style={styles.universalWarningText}>
              This is a universal item. Core properties cannot be modified.
            </Text>
          </View>
        )}

        {/* Bardana Specific Information */}
        {item.isUniversal && item.productName === 'Bardana' && (
          <View style={styles.bardanaInfo}>
            <View style={styles.bardanaInfoHeader}>
              <Ionicons name="information-circle" size={20} color={Colors.primary} />
              <Text style={styles.bardanaInfoTitle}>Bardana Stock Management</Text>
            </View>
            <Text style={styles.bardanaInfoText}>
              Bardana is a universal item that automatically tracks packaging material usage.
            </Text>
            <Text style={styles.bardanaInfoNote}>
              • Stock decreases by 1 kg for every 1 kg of product sold{'\n'}
              • Stock increases by 1 kg for every 1 kg of product purchased{'\n'}
              • This item cannot be deleted as it's essential for inventory tracking
            </Text>
          </View>
        )}

        {/* Form Section */}
        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Product Details</Text>
          
          <Text style={styles.fieldLabel}>Product Name *</Text>
          <TextInput
            style={[styles.input, item.isUniversal && styles.disabledInput]}
            placeholder="Enter product name..."
            placeholderTextColor={Colors.textTertiary}
            value={itemForm.productName}
            onChangeText={(text) => setItemForm(prev => ({ ...prev, productName: text }))}
            editable={!item.isUniversal}
          />
          
          <Text style={styles.fieldLabel}>Product Category *</Text>
          <View style={styles.categorySelector}>
            <TouchableOpacity
              style={[
                styles.categoryOption,
                itemForm.category === 'Primary' && styles.categoryOptionSelected,
                item.isUniversal && styles.disabledCategoryOption
              ]}
              onPress={() => !item.isUniversal && setItemForm(prev => ({ ...prev, category: 'Primary' }))}
              disabled={item.isUniversal}
            >
              <Text style={[
                styles.categoryOptionText,
                itemForm.category === 'Primary' && styles.categoryOptionTextSelected,
                item.isUniversal && styles.disabledCategoryOptionText
              ]}>
                Primary
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.categoryOption,
                itemForm.category === 'Kirana' && styles.categoryOptionSelected,
                item.isUniversal && styles.disabledCategoryOption
              ]}
              onPress={() => !item.isUniversal && setItemForm(prev => ({ ...prev, category: 'Kirana' }))}
              disabled={item.isUniversal}
            >
              <Text style={[
                styles.categoryOptionText,
                itemForm.category === 'Kirana' && styles.categoryOptionTextSelected,
                item.isUniversal && styles.disabledCategoryOptionText
              ]}>
                Kirana
              </Text>
            </TouchableOpacity>
          </View>
          
          <Text style={styles.fieldLabel}>Purchase Price (₹) *</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter purchase price..."
            placeholderTextColor={Colors.textTertiary}
            value={itemForm.purchasePrice}
            onChangeText={(text) => setItemForm(prev => ({ ...prev, purchasePrice: text }))}
            keyboardType="numeric"
          />
          
          <Text style={styles.fieldLabel}>Sale Price (₹) *</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter sale price..."
            placeholderTextColor={Colors.textTertiary}
            value={itemForm.salePrice}
            onChangeText={(text) => setItemForm(prev => ({ ...prev, salePrice: text }))}
            keyboardType="numeric"
          />
          
          <Text style={styles.fieldLabel}>Opening Stock (Kg) *</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter opening stock in kg..."
            placeholderTextColor={Colors.textTertiary}
            value={itemForm.openingStock}
            onChangeText={(text) => setItemForm(prev => ({ ...prev, openingStock: text }))}
            keyboardType="numeric"
          />
          <Text style={styles.helperText}>
            Note: 1 Bag = 30 Kg (Will be converted to bags automatically)
          </Text>
          
          <Text style={styles.fieldLabel}>As of Date *</Text>
          <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={Colors.textTertiary}
            value={itemForm.asOfDate}
            onChangeText={(text) => setItemForm(prev => ({ ...prev, asOfDate: text }))}
          />
          
          <Text style={styles.fieldLabel}>Low Stock Alert (Kg) *</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter low stock alert threshold in kg..."
            placeholderTextColor={Colors.textTertiary}
            value={itemForm.lowStockAlert}
            onChangeText={(text) => setItemForm(prev => ({ ...prev, lowStockAlert: text }))}
            keyboardType="numeric"
          />
        </View>

        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.saveButton} onPress={handleSaveItem}>
            <Text style={styles.saveButtonText}>Save Changes</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
    paddingTop: Platform.OS === 'android' ? 80 : 60,
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deleteButton: {
    padding: 8,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  formSection: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 20,
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
  categorySelector: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  categoryOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  categoryOptionSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  categoryOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  categoryOptionTextSelected: {
    color: Colors.text,
  },
  helperText: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: -12,
    marginBottom: 16,
    marginLeft: 4,
    fontStyle: 'italic',
  },
  actionContainer: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  saveButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: Colors.error,
  },
  universalWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary + '15',
    padding: 16,
    margin: 20,
    marginBottom: 0,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
  },
  universalWarningText: {
    fontSize: 14,
    color: Colors.primary,
    marginLeft: 8,
    fontWeight: '500',
  },
  bardanaInfo: {
    backgroundColor: Colors.primary + '08',
    borderRadius: 8,
    padding: 16,
    margin: 20,
    marginBottom: 0,
    borderWidth: 1,
    borderColor: Colors.primary + '20',
  },
  bardanaInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  bardanaInfoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
    marginLeft: 8,
  },
  bardanaInfoText: {
    fontSize: 14,
    color: Colors.text,
    marginBottom: 12,
    lineHeight: 20,
  },
  bardanaInfoNote: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  disabledInput: {
    backgroundColor: Colors.surface + '80',
    color: Colors.textTertiary,
    borderColor: Colors.border + '80',
  },
  disabledCategoryOption: {
    backgroundColor: Colors.surface + '80',
    borderColor: Colors.border + '80',
  },
  disabledCategoryOptionText: {
    color: Colors.textTertiary,
  },
});
