import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { Colors } from '../constants/Colors';
import { PartyApiService, Payment, PaymentApiService } from '../utils/api';

// Using the unified Payment interface from api.ts

export default function EditPayoutScreen() {
  const router = useRouter();
  const { paymentId } = useLocalSearchParams<{ paymentId: string }>();
  
  const [payment, setPayment] = useState<Payment | null>(null);
  const [formData, setFormData] = useState({
    paymentNo: '',
    partyName: '',
    phoneNumber: '',
    paid: '',
    date: '',
  });

  useEffect(() => {
    if (paymentId) {
      loadPayment();
    }
  }, [paymentId]);

  const loadPayment = async () => {
    try {
      const foundPayment = await PaymentApiService.getPaymentById(paymentId!);
      
      if (foundPayment) {
        setPayment(foundPayment);
        setFormData({
          paymentNo: foundPayment.paymentNo || '',
          partyName: foundPayment.partyName || '',
          phoneNumber: foundPayment.phoneNumber || '',
          paid: foundPayment.amount?.toString() || '',
          date: foundPayment.date || '',
        });
      } else {
        Alert.alert('Error', 'Payment not found');
        router.back();
      }
    } catch (error) {
      console.error('Error loading payment:', error);
      Alert.alert('Error', 'Failed to load payment');
      router.back();
    }
  };

  const handleSavePayment = async () => {
    if (!payment) return;

    // Validate required fields
    const missingFields = [];
    if (!formData.partyName.trim()) missingFields.push('Supplier Name');
    if (!formData.phoneNumber.trim()) missingFields.push('Phone Number');
    if (!formData.paid.trim()) missingFields.push('Paid Amount');
    
    if (missingFields.length > 0) {
      Alert.alert('Error', `Please fill the following required fields:\n• ${missingFields.join('\n• ')}`);
      return;
    }

    const paidAmount = parseFloat(formData.paid);
    if (isNaN(paidAmount) || paidAmount <= 0) {
      Alert.alert('Error', 'Please enter a valid paid amount');
      return;
    }

    try {
      // Calculate the difference in amount to update party balance
      const originalAmount = payment.amount;
      const amountDifference = paidAmount - originalAmount;

      // Update the payment
      await PaymentApiService.updatePayment(paymentId!, {
        partyName: formData.partyName,
        phoneNumber: formData.phoneNumber,
        amount: paidAmount,
        date: formData.date,
        description: 'Payment made to supplier',
        paymentMethod: 'cash',
      });

      // Update party balance if amount changed
      if (amountDifference !== 0) {
        try {
          // Find the party to get their ID
          const parties = await PartyApiService.getParties();
          const party = parties.find(p => 
            p.name === formData.partyName && p.phoneNumber === formData.phoneNumber
          );
          
          if (party) {
            // Payment Out increases party balance, so add the difference
            await PartyApiService.updatePartyBalance(party.id, Math.abs(amountDifference), 'add');
          }
        } catch (balanceError) {
          console.error('Error updating party balance:', balanceError);
          // Don't fail the entire operation if balance update fails
        }
      }
      
      Alert.alert('Success', 'Payment updated successfully!');
      router.back();
    } catch (error) {
      console.error('Error saving payment:', error);
      Alert.alert('Error', 'Failed to save payment');
    }
  };

  if (!payment) {
    return (
      <View style={styles.container}>
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
        <Text style={styles.headerTitle}>Edit Payment Out</Text>
        <TouchableOpacity onPress={handleSavePayment} style={styles.headerSaveButton}>
          <Ionicons name="checkmark" size={24} color={Colors.success} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Edit Payment Details</Text>
          
          <Text style={styles.fieldLabel}>Payment Number</Text>
          <TextInput
            style={[styles.input, styles.disabledInput]}
            value={formData.paymentNo}
            onChangeText={(text) => setFormData(prev => ({ ...prev, paymentNo: text }))}
            placeholder="Payment Number"
            placeholderTextColor={Colors.textTertiary}
            editable={false}
          />

          <Text style={styles.fieldLabel}>Supplier Name *</Text>
          <TextInput
            style={[styles.input, styles.disabledInput]}
            value={formData.partyName}
            onChangeText={(text) => setFormData(prev => ({ ...prev, partyName: text }))}
            placeholder="Enter supplier name"
            placeholderTextColor={Colors.textTertiary}
            editable={false}
          />

          <Text style={styles.fieldLabel}>Phone Number *</Text>
          <TextInput
            style={[styles.input, styles.disabledInput]}
            value={formData.phoneNumber}
            onChangeText={(text) => setFormData(prev => ({ ...prev, phoneNumber: text }))}
            placeholder="Enter phone number"
            placeholderTextColor={Colors.textTertiary}
            keyboardType="phone-pad"
            editable={false}
          />

          <Text style={styles.fieldLabel}>Paid Amount *</Text>
          <TextInput
            style={styles.input}
            value={formData.paid}
            onChangeText={(text) => setFormData(prev => ({ ...prev, paid: text }))}
            placeholder="Enter paid amount"
            placeholderTextColor={Colors.textTertiary}
            keyboardType="numeric"
          />

          <Text style={styles.fieldLabel}>Date</Text>
          <TextInput
            style={[styles.input, styles.disabledInput]}
            value={formData.date}
            onChangeText={(text) => setFormData(prev => ({ ...prev, date: text }))}
            placeholder="Enter date"
            placeholderTextColor={Colors.textTertiary}
            editable={false}
          />
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
  headerSaveButton: {
    padding: 8,
    backgroundColor: 'transparent',
    borderRadius: 0,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 100,
    fontSize: 16,
    color: Colors.textSecondary,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 16,
  },
  formSection: {
    marginBottom: 24,
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
  disabledInput: {
    backgroundColor: Colors.surfaceVariant,
    color: Colors.textSecondary,
  },
});
