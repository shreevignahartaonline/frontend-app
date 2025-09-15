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
import { Party, PartyApiService, PaymentApiService, PurchaseApiService, PurchaseBill, PurchaseItem } from '../../utils/api';
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

// PurchaseBill and PurchaseItem interfaces are now imported from api.ts

export default function PurchaseScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [purchaseBills, setPurchaseBills] = useState<PurchaseBill[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  
  // Modal states
  const [showBillModal, setShowBillModal] = useState(false);
  
  // Bill form states
  const [billForm, setBillForm] = useState({
    partyName: '',
    phoneNumber: '',
    items: [] as PurchaseItem[],
  });

  // Dropdown visibility state
  const [showPartyDropdown, setShowPartyDropdown] = useState(false);
  
  // Auto-generated bill number
  const [generatedBillNo, setGeneratedBillNo] = useState<string>('');
  
  // Selected party balance state
  const [selectedPartyBalance, setSelectedPartyBalance] = useState<number | null>(null);
  
  // Party balances state for dropdown suggestions
  const [partyBalances, setPartyBalances] = useState<Record<string, number>>({});

  useEffect(() => {
    loadPurchaseData();
    loadParties();
  }, []);

  // Generate bill number when purchase data changes
  useEffect(() => {
    setGeneratedBillNo(generateNextBillNumber());
  }, [purchaseBills]);

  // Reload parties when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadParties();
    }, [])
  );

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
            if (isRecent) {
              // Add the selected items to the current bill form
              setBillForm(prev => ({
                ...prev,
                items: [...prev.items, ...tempData.items]
              }));
              
              // Recalculate total
              const newTotal = billForm.items.reduce((sum: number, item: PurchaseItem) => sum + item.total, 0) + 
                             tempData.items.reduce((sum: number, item: any) => sum + item.total, 0);
              setBillForm(prev => ({ ...prev, totalAmount: newTotal }));
              
              // Reopen the modal since it was closed when navigating to add-items
              setShowBillModal(true);
              
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

  const loadPurchaseData = async () => {
    try {
      const billsData = await PurchaseApiService.getPurchases();
      const paymentsData = await PaymentApiService.getPayments({ type: 'payment-out' });
      
      setPurchaseBills(billsData || []);
    } catch (error) {
      console.error('Error loading purchase data:', error);
    }
  };



  const loadParties = async () => {
    try {
      const partiesData = await PartyApiService.getParties();
      setParties(partiesData);
      
      // Calculate latest balances for all parties
      await calculatePartyBalances(partiesData);
    } catch (error) {
      console.error('Error loading parties:', error);
    }
  };

  // Calculate latest party balance for each party
  const calculatePartyBalances = async (partiesData: Party[]) => {
    try {
      const balances: Record<string, number> = {};
      
      // Calculate balance for each party
      for (const party of partiesData) {
        const balance = await PartyManager.getPartyBalance(party.name, party.phoneNumber);
        const partyKey = `${party.name}-${party.phoneNumber}`;
        balances[partyKey] = balance;
      }
      
      setPartyBalances(balances);
    } catch (error) {
      console.error('Error calculating party balances:', error);
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

  // Generate next bill number
  const generateNextBillNumber = (): string => {
    if (purchaseBills.length === 0) {
      return '1';
    }
    
    const maxNumber = Math.max(...purchaseBills.map(bill => {
      const billNo = bill.billNo || '0';
      return parseInt(billNo, 10) || 0;
    }));
    
    return (maxNumber + 1).toString();
  };

  // Reset form function
  const resetForm = () => {
    setBillForm({
      partyName: '',
      phoneNumber: '',
      items: [],
    });
    setShowPartyDropdown(false);
    setSelectedPartyBalance(null);
    setShowBillModal(false);
  };

  const addBillItem = () => {
    setShowBillModal(false);
    // Navigate to add-items screen with purchase mode
    // Note: Mode will be passed via navigation params instead of storage
    setTimeout(() => {
      router.push('/add-items?mode=purchase');
    }, 100);
  };

  const updateBillItem = (index: number, field: keyof PurchaseItem, value: any) => {
    setBillForm(prev => {
      const updatedItems = [...prev.items];
      updatedItems[index] = { ...updatedItems[index], [field]: value };
      
      // Recalculate total for this item
      if (field === 'quantity' || field === 'rate') {
        updatedItems[index].total = (updatedItems[index].quantity || 0) * (updatedItems[index].rate || 0);
      }
      
      return { ...prev, items: updatedItems };
    });
  };

  const removeBillItem = (index: number) => {
    setBillForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const calculateBillTotal = (): number => {
    return billForm.items.reduce((sum: number, item: PurchaseItem) => sum + (item.total || 0), 0);
  };

  const handleCreateBill = async () => {
    // Validation
    if (!billForm.partyName.trim() || !billForm.phoneNumber.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (billForm.items.length === 0) {
      Alert.alert('Error', 'Please add at least one item');
      return;
    }

    // Check if this is an existing party and get their latest balance
    const existingParty = parties.find(party => 
      party.name.toLowerCase() === billForm.partyName.toLowerCase() &&
      party.phoneNumber === billForm.phoneNumber
    );

    if (existingParty) {
      const partyKey = `${existingParty.name}-${existingParty.phoneNumber}`;
      const latestBalance = partyBalances[partyKey] ?? existingParty.balance;
      
      if (latestBalance > 0) {
        Alert.alert(
          'Party Has Outstanding Balance',
          `${billForm.partyName} has an outstanding balance of ₹${latestBalance.toLocaleString()}. Do you want to proceed with creating this bill?`,
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Proceed',
              onPress: () => createBill(),
            },
          ]
        );
        return;
      }
    }

    // If no outstanding balance or new party, proceed directly
    createBill();
  };

  const createBill = async () => {
    try {
      // Create purchase bill via API
      const newBill = await PurchaseApiService.createPurchase({
        partyName: billForm.partyName,
        phoneNumber: billForm.phoneNumber,
        items: billForm.items,
        totalAmount: calculateBillTotal(),
        date: new Date().toLocaleDateString(),
      });

      // Generate PDF in the background
      let pdfUri: string | undefined;
      try {
        const generatedPdfUri = await BasePdfGenerator.generatePurchaseBillPDF(newBill);
        if (generatedPdfUri) {
          pdfUri = generatedPdfUri;
          
          // Update the bill with PDF URI
          await PurchaseApiService.updatePurchase(newBill.id, { pdfUri });
          
          // Add a small delay to ensure file is fully written
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          console.error('PDF generation returned null');
        }
      } catch (error) {
        console.error('Error generating PDF:', error);
        // Continue even if PDF generation fails
      }

      // Send purchase bill via WhatsApp if PDF was generated successfully
      if (pdfUri && billForm.phoneNumber) {
        try {
          const whatsappResult = await DocumentService.sendPurchaseBillViaWhatsApp(
            billForm.phoneNumber,
            pdfUri,
            newBill.billNo,
            billForm.partyName,
            calculateBillTotal()
          );

          if (whatsappResult.success) {
            console.log('Purchase bill sent via WhatsApp successfully:', whatsappResult.messageId);
          } else {
            console.warn('Failed to send purchase bill via WhatsApp:', whatsappResult.error);
          }
        } catch (whatsappError) {
          console.error('Error sending purchase bill via WhatsApp:', whatsappError);
          // Don't show error to user as bill creation was successful
        }
      }

      // Reload purchase data to get the latest from API
      await loadPurchaseData();
      
      // Reset form
      resetForm();
      
      Alert.alert('Success', 'Purchase bill created successfully!');
    } catch (error) {
      console.error('Error creating bill:', error);
      Alert.alert('Error', 'Failed to create purchase bill. Please try again.');
    }
  };


  const renderBillItem = ({ item, index }: { item: PurchaseItem; index: number }) => {
    return (
      <View style={styles.billItemContainer}>
        <View style={styles.billItemRow}>
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
            onPress={() => removeBillItem(index)}
          >
            <Ionicons name="close-circle" size={20} color={Colors.error} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.billItemDetails}>
          <View style={styles.quantityContainer}>
            <Text style={styles.fieldLabel}>Quantity</Text>
            <TextInput
              style={[styles.input, styles.quantityInput]}
              placeholder="Qty"
              placeholderTextColor={Colors.textTertiary}
              value={item.quantity.toString()}
              onChangeText={(text) => {
                const qty = parseInt(text) || 0;
                updateBillItem(index, 'quantity', qty);
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
              onChangeText={(text) => updateBillItem(index, 'rate', parseFloat(text) || 0)}
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

  const renderBillModal = () => (
    <Modal
      isVisible={showBillModal}
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
            <Text style={styles.modalTitle}>Purchase Bill</Text>
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
            <View style={styles.billBalanceRow}>
              <View style={styles.billNumberLeft}>
                <Text style={styles.billNumberLabel}>Bill No:</Text>
                <Text style={styles.billNumberValue}>#{generatedBillNo}</Text>
              </View>
              {selectedPartyBalance !== null && (
                <View key="party-balance" style={styles.balanceDisplayWithSpacing}>
                  <Text style={styles.balanceLabel}>Balance Amount:</Text>
                  <Text style={[
                    styles.balanceAmount,
                    { color: getBalanceDisplay(selectedPartyBalance).color }
                  ]}>
                    {getBalanceDisplay(selectedPartyBalance).text}
                  </Text>
                </View>
              )}
            </View>
            
            <View style={styles.partyInputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Party Name"
                placeholderTextColor={Colors.textTertiary}
                value={billForm.partyName}
                onChangeText={(text) => {
                  setBillForm(prev => ({ ...prev, partyName: text }));
                  setShowPartyDropdown(true);
                }}
                onFocus={() => setShowPartyDropdown(true)}
              />
              {showPartyDropdown && billForm.partyName.length > 0 && (() => {
                const matchingParties = parties.filter(party =>
                  party.name.toLowerCase().includes(billForm.partyName.toLowerCase())
                );
                
                if (matchingParties.length === 0) {
                  return null; // Don't show dropdown if no matches
                }
                
                return (
                  <View key="party-suggestions" style={styles.partySuggestions}>
                    {matchingParties.length > 3 ? (
                      <ScrollView 
                        style={styles.suggestionsScrollView}
                        showsVerticalScrollIndicator={true}
                        nestedScrollEnabled={true}
                      >
                        {matchingParties.map((party, index) => (
                          <TouchableOpacity
                            key={party.id || `purchase-party-${index}`}
                            style={styles.suggestionItem}
                            onPress={() => {
                              const partyKey = `${party.name}-${party.phoneNumber}`;
                              const latestBalance = partyBalances[partyKey] ?? party.balance;
                              
                              setBillForm(prev => ({
                                ...prev,
                                partyName: party.name,
                                phoneNumber: party.phoneNumber,
                              }));
                              setSelectedPartyBalance(latestBalance);
                              setShowPartyDropdown(false);
                            }}
                            activeOpacity={isAndroid ? 0.7 : 0.2}
                            {...(isAndroid && {
                              android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
                            })}
                          >
                            <Text style={styles.suggestionName}>{party.name}</Text>
                            <Text style={[
                              styles.suggestionAmount,
                              { color: getBalanceDisplay(partyBalances[`${party.name}-${party.phoneNumber}`] ?? party.balance).color }
                            ]}>
                              {getBalanceDisplay(partyBalances[`${party.name}-${party.phoneNumber}`] ?? party.balance).text}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    ) : (
                      // Show first 3 parties without scroll when 3 or fewer
                      matchingParties.slice(0, 3).map((party, index) => (
                        <TouchableOpacity
                          key={party.id || `purchase-party-short-${index}`}
                          style={styles.suggestionItem}
                          onPress={() => {
                            const partyKey = `${party.name}-${party.phoneNumber}`;
                            const latestBalance = partyBalances[partyKey] ?? party.balance;
                            
                            setBillForm(prev => ({
                              ...prev,
                              partyName: party.name,
                              phoneNumber: party.phoneNumber,
                            }));
                            setSelectedPartyBalance(latestBalance);
                            setShowPartyDropdown(false);
                          }}
                          activeOpacity={isAndroid ? 0.7 : 0.2}
                          {...(isAndroid && {
                            android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
                          })}
                        >
                          <Text style={styles.suggestionName}>{party.name}</Text>
                          <Text style={[
                            styles.suggestionAmount,
                            { color: getBalanceDisplay(partyBalances[`${party.name}-${party.phoneNumber}`] ?? party.balance).color }
                          ]}>
                            {getBalanceDisplay(partyBalances[`${party.name}-${party.phoneNumber}`] ?? party.balance).text}
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
              value={billForm.phoneNumber}
              onChangeText={(text) => setBillForm(prev => ({ ...prev, phoneNumber: text }))}
              keyboardType="phone-pad"
            />
          </View>
          
          <View style={styles.formSection}>
            <TouchableOpacity 
              style={styles.fullWidthAddItemsButton} 
              onPress={() => {
                setShowBillModal(false);
                // Navigate to add-items screen with purchase mode
                setTimeout(() => {
                  router.push('/add-items?mode=purchase');
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
              data={billForm.items}
              renderItem={renderBillItem}
              keyExtractor={(item, index) => item.id || `bill-item-${index}`}
              scrollEnabled={false}
            />
            
            {billForm.items.length > 0 && (
              <View style={styles.totalSection}>
                <Text style={styles.totalLabel}>Total Amount:</Text>
                <Text style={styles.totalAmount}>₹{calculateBillTotal()}</Text>
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
              onPress={handleCreateBill}
              activeOpacity={isAndroid ? 0.7 : 0.2}
              {...(isAndroid && {
                android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
              })}
            >
              <Text style={styles.createButtonText}>Create Bill</Text>
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
          <Text style={styles.companyName}>Purchases</Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
                  <TouchableOpacity 
          style={styles.primaryButton} 
          onPress={() => setShowBillModal(true)}
          activeOpacity={isAndroid ? 0.7 : 0.2}
          {...(isAndroid && {
            android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
          })}
        >
          <Ionicons name="add" size={20} color={Colors.text} />
          <Text style={styles.primaryButtonText}>New Bill</Text>
        </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.primaryButton, { backgroundColor: Colors.error }]} 
            onPress={() => router.push('/payment-out')}
            activeOpacity={isAndroid ? 0.7 : 0.2}
            {...(isAndroid && {
              android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
            })}
          >
            <Ionicons name="arrow-up-circle" size={20} color={Colors.text} />
            <Text style={styles.primaryButtonText}>Payment Out</Text>
          </TouchableOpacity>
        </View>
        


        {/* Bills List */}
        <View style={styles.listContainer}>
          <Text style={styles.sectionTitle}>Recent Bills</Text>
          {purchaseBills.length > 0 ? (
            purchaseBills.slice(0, 10).map((bill, index) => (
              <TouchableOpacity 
                key={bill.id || `purchase-bill-${index}`} 
                style={styles.listItem}
                onPress={() => router.push(`/edit-purchase?billId=${bill.id}`)}
                activeOpacity={isAndroid ? 0.7 : 0.2}
                {...(isAndroid && {
                  android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
                })}
              >
                <View style={styles.listItemHeader}>
                  <Text style={styles.listItemTitle}>#{bill.billNo}</Text>
                  <Text style={styles.listItemAmount}>₹{bill.totalAmount}</Text>
                </View>
                <Text style={styles.listItemSubtitle}>{bill.partyName}</Text>
                <Text style={styles.listItemDate}>{bill.date}</Text>
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={64} color={Colors.textTertiary} />
              <Text style={styles.emptyStateTitle}>No Bills Yet</Text>
              <Text style={styles.emptyStateSubtitle}>
                Create your first purchase bill to get started
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {renderBillModal()}
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
    fontSize: 18,
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
    color: Colors.error,
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
  billItemContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  billItemRow: {
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
  billItemDetails: {
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
    color: Colors.error,
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

  // Party suggestions styles
  partyInputContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  partySuggestions: {
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
  billBalanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 20,
    marginBottom: 16,
    paddingHorizontal: 2,
  },
  billNumberLeft: {
    alignItems: 'flex-start',
  },
  billNumberLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 2,
    fontWeight: '500',
  },
  billNumberValue: {
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
