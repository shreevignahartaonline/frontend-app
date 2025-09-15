import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../constants/Colors';
import { handleApiError, Item, ItemsApiService } from '../utils/api';

// Item interface is now imported from api.ts

interface SelectedItem {
  id: string;
  productName: string;
  weightKg: number;
  pricePerKg: number;
  totalPrice: number;
}

// Mode to determine if this is for sales or purchase
type ItemMode = 'sales' | 'purchase';

export default function AddItemsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { mode, editingInvoiceId } = useLocalSearchParams<{ mode?: ItemMode; editingInvoiceId?: string }>();
  
  const [items, setItems] = useState<Item[]>([]);
  const [filteredItems, setFilteredItems] = useState<Item[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [itemMode, setItemMode] = useState<ItemMode>(mode || 'sales'); // Default to sales mode

  useEffect(() => {
    loadItems();
    // Set mode from navigation params
    if (mode) {
      setItemMode(mode);
    }
  }, [mode]);

  useEffect(() => {
    filterItems();
  }, [items, searchQuery]);

  // Reload items when screen comes into focus to reflect stock updates
  useFocusEffect(
    useCallback(() => {
      loadItems();
    }, [])
  );

  const loadItems = async () => {
    try {
      const itemsData = await ItemsApiService.getItems();
      setItems(itemsData);
      
      // Ensure Bardana is initialized
      try {
        await ItemsApiService.initializeBardana();
      } catch (bardanaError) {
        // Bardana already exists or initialization failed - this is expected
      }
    } catch (error) {
      console.error('Error loading items:', error);
      Alert.alert('Error', handleApiError(error));
    }
  };

  const filterItems = () => {
    if (!searchQuery.trim()) {
      setFilteredItems([]);
      setShowDropdown(false);
      return;
    }

    const filtered = items.filter(item =>
      item.productName.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredItems(filtered);
    setShowDropdown(filtered.length > 0);
  };

  const selectItem = (item: Item) => {
    // Check if item is already selected
    const isAlreadySelected = selectedItems.find(selected => selected.id === item.id);
    if (isAlreadySelected) {
      Alert.alert('Item Already Selected', 'This item is already in your selection.');
      return;
    }

    // For sales mode, check if item has stock available
    if (itemMode === 'sales') {
      const availableStockKg = item.openingStock * 30; // Convert bags to kg
      if (availableStockKg <= 0) {
        Alert.alert('Out of Stock', `${item.productName} is currently out of stock.`);
        return;
      }
    }

    // Price per kg depends on mode
    const pricePerKg = itemMode === 'sales' ? item.salePrice : item.purchasePrice;

    const newSelectedItem: SelectedItem = {
      id: item.id || item._id || '',
      productName: item.productName,
      weightKg: 0, // Default weight, user will input
      pricePerKg: pricePerKg,
      totalPrice: 0,
    };

    setSelectedItems(prev => [...prev, newSelectedItem]);
    setSearchQuery('');
    setShowDropdown(false);
  };

  const updateSelectedItemWeight = (itemId: string, weightKg: string) => {
    const weight = parseFloat(weightKg) || 0;
    
    // For sales mode, check stock availability
    if (itemMode === 'sales') {
      const selectedItem = selectedItems.find(item => item.id === itemId);
      if (selectedItem) {
        const originalItem = items.find(item => item.id === itemId);
        if (originalItem) {
          const availableStockKg = originalItem.openingStock * 30; // Convert bags to kg
          
          if (weight > availableStockKg) {
            Alert.alert('Insufficient Stock', 
              `${selectedItem.productName} only has ${Math.round(availableStockKg)} kg available. You cannot sell more than available stock.`);
            return;
          }
        }
      }
    }
    
    setSelectedItems(prev =>
      prev.map(item =>
        item.id === itemId
          ? { ...item, weightKg: weight, totalPrice: weight * item.pricePerKg }
          : item
      )
    );
  };

  const removeSelectedItem = (itemId: string) => {
    setSelectedItems(prev => prev.filter(item => item.id !== itemId));
  };

  const addItemsToBill = async () => {
    if (selectedItems.length === 0) {
      Alert.alert('No Items Selected', 'Please select at least one item.');
      return;
    }

    // Check if all items have weight
    const itemsWithoutWeight = selectedItems.filter(item => item.weightKg <= 0);
    if (itemsWithoutWeight.length > 0) {
      Alert.alert('Missing Weight', 'Please enter weight for all selected items.');
      return;
    }

    // Convert selected items to the format expected by sales/purchase
    const billItems = selectedItems.map(item => ({
      id: item.id,
      itemName: item.productName,
      quantity: item.weightKg,
      rate: item.pricePerKg,
      total: item.totalPrice,
    }));

    // Store selected items in a global temporary location
    // This is a simple solution that works with the current navigation structure
    try {
      // Use a simple global variable approach for now
      (global as any).tempSelectedItems = {
        items: billItems,
        mode: itemMode,
        editingInvoiceId: editingInvoiceId,
        timestamp: Date.now()
      };
      
      router.back();
    } catch (error) {
      console.error('Error navigating back:', error);
      Alert.alert('Error', 'Failed to navigate back. Please try again.');
    }
  };

  // Calculate total amount
  const totalAmount = selectedItems.reduce((sum, item) => sum + item.totalPrice, 0);

  const renderDropdownItem = ({ item }: { item: Item }) => (
    <TouchableOpacity
      style={styles.dropdownItem}
      onPress={() => selectItem(item)}
    >
      <View style={styles.dropdownItemContent}>
        <Text style={styles.dropdownItemName}>{item.productName}</Text>
        <Text style={styles.dropdownItemStock}>
          Available Bags: {Math.round(item.openingStock)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderSelectedItem = ({ item }: { item: SelectedItem }) => (
    <View style={styles.selectedItemCard}>
      <View style={styles.selectedItemHeader}>
        <Text style={styles.selectedItemName}>{item.productName}</Text>
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => removeSelectedItem(item.id)}
        >
          <Ionicons name="close-circle" size={20} color={Colors.error} />
        </TouchableOpacity>
      </View>
      
      <View style={styles.selectedItemDetails}>
        <View style={styles.inputRow}>
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Weight (kg)</Text>
            <TextInput
              style={styles.weightInput}
              placeholder="Enter weight..."
              placeholderTextColor={Colors.textTertiary}
              value={item.weightKg > 0 ? item.weightKg.toString() : ''}
              onChangeText={(text) => updateSelectedItemWeight(item.id, text)}
              keyboardType="numeric"
            />
          </View>
          
          <View style={styles.priceContainer}>
            <Text style={styles.inputLabel}>Price (₹/kg)</Text>
            <Text style={styles.priceValue}>₹{Math.round(item.pricePerKg)}</Text>
          </View>
        </View>
        
        {item.weightKg > 0 && (
          <>
            <View style={styles.bagsRow}>
              <Text style={styles.bagsLabel}>Equivalent Bags:</Text>
              <Text style={styles.bagsValue}>{Math.round(item.weightKg / 30)} bags</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total:</Text>
              <Text style={styles.totalValue}>₹{Math.round(item.totalPrice)}</Text>
            </View>
          </>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={[styles.header, { paddingTop: insets.top - 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {itemMode === 'sales' ? 'Select Items for Sale' : 'Select Items for Purchase'}
        </Text>
        <View style={styles.placeholder} />
      </View>
      
      <View style={styles.content}>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={20} color={Colors.textTertiary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search products..."
              placeholderTextColor={Colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={() => {
                if (searchQuery.trim() && filteredItems.length > 0) {
                  setShowDropdown(true);
                }
              }}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => {
                setSearchQuery('');
                setShowDropdown(false);
              }}>
                <Ionicons name="close-circle" size={20} color={Colors.textTertiary} />
              </TouchableOpacity>
            )}
          </View>
          
          {/* Dropdown */}
          {showDropdown && (
            <View style={styles.dropdown}>
              <FlatList
                data={filteredItems.slice(0, 3)}
                renderItem={renderDropdownItem}
                keyExtractor={(item) => `add-items-dropdown-${item.id || item._id || Math.random()}`}
                style={styles.dropdownList}
                nestedScrollEnabled={true}
                showsVerticalScrollIndicator={false}
              />
            </View>
          )}
        </View>


        {/* Selected Items */}
        <View style={styles.selectedItemsContainer}>
          <Text style={styles.sectionTitle}>
            Selected Items ({selectedItems.length})
          </Text>
          
          {selectedItems.length > 0 ? (
            <FlatList
              data={selectedItems}
              renderItem={renderSelectedItem}
              keyExtractor={(item) => `add-items-selected-${item.id}`}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
            />
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="cube-outline" size={48} color={Colors.textTertiary} />
                          <Text style={styles.emptyStateText}>No items selected</Text>
            <Text style={styles.emptyStateSubtext}>
              {itemMode === 'sales' 
                ? 'Search and select items to add to your invoice'
                : 'Search and select items to add to your purchase bill'
              }
            </Text>
            </View>
          )}
        </View>
      </View>

      {/* Footer with Total and Add Products Button */}
      {selectedItems.length > 0 && (
        <View style={styles.footer}>
          <View style={styles.totalContainer}>
            <Text style={styles.footerTotalLabel}>Total Amount:</Text>
            <Text style={styles.totalAmount}>₹{Math.round(totalAmount)}</Text>
          </View>
          <TouchableOpacity style={styles.addProductsButton} onPress={addItemsToBill}>
            <Ionicons name="add-circle" size={24} color={Colors.text} />
            <Text style={styles.addProductsButtonText}>
              {itemMode === 'sales' ? 'Add Products' : 'Add Items'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
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
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  searchContainer: {
    marginBottom: 24,
    zIndex: 1000,
    position: 'relative',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    marginTop: 8,
    maxHeight: 144, // Height for exactly 3 items (48px each)
    borderWidth: 1,
    borderColor: Colors.border,
    zIndex: 1000,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  dropdownList: {
    maxHeight: 144, // Height for exactly 3 items (48px each)
  },
  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  dropdownItemContent: {
    gap: 4,
  },
  dropdownItemName: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
  },
  dropdownItemStock: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  selectedItemsContainer: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 16,
  },
  selectedItemCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  selectedItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  selectedItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    flex: 1,
  },
  removeButton: {
    padding: 4,
  },
  selectedItemDetails: {
    gap: 12,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  inputContainer: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  weightInput: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  priceContainer: {
    flex: 1,
  },
  priceValue: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.success,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: Colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bagsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
  },
  bagsLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  bagsValue: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.success,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 16,
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  footerTotalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.success,
  },
  addProductsButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addProductsButtonText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
});
