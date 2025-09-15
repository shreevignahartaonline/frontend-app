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
import { Item, ItemsApiService, handleApiError } from '../../utils/api';

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

// Item interface is now imported from api.ts

export default function ItemsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<Item[]>([]);
  const [filteredItems, setFilteredItems] = useState<Item[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<'Primary' | 'Kirana'>('Primary');
  
  // Form states
  const [itemForm, setItemForm] = useState({
    productName: '',
    category: 'Primary' as 'Primary' | 'Kirana',
    purchasePrice: '',
    salePrice: '',
    openingStock: '',
    asOfDate: new Date().toISOString().split('T')[0], // Today's date in YYYY-MM-DD format
    lowStockAlert: '',
  });

  useEffect(() => {
    loadItems();
  }, []);

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
        console.log('Bardana already exists or initialization failed:', bardanaError);
      }
    } catch (error) {
      console.error('Error loading items:', error);
      Alert.alert('Error', handleApiError(error));
    }
  };

  const filterItems = () => {
    let filtered = items;
    
    // Apply search filter
    if (searchQuery.trim()) {
      filtered = filtered.filter(item =>
        item.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    setFilteredItems(filtered);
  };


  // Get items with low stock
  const getLowStockItems = () => {
    return items.filter(item => item.openingStock <= item.lowStockAlert);
  };



  const handleCreateItem = async () => {
    // Validate required fields
    const missingFields = [];
    if (!itemForm.productName.trim()) missingFields.push('Product Name');
    if (!itemForm.purchasePrice.trim()) missingFields.push('Purchase Price');
    if (!itemForm.salePrice.trim()) missingFields.push('Sale Price');
    if (!itemForm.openingStock.trim()) missingFields.push('Opening Stock');
    if (!itemForm.lowStockAlert.trim()) missingFields.push('Low Stock Alert');
    
    if (missingFields.length > 0) {
      Alert.alert('Error', `Please fill the following required fields:\n• ${missingFields.join('\n• ')}`);
      return;
    }

    // Validate numeric fields
    const purchasePrice = parseFloat(itemForm.purchasePrice);
    const salePrice = parseFloat(itemForm.salePrice);
    const openingStockKg = parseFloat(itemForm.openingStock);
    const lowStockAlertKg = parseFloat(itemForm.lowStockAlert);

    if (isNaN(purchasePrice) || purchasePrice < 0) {
      Alert.alert('Error', 'Please enter a valid purchase price');
      return;
    }

    if (isNaN(salePrice) || salePrice < 0) {
      Alert.alert('Error', 'Please enter a valid sale price');
      return;
    }

    if (isNaN(openingStockKg) || openingStockKg < 0) {
      Alert.alert('Error', 'Please enter a valid opening stock');
      return;
    }

    if (isNaN(lowStockAlertKg) || lowStockAlertKg < 0) {
      Alert.alert('Error', 'Please enter a valid low stock alert');
      return;
    }

    // Convert kg to bags (1 bag = 30 kg)
    const openingStockBags = openingStockKg / 30;
    const lowStockAlertBags = lowStockAlertKg / 30;

    // Check if product name already exists
    const existingItem = items.find(item => 
      item.productName.toLowerCase() === itemForm.productName.trim().toLowerCase()
    );

    if (existingItem) {
      Alert.alert('Error', 'A product with this name already exists');
      return;
    }

    const newItemData = {
      productName: itemForm.productName.trim(),
      category: itemForm.category,
      purchasePrice,
      salePrice,
      openingStock: openingStockBags, // Store in bags
      asOfDate: itemForm.asOfDate,
      lowStockAlert: lowStockAlertBags, // Store in bags
      isUniversal: false,
    };

    try {
      const createdItem = await ItemsApiService.createItem(newItemData);
      setItems(prev => [...prev, createdItem]);
      
      // Reset form
      setItemForm({
        productName: '',
        category: 'Primary',
        purchasePrice: '',
        salePrice: '',
        openingStock: '',
        asOfDate: new Date().toISOString().split('T')[0],
        lowStockAlert: '',
      });
      setShowCreateModal(false);
      
      Alert.alert('Success', 'Product created successfully!');
    } catch (error) {
      console.error('Error creating item:', error);
      Alert.alert('Error', handleApiError(error));
    }
  };

  const handleDeleteItem = async (itemId: string, itemName: string) => {
    // Check if item is universal (cannot be deleted)
    const itemToDelete = items.find(item => (item.id || item._id) === itemId);
    if (itemToDelete?.isUniversal) {
      Alert.alert(
        'Cannot Delete Universal Item',
        `${itemName} is a universal item and cannot be deleted. You can only edit its properties.`,
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert(
      'Delete Product',
      `Are you sure you want to delete "${itemName}"? This action cannot be undone.`,
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
              await ItemsApiService.deleteItem(itemId);
              setItems(prev => prev.filter(item => (item.id || item._id) !== itemId));
              Alert.alert('Success', 'Product deleted successfully!');
            } catch (error) {
              console.error('Error deleting item:', error);
              Alert.alert('Error', handleApiError(error));
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: Item }) => (
    <TouchableOpacity 
      style={styles.itemCard}
      onPress={() => router.push(`/edit-items?itemId=${item.id || item._id}`)}
      activeOpacity={0.7}
    >
      {/* Main Item Info Row */}
      <View style={styles.itemMainRow}>
        <View style={styles.itemInfo}>
          <Text style={styles.itemName}>{item.productName}</Text>
          <View style={styles.itemMeta}>
            <View style={[
              styles.categoryBadge,
              { backgroundColor: item.category === 'Primary' ? Colors.primary + '20' : Colors.success + '20' }
            ]}>
              <Text style={[
                styles.categoryText,
                { color: item.category === 'Primary' ? Colors.primary : Colors.success }
              ]}>
                {item.category}
              </Text>
            </View>
          </View>
        </View>
        
        <View style={styles.itemActions}>
          {/* Universal Item Indicator */}
          {item.isUniversal && (
            <View style={styles.universalBadge}>
              <Ionicons name="shield-checkmark" size={14} color={Colors.primary} />
              <Text style={styles.universalText}>Universal</Text>
            </View>
          )}
          
          <TouchableOpacity
            style={styles.editIcon}
            onPress={(e) => {
              e.stopPropagation();
              router.push(`/edit-items?itemId=${item.id || item._id}`);
            }}
          >
            <Ionicons name="pencil-outline" size={16} color={Colors.primary} />
          </TouchableOpacity>
          
          {/* Only show delete button for non-universal items */}
          {!item.isUniversal && (
            <TouchableOpacity
              style={styles.deleteIcon}
              onPress={(e) => {
                e.stopPropagation();
                handleDeleteItem(item.id || item._id || '', item.productName);
              }}
            >
              <Ionicons name="trash-outline" size={16} color={Colors.error} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Price and Stock Row */}
      <View style={styles.itemStatsRow}>
        <View style={styles.priceSection}>
          <Text style={styles.priceLabel}>Sale Price</Text>
          <Text style={styles.itemPrice}>₹{item.salePrice.toLocaleString()}</Text>
        </View>
        
        <View style={styles.stockSection}>
          <Text style={styles.stockLabel}>Stock</Text>
          <Text style={[
            styles.stockValue,
            item.openingStock <= item.lowStockAlert && styles.lowStockText
          ]}>
            {Math.round(item.openingStock)} bags
          </Text>
          {item.openingStock <= item.lowStockAlert && (
            <View style={styles.lowStockIndicator}>
              <Ionicons name="warning" size={14} color={Colors.error} />
              <Text style={styles.lowStockAlertText}>Low Stock</Text>
            </View>
          )}
        </View>
      </View>

      {/* Quick Details Row - Removed for cleaner design */}
    </TouchableOpacity>
  );

  const renderCreateModal = () => (
    <Modal
      isVisible={showCreateModal}
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
      <TouchableWithoutFeedback onPress={() => setShowCreateModal(false)}>
        <View style={styles.customBackdrop} />
      </TouchableWithoutFeedback>

      <View style={[styles.modalContent, { 
        paddingTop: 15,
        paddingBottom: Math.max(insets.bottom, 10),
        height: height - insets.top - insets.bottom
      }]}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Create New Product</Text>
          <TouchableOpacity 
            onPress={() => setShowCreateModal(false)}
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
            
            <TextInput
              style={styles.input}
              placeholder="Enter product name..."
              placeholderTextColor={Colors.textTertiary}
              value={itemForm.productName}
              onChangeText={(text) => setItemForm(prev => ({ ...prev, productName: text }))}
            />
            
            <Text style={styles.fieldLabel}>Product Category *</Text>
            <View style={styles.categorySelector}>
              <TouchableOpacity
                style={[
                  styles.categoryOption,
                  itemForm.category === 'Primary' && styles.categoryOptionSelected
                ]}
                onPress={() => setItemForm(prev => ({ ...prev, category: 'Primary' }))}
              >
                <Text style={[
                  styles.categoryOptionText,
                  itemForm.category === 'Primary' && styles.categoryOptionTextSelected
                ]}>
                  Primary
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.categoryOption,
                  itemForm.category === 'Kirana' && styles.categoryOptionSelected
                ]}
                onPress={() => setItemForm(prev => ({ ...prev, category: 'Kirana' }))}
              >
                <Text style={[
                  styles.categoryOptionText,
                  itemForm.category === 'Kirana' && styles.categoryOptionTextSelected
                ]}>
                  Kirana
                </Text>
              </TouchableOpacity>
            </View>
            
            <TextInput
              style={styles.input}
              placeholder="Enter purchase price..."
              placeholderTextColor={Colors.textTertiary}
              value={itemForm.purchasePrice}
              onChangeText={(text) => setItemForm(prev => ({ ...prev, purchasePrice: text }))}
              keyboardType="numeric"
            />
            
            <TextInput
              style={styles.input}
              placeholder="Enter sale price..."
              placeholderTextColor={Colors.textTertiary}
              value={itemForm.salePrice}
              onChangeText={(text) => setItemForm(prev => ({ ...prev, salePrice: text }))}
              keyboardType="numeric"
            />
            
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
            
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={Colors.textTertiary}
              value={itemForm.asOfDate}
              onChangeText={(text) => setItemForm(prev => ({ ...prev, asOfDate: text }))}
            />
            
            <TextInput
              style={styles.input}
              placeholder="Enter low stock alert threshold in kg..."
              placeholderTextColor={Colors.textTertiary}
              value={itemForm.lowStockAlert}
              onChangeText={(text) => setItemForm(prev => ({ ...prev, lowStockAlert: text }))}
              keyboardType="numeric"
            />
          </View>
        </ScrollView>
        </KeyboardAvoidingView>
        
        <View style={styles.modalFooter}>
          <TouchableOpacity 
            style={styles.cancelButton} 
            onPress={() => setShowCreateModal(false)}
            activeOpacity={isAndroid ? 0.7 : 0.2}
            {...(isAndroid && {
              android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
            })}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.createButton} 
            onPress={handleCreateItem}
            activeOpacity={isAndroid ? 0.7 : 0.2}
            {...(isAndroid && {
              android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
            })}
          >
            <Text style={styles.createButtonText}>Create Product</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );


   return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Items</Text>
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        // Android-specific: Optimize scrolling
        {...(isAndroid && {
          overScrollMode: 'never',
          nestedScrollEnabled: true,
        })}
      >
                 {/* Header Stats */}
         <View style={styles.headerStats}>
           <View style={styles.statCard}>
             <Text style={styles.statValue}>{items.length}</Text>
             <Text style={styles.statLabel}>Total Products</Text>
           </View>
                       <View style={styles.statCard}>
              <Text style={styles.statValue}>
                ₹{Math.round(items.reduce((total, item) => total + ((item.openingStock * 30) * item.purchasePrice), 0)).toLocaleString()}
              </Text>
              <Text style={styles.statLabel}>Total Stock Value</Text>
            </View>
                   </View>

          {/* Low Stock Alert Banner */}
          {getLowStockItems().length > 0 && (
            <TouchableOpacity 
              style={styles.lowStockAlert}
              onPress={() => {
                const lowStockItems = getLowStockItems();
                const itemNames = lowStockItems.map(item => 
                  `• ${item.productName}: ${Math.round(item.openingStock)} bags (${Math.round(item.openingStock * 30)} kg)`
                ).join('\n');
                Alert.alert(
                  'Low Stock Items',
                  `The following items are below their low stock threshold:\n\n${itemNames}`,
                  [{ text: 'OK', style: 'default' }]
                );
              }}
              activeOpacity={isAndroid ? 0.7 : 0.2}
              {...(isAndroid && {
                android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
              })}
            >
              <Ionicons name="warning" size={20} color={Colors.error} />
              <Text style={styles.lowStockAlertText}>
                {getLowStockItems().length} item{getLowStockItems().length > 1 ? 's' : ''} below low stock threshold
              </Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.error} />
            </TouchableOpacity>
          )}

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
             />
             {searchQuery.length > 0 && (
               <TouchableOpacity onPress={() => setSearchQuery('')}>
                 <Ionicons name="close-circle" size={20} color={Colors.textTertiary} />
               </TouchableOpacity>
             )}
           </View>
         </View>

                 {/* Action Button */}
         <View style={styles.actionContainer}>
           <TouchableOpacity 
             style={styles.createButton} 
             onPress={() => setShowCreateModal(true)}
           >
             <Ionicons name="add-circle" size={24} color={Colors.text} />
             <Text style={styles.createButtonText}>Create New Product</Text>
           </TouchableOpacity>
         </View>

        {/* Bardana Section */}
        {(() => {
          const bardanaItem = items.find(item => item.isUniversal && item.productName === 'Bardana');
          return bardanaItem && (
            <View key="bardana-section" style={styles.bardanaSection}>
                  <View style={styles.bardanaHeader}>
                    <View style={styles.bardanaTitleContainer}>
                      <Ionicons name="shield-checkmark" size={20} color={Colors.primary} />
                      <Text style={styles.bardanaTitle}>Universal Bardana</Text>
                      <View style={styles.universalBadge}>
                        <Text style={styles.universalText}>System Item</Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.bardanaEditButton}
                      onPress={() => {
                        router.push(`/edit-items?itemId=${bardanaItem.id || bardanaItem._id}`);
                      }}
                    >
                      <Ionicons name="pencil" size={16} color={Colors.primary} />
                    </TouchableOpacity>
                  </View>
                  
                  <View style={styles.bardanaStats}>
                    <View style={styles.bardanaStat}>
                      <Text style={styles.bardanaStatLabel}>Current Stock</Text>
                      <Text style={[
                        styles.bardanaStatValue,
                        bardanaItem.openingStock <= bardanaItem.lowStockAlert && styles.lowStockText
                      ]}>
                        {Math.round(bardanaItem.openingStock * 100) / 100} bags
                      </Text>
                      <Text style={styles.bardanaStatUnit}>
                        ({Math.round(bardanaItem.openingStock * 30)} kg)
                      </Text>
                    </View>
                    
                    <View style={styles.bardanaStat}>
                      <Text style={styles.bardanaStatLabel}>Low Stock Alert</Text>
                      <Text style={styles.bardanaStatValue}>
                        {Math.round(bardanaItem.lowStockAlert * 100) / 100} bags
                      </Text>
                      <Text style={styles.bardanaStatUnit}>
                        ({Math.round(bardanaItem.lowStockAlert * 30)} kg)
                      </Text>
                    </View>
                  </View>
                  
                  {bardanaItem.openingStock <= bardanaItem.lowStockAlert && (
                    <View style={styles.bardanaAlert}>
                      <Ionicons name="warning" size={16} color={Colors.error} />
                      <Text style={styles.bardanaAlertText}>
                        Bardana stock is below alert level
                      </Text>
                    </View>
                  )}
                </View>
          );
        })()}

        {/* Items List */}
        <View style={styles.listContainer}>
          <Text style={styles.sectionTitle}>Products ({filteredItems.filter(item => !item.isUniversal).length})</Text>
          {filteredItems.filter(item => !item.isUniversal).length > 0 ? (
            <FlatList
              data={filteredItems.filter(item => !item.isUniversal)}
              renderItem={renderItem}
              keyExtractor={(item) => `items-${item.id || item._id || Math.random()}`}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
            />
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="cube-outline" size={64} color={Colors.textTertiary} />
              <Text style={styles.emptyStateTitle}>No Products Yet</Text>
              <Text style={styles.emptyStateSubtitle}>
                {searchQuery ? 'No products match your search' : 'Create your first product to get started'}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

             {renderCreateModal()}
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
    paddingTop: isAndroid ? 60 : 20, // Increased padding for Android status bar
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'left',
  },
  content: {
    flex: 1,
    // Android-specific: Optimize scrolling performance
    ...(isAndroid && {
      overScrollMode: 'never',
      nestedScrollEnabled: true,
    }),
  },
  headerStats: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    // Android-specific: Add elevation for Material Design
    ...(isAndroid && {
      elevation: ANDROID_CONSTANTS.elevation.low,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.22,
      shadowRadius: 2.22,
    }),
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    // Android-specific: Add elevation and optimize input
    ...(isAndroid && {
      elevation: ANDROID_CONSTANTS.elevation.low,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.22,
      shadowRadius: 2.22,
    }),
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
  actionContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
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
  itemCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border + '20',
    // Android-specific: Add elevation for Material Design
    ...(isAndroid && {
      elevation: ANDROID_CONSTANTS.elevation.low,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.22,
      shadowRadius: 2.22,
    }),
  },
  // Main Item Info Row
  itemMainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 8,
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
  },
  itemDate: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  editIcon: {
    padding: 4,
    // Android-specific: Ensure minimum touch target
    minWidth: ANDROID_CONSTANTS.touchTargetMinSize,
    minHeight: ANDROID_CONSTANTS.touchTargetMinSize,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteIcon: {
    padding: 4,
    // Android-specific: Ensure minimum touch target
    minWidth: ANDROID_CONSTANTS.touchTargetMinSize,
    minHeight: ANDROID_CONSTANTS.touchTargetMinSize,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Price and Stock Row
  itemStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border + '20',
  },
  priceSection: {
    flex: 1,
  },
  priceLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.success,
  },
  stockSection: {
    flex: 1,
    alignItems: 'flex-end',
  },
  stockLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 4,
    textAlign: 'right',
  },
  stockValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    textAlign: 'right',
  },
  lowStockIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  lowStockAlertText: {
    fontSize: 11,
    color: Colors.error,
    fontWeight: '500',
  },
  lowStockText: {
    color: Colors.error,
  },
  // Quick Details Row
  quickDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  quickDetail: {
    flex: 1,
    alignItems: 'center',
  },
  quickDetailLabel: {
    fontSize: 11,
    color: Colors.textTertiary,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  quickDetailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  // Low Stock Alert Banner
  lowStockAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.error + '20',
    borderWidth: 1,
    borderColor: Colors.error,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 16,
    gap: 12,
    // Android-specific: Add elevation for Material Design
    ...(isAndroid && {
      elevation: ANDROID_CONSTANTS.elevation.low,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.22,
      shadowRadius: 2.22,
    }),
  },
  editHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border + '30',
  },
  editHintText: {
    fontSize: 11,
    color: Colors.textTertiary,
    fontStyle: 'italic',
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
     modalOverlay: {
     flex: 1,
     backgroundColor: 'rgba(0, 0, 0, 0.5)',
     justifyContent: 'flex-end',
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
  keyboardAvoidingContent: {
    flex: 1,
  },
  formSection: {
    marginTop: 20,
    marginBottom: 20,
    paddingHorizontal: 2,
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
    paddingVertical: 16,
    paddingHorizontal: 16,
    fontSize: 16,
    color: Colors.text,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
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
  helperText: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: -12,
    marginBottom: 16,
    marginLeft: 4,
    fontStyle: 'italic',
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
    // Android-specific: Ensure minimum touch target
    minHeight: ANDROID_CONSTANTS.touchTargetMinSize,
    justifyContent: 'center',
  },
  categoryOptionSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  categoryOptionText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  categoryOptionTextSelected: {
    color: Colors.text,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
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
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
    universalBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: Colors.primary + '15',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      marginRight: 8,
    },
    universalText: {
      fontSize: 12,
      fontWeight: '600',
      color: Colors.primary,
      marginLeft: 4,
    },
    bardanaSection: {
      backgroundColor: Colors.primary + '08',
      borderRadius: 12,
      padding: 16,
      marginHorizontal: 20,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: Colors.primary + '20',
    },
    bardanaHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    bardanaTitleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    bardanaTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: Colors.primary,
      marginLeft: 8,
      marginRight: 12,
    },
    bardanaEditButton: {
      padding: 8,
      borderRadius: 8,
      backgroundColor: Colors.primary + '15',
    },
    bardanaStats: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    bardanaStat: {
      flex: 1,
      alignItems: 'center',
    },
    bardanaStatLabel: {
      fontSize: 12,
      color: Colors.textSecondary,
      marginBottom: 4,
    },
    bardanaStatValue: {
      fontSize: 16,
      fontWeight: '600',
      color: Colors.text,
      marginBottom: 2,
    },
    bardanaStatUnit: {
      fontSize: 12,
      color: Colors.textTertiary,
    },
    bardanaAlert: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: Colors.error + '15',
      padding: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: Colors.error + '30',
    },
    bardanaAlertText: {
      fontSize: 12,
      color: Colors.error,
      marginLeft: 6,
      fontWeight: '500',
    },

  });
