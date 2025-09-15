import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
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

export default function EditPayInScreen() {
  const router = useRouter();
  const { paymentId } = useLocalSearchParams<{ paymentId: string }>();
  const [payment, setPayment] = useState<Payment | null>(null);
  
  // Form states
  const [formData, setFormData] = useState({
    paymentNo: '',
    partyName: '',
    phoneNumber: '',
    received: '',
    totalAmount: '',
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
          partyName: foundPayment.partyName,
          phoneNumber: foundPayment.phoneNumber,
          received: foundPayment.amount.toString(),
          totalAmount: foundPayment.totalAmount.toString(),
          date: foundPayment.date,
        });
      } else {
        Alert.alert('Error', 'Payment not found');
        router.back();
      }
    } catch (error) {
      console.error('Error loading payment:', error);
      Alert.alert('Error', 'Failed to load payment');
    }
  };

  const handleSavePayment = async () => {
    if (!payment || !formData.partyName || !formData.phoneNumber || !formData.received) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }

    const received = parseFloat(formData.received);
    const totalAmount = parseFloat(formData.totalAmount || '0');

    if (isNaN(received) || received <= 0) {
      Alert.alert('Error', 'Please enter a valid received amount');
      return;
    }

    try {
      // Calculate the difference in amount to update party balance
      const originalAmount = payment.amount;
      const amountDifference = received - originalAmount;

      // Update the payment
      await PaymentApiService.updatePayment(paymentId!, {
        partyName: formData.partyName,
        phoneNumber: formData.phoneNumber,
        amount: received,
        totalAmount,
        date: formData.date,
        description: 'Payment received from customer',
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
            // Payment In reduces party balance, so subtract the difference
            await PartyApiService.updatePartyBalance(party.id, Math.abs(amountDifference), 'subtract');
          }
        } catch (balanceError) {
          console.error('Error updating party balance:', balanceError);
          // Don't fail the entire operation if balance update fails
        }
      }
      
      Alert.alert('Success', 'Payment updated successfully!');
      router.back();
    } catch (error) {
      console.error('Error updating payment:', error);
      Alert.alert('Error', 'Failed to update payment');
    }
  };

  if (!payment) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Payment In</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
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
        <Text style={styles.headerTitle}>Edit Payment In</Text>
        <TouchableOpacity onPress={handleSavePayment} style={styles.saveButton}>
          <Ionicons name="checkmark" size={24} color={Colors.success} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        style={styles.content} 
        behavior="padding"
        keyboardVerticalOffset={100}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Payment Details */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment Details</Text>
            
            <Text style={styles.fieldLabel}>Payment Number</Text>
            <TextInput
              style={[styles.input, styles.disabledInput]}
              placeholder="Payment number..."
              placeholderTextColor={Colors.textTertiary}
              value={formData.paymentNo}
              onChangeText={(text) => setFormData(prev => ({ ...prev, paymentNo: text }))}
              editable={false}
            />
            
            <Text style={styles.fieldLabel}>Customer Name *</Text>
            <TextInput
              style={[styles.input, styles.disabledInput]}
              placeholder="Enter customer name..."
              placeholderTextColor={Colors.textTertiary}
              value={formData.partyName}
              onChangeText={(text) => setFormData(prev => ({ ...prev, partyName: text }))}
              editable={false}
            />
            
            <Text style={styles.fieldLabel}>Phone Number *</Text>
            <TextInput
              style={[styles.input, styles.disabledInput]}
              placeholder="Enter phone number..."
              placeholderTextColor={Colors.textTertiary}
              value={formData.phoneNumber}
              onChangeText={(text) => setFormData(prev => ({ ...prev, phoneNumber: text }))}
              keyboardType="phone-pad"
              editable={false}
            />
            
            <Text style={styles.fieldLabel}>Received Amount *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter received amount..."
              placeholderTextColor={Colors.textTertiary}
              value={formData.received}
              onChangeText={(text) => setFormData(prev => ({ ...prev, received: text }))}
              keyboardType="numeric"
            />
            
            <Text style={styles.fieldLabel}>Date</Text>
            <TextInput
              style={[styles.input, styles.disabledInput]}
              placeholder="Enter date..."
              placeholderTextColor={Colors.textTertiary}
              value={formData.date}
              onChangeText={(text) => setFormData(prev => ({ ...prev, date: text }))}
              editable={false}
            />
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

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
    backgroundColor: 'transparent',
    borderRadius: 0,
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
  },
  sectionTitle: {
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
  disabledInput: {
    backgroundColor: Colors.surfaceVariant,
    color: Colors.textSecondary,
  },
});
