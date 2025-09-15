import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    FlatList,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { Colors } from '../constants/Colors';
import { Party, PartyApiService, Payment, PaymentApiService } from '../utils/api';
import { BasePdfGenerator } from '../utils/basePdfGenerator';
import { DocumentService } from '../utils/documentService';
import { PartyManager } from '../utils/partyManager';

export default function PaymentInScreen() {
  const router = useRouter();
  
  // State management
  const [paymentsIn, setPaymentsIn] = useState<Payment[]>([]);
  const [totalPayments, setTotalPayments] = useState(0);
  const [isCreatingPayment, setIsCreatingPayment] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Party management
  const [parties, setParties] = useState<Party[]>([]);
  const [filteredParties, setFilteredParties] = useState<Party[]>([]);
  const [showPartyDropdown, setShowPartyDropdown] = useState(false);
  const [selectedParty, setSelectedParty] = useState<Party | null>(null);
  const [partyNetBalances, setPartyNetBalances] = useState<Record<string, number>>({});
  
  // Modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  
  // Payment form state
  const [paymentForm, setPaymentForm] = useState({
    partyName: '',
    phoneNumber: '',
    received: '',
    totalAmount: '',
  });

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        loadPaymentData(),
        loadParties()
      ]);
    } catch (error) {
      console.error('Error loading initial data:', error);
      Alert.alert('Error', 'Failed to load data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadPaymentData = async () => {
    try {
      const paymentsData = await PaymentApiService.getPaymentInPayments();
      setPaymentsIn(paymentsData);
      
      const total = paymentsData.reduce((sum, payment) => sum + (payment.amount || 0), 0);
      setTotalPayments(total);
    } catch (error) {
      console.error('Error loading payment data:', error);
      throw error;
    }
  };

  const loadParties = async () => {
    try {
      const allParties = await PartyApiService.getParties();
      setParties(allParties);
      
      // Calculate net balances for all parties
      const balances: Record<string, number> = {};
      for (const party of allParties) {
        try {
          const netBalance = await PartyManager.getPartyBalance(party.name, party.phoneNumber);
          balances[`${party.name}-${party.phoneNumber}`] = netBalance;
        } catch (balanceError) {
          console.error(`Error calculating balance for ${party.name}:`, balanceError);
          balances[`${party.name}-${party.phoneNumber}`] = 0;
        }
      }
      setPartyNetBalances(balances);
    } catch (error) {
      console.error('Error loading parties:', error);
      throw error;
    }
  };

  // Helper function to get balance display
  const getBalanceDisplay = (balance: number) => {
    if (balance === 0) {
      return {
        color: Colors.textSecondary,
        text: 'Settled',
        showAmount: false
      };
    } else if (balance > 0) {
      return {
        color: Colors.success,
        text: `₹${balance.toLocaleString()}`,
        showAmount: true
      };
    } else {
      return {
        color: Colors.error,
        text: `₹${Math.abs(balance).toLocaleString()}`,
        showAmount: true
      };
    }
  };

  // Handle party name input with search suggestions
  const handlePartyNameChange = (partyName: string) => {
    setPaymentForm(prev => ({ ...prev, partyName: partyName }));
    
    if (!partyName.trim()) {
      setFilteredParties([]);
      setShowPartyDropdown(false);
      setSelectedParty(null);
      setPaymentForm(prev => ({
        ...prev,
        phoneNumber: '',
        totalAmount: '',
      }));
      return;
    }
    
    // Filter parties based on input
    const filtered = parties.filter(party =>
      party.name.toLowerCase().includes(partyName.toLowerCase())
    );
    
    setFilteredParties(filtered);
    setShowPartyDropdown(filtered.length > 0);
  };

  // Handle party selection from dropdown
  const handlePartySelect = async (party: Party) => {
    setSelectedParty(party);
    
    try {
      // Calculate net balance for this party
      const netBalance = await PartyManager.getPartyBalance(party.name, party.phoneNumber);
      
      setPaymentForm(prev => ({
        ...prev,
        partyName: party.name,
        phoneNumber: party.phoneNumber,
        totalAmount: netBalance > 0 ? netBalance.toString() : '0',
      }));
    } catch (error) {
      console.error('Error calculating party balance:', error);
      setPaymentForm(prev => ({
        ...prev,
        partyName: party.name,
        phoneNumber: party.phoneNumber,
        totalAmount: '0',
      }));
    }
    
    setShowPartyDropdown(false);
  };

  // Create payment
  const handleCreatePayment = async () => {
    // Prevent rapid clicking
    if (isCreatingPayment) {
      return;
    }
    
    setIsCreatingPayment(true);
    
    try {
      // Validate required fields
      const missingFields = [];
      if (!paymentForm.partyName.trim()) missingFields.push('Customer Name');
      if (!paymentForm.phoneNumber.trim()) missingFields.push('Phone Number');
      if (!paymentForm.received.trim()) missingFields.push('Received Amount');
      
      if (missingFields.length > 0) {
        Alert.alert('Error', `Please fill the following required fields:\n• ${missingFields.join('\n• ')}`);
        return;
      }
      
      // Validate numeric fields
      const receivedAmount = parseFloat(paymentForm.received);
      
      if (isNaN(receivedAmount) || receivedAmount <= 0) {
        Alert.alert('Error', 'Please enter a valid received amount');
        return;
      }

      // Create payment
      const newPayment = await PaymentApiService.createPayment({
        type: 'payment-in',
        partyName: paymentForm.partyName.trim(),
        phoneNumber: paymentForm.phoneNumber.trim(),
        amount: receivedAmount,
        totalAmount: receivedAmount,
        date: new Date().toLocaleDateString(),
        description: 'Payment received from customer',
        paymentMethod: 'cash',
      });

      // Generate PDF and send via WhatsApp (non-blocking)
      generateAndSendPDF(newPayment, receivedAmount).catch(error => {
        console.error('Error generating/sending PDF:', error);
        // Don't show error to user as payment creation was successful
      });

      // Reload data
      await Promise.all([
        loadPaymentData(),
        loadParties()
      ]);
      
      // Reset form
      resetForm();
      
      Alert.alert('Success', 'Payment recorded successfully!');
    } catch (error) {
      console.error('Error creating payment:', error);
      Alert.alert('Error', 'Failed to save payment. Please try again.');
    } finally {
      setIsCreatingPayment(false);
    }
  };

  // Generate PDF and send via WhatsApp
  const generateAndSendPDF = async (payment: Payment, amount: number) => {
    try {
      const pdfUri = await BasePdfGenerator.generatePaymentInPDF({
        id: payment.id,
        paymentNo: payment.paymentNo,
        partyName: payment.partyName,
        phoneNumber: payment.phoneNumber,
        received: amount,
        totalAmount: amount,
        date: payment.date,
      });

      if (pdfUri && payment.phoneNumber) {
        const whatsappResult = await DocumentService.sendPaymentReceiptViaWhatsApp(
          payment.phoneNumber,
          pdfUri,
          payment.paymentNo,
          payment.partyName,
          amount
        );

        if (whatsappResult.success) {
          console.log('Payment receipt sent via WhatsApp successfully:', whatsappResult.messageId);
        } else {
          console.warn('Failed to send payment receipt via WhatsApp:', whatsappResult.error);
        }
      }
    } catch (error) {
      console.error('Error in PDF generation/WhatsApp sending:', error);
      throw error;
    }
  };

  // Reset form
  const resetForm = () => {
    setPaymentForm({
      partyName: '',
      phoneNumber: '',
      received: '',
      totalAmount: '',
    });
    setSelectedParty(null);
    setShowPaymentModal(false);
  };

  // Share PDF
  const handleSharePDF = async (payment: Payment) => {
    try {
      const paymentReceipt = {
        id: payment.id,
        paymentNo: payment.paymentNo,
        partyName: payment.partyName,
        phoneNumber: payment.phoneNumber,
        received: payment.amount,
        totalAmount: payment.totalAmount,
        date: payment.date,
      };
      
      const success = await BasePdfGenerator.generateAndSharePaymentReceipt(paymentReceipt);
      if (!success) {
        Alert.alert('Error', 'Failed to generate and share PDF');
      }
    } catch (error) {
      console.error('Error sharing PDF:', error);
      Alert.alert('Error', 'Failed to share PDF');
    }
  };

  // Render payment item
  const renderPaymentItem = ({ item }: { item: Payment }) => {
    const partyKey = `${item.partyName}-${item.phoneNumber}`;
    const currentBalance = partyNetBalances[partyKey] || 0;
    
    return (
      <View style={styles.paymentItem}>
        <View style={styles.paymentHeader}>
          <View style={styles.paymentLeft}>
            <View style={styles.paymentNumberContainer}>
              <Text style={styles.paymentReference}>{item.paymentNo}</Text>
              <View style={styles.paymentNumberBadge}>
                <Text style={styles.paymentNumberBadgeText}>Payment</Text>
              </View>
            </View>
            <Text style={styles.paymentCustomer}>{item.partyName}</Text>
            <Text style={styles.paymentDate}>{item.date}</Text>
          </View>
          <View style={styles.paymentRight}>
            <Text style={[styles.paymentAmount, { color: Colors.success }]}>
              ₹{(item.amount || 0).toLocaleString()}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  // Render party suggestion
  const renderPartySuggestion = ({ item }: { item: Party }) => {
    const partyKey = `${item.name}-${item.phoneNumber}`;
    const netBalance = partyNetBalances[partyKey] || 0;
    const balanceDisplay = getBalanceDisplay(netBalance);
    
    return (
      <TouchableOpacity
        style={styles.partySuggestion}
        onPress={() => handlePartySelect(item)}
      >
        <View style={styles.partySuggestionLeft}>
          <Text style={styles.partySuggestionName}>{item.name}</Text>
          <Text style={styles.partySuggestionPhone}>{item.phoneNumber}</Text>
        </View>
        <View style={styles.partySuggestionRight}>
          <Text style={[
            styles.partySuggestionBalance,
            { color: balanceDisplay.color }
          ]}>
            {balanceDisplay.text}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  // Render payment modal
  const renderPaymentModal = () => (
    <Modal
      visible={showPaymentModal}
      animationType="slide"
      presentationStyle="fullScreen"
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Record Payment In</Text>
          <TouchableOpacity onPress={() => setShowPaymentModal(false)}>
            <Ionicons name="close" size={24} color={Colors.text} />
          </TouchableOpacity>
        </View>
        
        <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
          <View style={styles.formSection}>
            <Text style={styles.modalSectionTitle}>Payment Details</Text>
            
            <View style={styles.partyInputContainer}>
              <Text style={styles.fieldLabel}>Customer Name *</Text>
              <TextInput
                style={[
                  styles.input,
                  selectedParty && styles.autoFilledInput
                ]}
                placeholder="Search party name..."
                placeholderTextColor={Colors.textTertiary}
                value={paymentForm.partyName}
                onChangeText={handlePartyNameChange}
                onFocus={() => {
                  if (paymentForm.partyName.trim()) {
                    setShowPartyDropdown(true);
                  }
                }}
              />
              
              {showPartyDropdown && filteredParties.length > 0 && (
                <View style={styles.partySuggestions}>
                  <FlatList
                    data={filteredParties}
                    renderItem={renderPartySuggestion}
                    keyExtractor={(item) => `payment-in-party-${item.id}`}
                    scrollEnabled={false}
                    showsVerticalScrollIndicator={false}
                  />
                </View>
              )}
              
              {selectedParty && (() => {
                const partyKey = `${selectedParty.name}-${selectedParty.phoneNumber}`;
                const netBalance = partyNetBalances[partyKey] || 0;
                const balanceDisplay = getBalanceDisplay(netBalance);
                
                return (
                  <View style={[
                    styles.selectedPartyInfo,
                    { 
                      backgroundColor: netBalance > 0 
                        ? Colors.success + '10' 
                        : netBalance < 0 
                          ? Colors.error + '10' 
                          : Colors.surfaceVariant 
                    }
                  ]}>
                    <Ionicons 
                      name={netBalance > 0 ? "arrow-up-circle" : netBalance < 0 ? "arrow-down-circle" : "checkmark-circle"} 
                      size={20} 
                      color={netBalance > 0 ? Colors.success : netBalance < 0 ? Colors.error : Colors.textSecondary} 
                    />
                    <Text style={[
                      styles.selectedPartyBalance,
                      { color: balanceDisplay.color }
                    ]}>
                      {netBalance === 0 ? 'All settled up' : `Balance: ${balanceDisplay.text}`}
                    </Text>
                  </View>
                );
              })()}
            </View>
            
            <Text style={styles.fieldLabel}>Phone Number *</Text>
            <TextInput
              style={[
                styles.input,
                selectedParty && styles.autoFilledInput
              ]}
              placeholder="Enter phone number..."
              placeholderTextColor={Colors.textTertiary}
              value={paymentForm.phoneNumber}
              onChangeText={(text) => setPaymentForm(prev => ({ ...prev, phoneNumber: text }))}
              keyboardType="phone-pad"
              editable={!selectedParty}
            />
            {selectedParty && (
              <Text style={styles.helperText}>Auto-filled from party data</Text>
            )}
            
            <Text style={styles.fieldLabel}>Received Amount *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter received amount..."
              placeholderTextColor={Colors.textTertiary}
              value={paymentForm.received}
              onChangeText={(text) => setPaymentForm(prev => ({ ...prev, received: text }))}
              keyboardType="numeric"
            />
            
            {selectedParty && (() => {
              const partyKey = `${selectedParty.name}-${selectedParty.phoneNumber}`;
              const netBalance = partyNetBalances[partyKey] || 0;
              
              return netBalance > 0 ? (
                <View style={styles.balanceInfo}>
                  <Text style={styles.balanceInfoText}>
                    Outstanding Balance: {getBalanceDisplay(netBalance).text}
                  </Text>
                  <Text style={styles.balanceInfoSubtext}>
                    This payment will reduce the outstanding amount
                  </Text>
                </View>
              ) : null;
            })()}
          </View>
        </ScrollView>
        
        <View style={styles.modalFooter}>
          <TouchableOpacity style={styles.cancelButton} onPress={() => setShowPaymentModal(false)}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.createButton, isCreatingPayment && styles.createButtonDisabled]} 
            onPress={handleCreatePayment}
            disabled={isCreatingPayment}
          >
            <Text style={styles.createButtonText}>
              {isCreatingPayment ? 'Recording...' : 'Record Payment'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
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
        <Text style={styles.headerTitle}>Payment In</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header Stats */}
        <View style={styles.headerStats}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{paymentsIn.length}</Text>
            <Text style={styles.statLabel}>Total Payments</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>₹{(totalPayments || 0).toLocaleString()}</Text>
            <Text style={styles.statLabel}>Total Received</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{parties.length}</Text>
            <Text style={styles.statLabel}>Total Parties</Text>
          </View>
        </View>

        {/* Action Button */}
        <View style={styles.actionContainer}>
          <TouchableOpacity 
            style={styles.createButton} 
            onPress={() => setShowPaymentModal(true)}
          >
            <Ionicons name="add-circle" size={24} color={Colors.text} />
            <Text style={styles.createButtonText}>Record Payment In</Text>
          </TouchableOpacity>
        </View>

        {/* Payments List */}
        <View style={styles.listContainer}>
          <Text style={styles.sectionTitle}>Recent Payments</Text>
          {paymentsIn.length > 0 ? (
            <FlatList
              data={paymentsIn.slice(0, 20)}
              renderItem={renderPaymentItem}
              keyExtractor={(item) => `payment-in-list-${item.id}`}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
            />
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="card-outline" size={64} color={Colors.textTertiary} />
              <Text style={styles.emptyStateTitle}>No Payments Yet</Text>
              <Text style={styles.emptyStateSubtitle}>Record your first payment to get started</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {renderPaymentModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.textSecondary,
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
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
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
  actionContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  createButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButtonDisabled: {
    backgroundColor: Colors.textTertiary,
    opacity: 0.6,
  },
  createButtonText: {
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
  paymentItem: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  paymentLeft: {
    flex: 1,
  },
  paymentReference: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  paymentNumberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  paymentNumberBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  paymentNumberBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.text,
    textTransform: 'uppercase',
  },
  paymentCustomer: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 2,
  },
  paymentDate: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  paymentRight: {
    alignItems: 'flex-end',
  },
  paymentAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  paymentActions: {
    marginTop: 12,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.success + '10',
    borderWidth: 1,
    borderColor: Colors.success + '30',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 4,
  },
  shareButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.success,
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
    paddingBottom: 100, // Space for fixed footer
  },
  formSection: {
    marginBottom: 20,
  },
  modalSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 16,
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
  autoFilledInput: {
    backgroundColor: Colors.success + '10',
    borderColor: Colors.success + '30',
  },
  helperText: {
    fontSize: 11,
    color: Colors.success,
    marginTop: -12,
    marginBottom: 16,
    marginLeft: 4,
    fontStyle: 'italic',
  },
  modalFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 20,
    paddingBottom: 34, // Safe area bottom
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
    zIndex: 1000,
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
  partyInputContainer: {
    position: 'relative',
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
    maxHeight: 200,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  partySuggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  partySuggestionLeft: {
    flex: 1,
  },
  partySuggestionName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  partySuggestionPhone: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  partySuggestionRight: {
    alignItems: 'flex-end',
  },
  partySuggestionBalance: {
    fontSize: 14,
    fontWeight: '600',
  },
  selectedPartyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginBottom: 16,
    gap: 8,
  },
  selectedPartyBalance: {
    fontSize: 12,
    fontWeight: '500',
  },
  balanceInfo: {
    backgroundColor: Colors.surfaceVariant,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  balanceInfoText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  balanceInfoSubtext: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
});