import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Platform,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { Colors } from '../constants/Colors';
import { Party, PartyApiService } from '../utils/api';

// Android-specific utilities
const isAndroid = Platform.OS === 'android';
const { width, height } = Dimensions.get('window');

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

interface PartyTransaction {
  id: string;
  type: 'sale' | 'purchase' | 'payment-in' | 'payment-out';
  transactionId: string;
  partyName: string;
  phoneNumber: string;
  totalAmount?: number;
  amount?: number;
  date: string;
  pdfUri?: string;
  description?: string;
  paymentMethod?: string;
  reference?: string;
  createdAt: string;
  updatedAt: string;
  items?: any[];
}

export default function PartyTransactionsScreen() {
  const { partyId } = useLocalSearchParams<{ partyId: string }>();
  const [party, setParty] = useState<Party | null>(null);
  const [transactions, setTransactions] = useState<PartyTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (partyId) {
      loadPartyTransactions();
    } else {
      Alert.alert('Error', 'No party ID received');
    }
  }, [partyId]);

  const loadPartyTransactions = async () => {
    if (!partyId) return;
    
    try {
      setLoading(true);
      const response = await PartyApiService.getPartyTransactions(partyId);
      setParty(response.party);
      setTransactions(response.transactions);
    } catch (error) {
      console.error('Error loading party transactions:', error);
      Alert.alert('Error', 'Failed to load party transactions');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadPartyTransactions();
    setRefreshing(false);
  }, [partyId]);

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'sale':
        return Colors.success;
      case 'purchase':
        return Colors.warning;
      case 'payment-in':
        return Colors.primary;
      case 'payment-out':
        return Colors.error;
      default:
        return Colors.textSecondary;
    }
  };

  const formatTransactionReference = (transaction: PartyTransaction) => {
    const reference = transaction.transactionId || transaction.reference || '';
    
    switch (transaction.type) {
      case 'sale':
        return reference.startsWith('INV-') ? reference : `INV-${reference}`;
      case 'purchase':
        return reference.startsWith('BILL-') ? reference : `BILL-${reference}`;
      case 'payment-in':
        return reference.startsWith('PAY-IN-') ? reference : `PAY-IN-${reference}`;
      case 'payment-out':
        return reference.startsWith('PAY-OUT-') ? reference : `PAY-OUT-${reference}`;
      default:
        return reference;
    }
  };

  const formatAmount = (transaction: PartyTransaction) => {
    const amount = transaction.totalAmount || transaction.amount || 0;
    return `₹${amount.toLocaleString()}`;
  };

  const TransactionItem = ({ transaction }: { transaction: PartyTransaction }) => {
    const iconColor = getTransactionColor(transaction.type);
    const reference = formatTransactionReference(transaction);

    return (
      <View style={styles.transactionItem}>
        <View style={styles.transactionRow}>
          <Text style={styles.transactionType}>{reference}</Text>
          <Text style={[styles.amountText, { color: iconColor }]}>
            {formatAmount(transaction)}
          </Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={isAndroid ? 0.7 : 0.2}
            {...(isAndroid && {
              android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
            })}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Loading...</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading transactions...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!party) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={isAndroid ? 0.7 : 0.2}
            {...(isAndroid && {
              android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
            })}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Party Not Found</Text>
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={Colors.error} />
          <Text style={styles.errorTitle}>Party Not Found</Text>
          <Text style={styles.errorSubtitle}>The requested party could not be found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={isAndroid ? 0.7 : 0.2}
          {...(isAndroid && {
            android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
          })}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>{party.name}</Text>
          <Text style={styles.headerSubtitle}>{party.phoneNumber}</Text>
        </View>
      </View>

      {/* Party Info */}
      <View style={styles.partyInfoContainer}>
        <View style={styles.balanceContainer}>
          <Text style={styles.balanceLabel}>Current Balance</Text>
          <Text style={[
            styles.balanceAmount,
            { color: party.balance >= 0 ? Colors.success : Colors.error }
          ]}>
            ₹{Math.abs(party.balance).toLocaleString()}
          </Text>
          <Text style={[
            styles.balanceDirection,
            { color: party.balance >= 0 ? Colors.success : Colors.error }
          ]}>
            {party.balance >= 0 ? 'Party owes you' : 'You owe party'}
          </Text>
        </View>
      </View>

      {/* Transactions List */}
      <View style={styles.transactionsContainer}>
        <Text style={styles.sectionTitle}>
          All Transactions ({transactions.length})
        </Text>
        
        {transactions.length > 0 ? (
          <FlatList
            data={transactions}
            renderItem={({ item }) => <TransactionItem transaction={item} />}
            keyExtractor={(item) => `party-transaction-${item.id}`}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[Colors.primary]} // Android
                tintColor={Colors.primary} // iOS
              />
            }
            // Android-specific: Optimize scrolling
            {...(isAndroid && {
              overScrollMode: 'never',
              nestedScrollEnabled: true,
            })}
          />
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="document-outline" size={64} color={Colors.textTertiary} />
            <Text style={styles.emptyStateTitle}>No Transactions</Text>
            <Text style={styles.emptyStateSubtitle}>
              This party has no transactions yet.
            </Text>
          </View>
        )}
      </View>
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
    padding: 20,
    paddingTop: isAndroid ? 60 : 20, // Increased padding for Android status bar
    backgroundColor: Colors.surface,
    // Android-specific: Add elevation
    ...(isAndroid && {
      elevation: ANDROID_CONSTANTS.elevation.low,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.22,
      shadowRadius: 2.22,
    }),
  },
  backButton: {
    padding: 8,
    marginRight: 12,
    // Android-specific: Ensure minimum touch target
    minWidth: ANDROID_CONSTANTS.touchTargetMinSize,
    minHeight: ANDROID_CONSTANTS.touchTargetMinSize,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  partyInfoContainer: {
    padding: 20,
    backgroundColor: Colors.surface,
    marginBottom: 20,
    // Android-specific: Add elevation
    ...(isAndroid && {
      elevation: ANDROID_CONSTANTS.elevation.low,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.22,
      shadowRadius: 2.22,
    }),
  },
  balanceContainer: {
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  balanceAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  balanceDirection: {
    fontSize: 12,
    fontWeight: '500',
  },
  transactionsContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 16,
  },
  transactionItem: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    // Android-specific: Add elevation and optimize touch
    ...(isAndroid && {
      elevation: ANDROID_CONSTANTS.elevation.low,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.22,
      shadowRadius: 2.22,
    }),
  },
  transactionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  transactionType: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  amountText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 16,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.error,
    marginTop: 16,
    marginBottom: 8,
  },
  errorSubtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
