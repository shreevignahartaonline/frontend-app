import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { Colors } from '../constants/Colors';
import { Messages } from '../constants/Messages';
import { CompanyApiService, CompanyDetails, handleApiError } from '../utils/api';

export default function CompanyDetailsScreen() {
  const router = useRouter();
  const [companyDetails, setCompanyDetails] = useState<CompanyDetails>({
    businessName: '',
    phoneNumber1: '',
    phoneNumber2: '',
    emailId: '',
    businessAddress: '',
    pincode: '',
    businessDescription: '',
    signature: '',
  });
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signaturePath, setSignaturePath] = useState('');
  const [completionPercentage, setCompletionPercentage] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Android-specific constants
  const isAndroid = Platform.OS === 'android';
  const statusBarHeight = isAndroid ? 24 : 0;
  const navBarHeight = isAndroid ? 48 : 0;

  useEffect(() => {
    loadCompanyDetails();
  }, []);

  useEffect(() => {
    calculateCompletionPercentage();
  }, [companyDetails]);

  const loadCompanyDetails = async () => {
    setIsLoading(true);
    try {
      const details = await CompanyApiService.getCompanyDetails();
      setCompanyDetails(details);
    } catch (error) {
      console.error('Error loading company details:', error);
      // If company details don't exist, load default template
      try {
        const defaultDetails = await CompanyApiService.getDefaultCompanyDetails();
        setCompanyDetails(defaultDetails);
      } catch (defaultError) {
        console.error('Error loading default company details:', defaultError);
        Alert.alert(
          'Error',
          'Failed to load company details. Please check your connection and try again.'
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const calculateCompletionPercentage = () => {
    const fields = [
      companyDetails.businessName,
      companyDetails.phoneNumber1,
      companyDetails.emailId,
      companyDetails.businessAddress,
      companyDetails.pincode,
      companyDetails.businessDescription,
      companyDetails.signature,
    ];
    
    const filledFields = fields.filter(field => field.trim().length > 0).length;
    const percentage = Math.round((filledFields / fields.length) * 100);
    setCompletionPercentage(percentage);
  };

  const updateField = (field: keyof CompanyDetails, value: string) => {
    setCompanyDetails(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Validate company details before saving
      await CompanyApiService.validateCompanyDetails(companyDetails);
      
      // Save company details
      const savedDetails = await CompanyApiService.saveCompanyDetails(companyDetails);
      setCompanyDetails(savedDetails);
      
      Alert.alert(
        'Success', 
        Messages.SUCCESS.COMPANY_DETAILS_SAVED,
        [
          {
            text: 'OK',
            onPress: () => router.push('/(tabs)')
          }
        ]
      );
    } catch (error) {
      console.error('Error saving company details:', error);
      const errorMessage = handleApiError(error);
      Alert.alert('Error', errorMessage || Messages.ERROR.FAILED_TO_SAVE_COMPANY_DETAILS);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignatureSave = (signatureData: string) => {
    setSignaturePath(signatureData);
    updateField('signature', signatureData);
    setShowSignatureModal(false);
  };

  const SignatureModal = () => (
    <Modal
      visible={showSignatureModal}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.signatureModalContainer}>
        <View style={styles.signatureModalHeader}>
          <Text style={styles.signatureModalTitle}>Draw Your Signature</Text>
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={() => setShowSignatureModal(false)}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={24} color={Colors.text} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.signatureCanvas}>
          <Text style={styles.signaturePlaceholder}>
            Signature drawing functionality will be implemented here
          </Text>
          <Text style={styles.signatureNote}>
            For now, you can add a text signature below
          </Text>
        </View>
        
        <View style={styles.signatureModalFooter}>
          <TouchableOpacity 
            style={styles.signatureSaveButton}
            onPress={() => handleSignatureSave('Digital Signature')}
            activeOpacity={0.8}
          >
            <Text style={styles.signatureSaveButtonText}>Save Signature</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading company details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => router.back()} 
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Company Details</Text>
        <View style={styles.backButton} />
      </View>

      <KeyboardAvoidingView 
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          style={styles.scrollView} 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >

          {/* Profile Section */}
          <View style={styles.profileSection}>
            <View style={[
              styles.profileImageContainer,
              completionPercentage > 0 && styles.profileImageContainerWithBorder
            ]}>
              <TouchableOpacity 
                style={styles.profileImageButton}
                activeOpacity={0.8}
              >
                <Ionicons name="camera" size={32} color={Colors.textSecondary} />
                <Text style={styles.profileImageText}>Add Photo</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.completionContainer}>
              <Text style={styles.completionText}>Profile {completionPercentage}% Completed</Text>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill, 
                    { width: `${completionPercentage}%` }
                  ]} 
                />
              </View>
            </View>
          </View>

          {/* Form Section */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Business Information</Text>
            
            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>Business Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter business name"
                placeholderTextColor={Colors.textTertiary}
                value={companyDetails.businessName}
                onChangeText={(text) => updateField('businessName', text)}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>Phone Number 1 *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter primary phone number"
                placeholderTextColor={Colors.textTertiary}
                value={companyDetails.phoneNumber1}
                onChangeText={(text) => updateField('phoneNumber1', text)}
                keyboardType="phone-pad"
                maxLength={15}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>Phone Number 2</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter secondary phone number (optional)"
                placeholderTextColor={Colors.textTertiary}
                value={companyDetails.phoneNumber2}
                onChangeText={(text) => updateField('phoneNumber2', text)}
                keyboardType="phone-pad"
                maxLength={15}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>Email ID *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter email address"
                placeholderTextColor={Colors.textTertiary}
                value={companyDetails.emailId}
                onChangeText={(text) => updateField('emailId', text)}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>Business Address *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Enter complete business address"
                placeholderTextColor={Colors.textTertiary}
                value={companyDetails.businessAddress}
                onChangeText={(text) => updateField('businessAddress', text)}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                autoCapitalize="sentences"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>Pincode *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter pincode"
                placeholderTextColor={Colors.textTertiary}
                value={companyDetails.pincode}
                onChangeText={(text) => updateField('pincode', text)}
                keyboardType="numeric"
                maxLength={6}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>Business Description *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Describe your business (products/services)"
                placeholderTextColor={Colors.textTertiary}
                value={companyDetails.businessDescription}
                onChangeText={(text) => updateField('businessDescription', text)}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                autoCapitalize="sentences"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>Digital Signature *</Text>
              <TouchableOpacity 
                style={styles.signatureButton}
                onPress={() => setShowSignatureModal(true)}
                activeOpacity={0.8}
              >
                {companyDetails.signature ? (
                  <View style={styles.signatureDisplay}>
                    <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
                    <Text style={styles.signatureDisplayText}>Signature Added</Text>
                  </View>
                ) : (
                  <View style={styles.signaturePlaceholder}>
                    <Ionicons name="create-outline" size={24} color={Colors.textSecondary} />
                    <Text style={styles.signaturePlaceholderText}>Draw Signature</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Save Button */}
          <View style={styles.bottomSection}>
            <TouchableOpacity 
              style={[styles.saveButtonLarge, isSaving && styles.saveButtonDisabled]} 
              onPress={handleSave}
              activeOpacity={0.8}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color={Colors.text} />
              ) : (
                <Ionicons name="save" size={20} color={Colors.text} />
              )}
              <Text style={styles.saveButtonLargeText}>
                {isSaving ? 'Saving...' : 'Save Company Details'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <SignatureModal />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 48 : 44,
    paddingBottom: 20,
    marginTop: Platform.OS === 'android' ? 16 : 12,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    // Android-specific: Add elevation
    ...(Platform.OS === 'android' && {
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 3.84,
    }),
  },
  headerTitle: {
    fontSize: Platform.OS === 'android' ? 20 : 20,
    fontWeight: Platform.OS === 'android' ? '500' : '600',
    color: Colors.text,
    textAlign: 'center',
    // Android-specific: Optimize text rendering
    ...(Platform.OS === 'android' && {
      includeFontPadding: false,
      textAlignVertical: 'center',
    }),
  },
  backButton: {
    padding: Platform.OS === 'android' ? 12 : 8,
    minWidth: 48,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    // Android-specific: Add ripple effect area
    ...(Platform.OS === 'android' && {
      borderRadius: 24,
    }),
  },

  profileSection: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
    backgroundColor: Colors.background,
  },
  profileImageContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    // Android-specific: Add elevation
    ...(Platform.OS === 'android' && {
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
    }),
  },
  profileImageContainerWithBorder: {
    borderWidth: 3,
    borderColor: Colors.primary,
  },
  profileImageButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 48,
    minHeight: 48,
  },
  profileImageText: {
    fontSize: Platform.OS === 'android' ? 12 : 12,
    color: Colors.textSecondary,
    marginTop: 8,
    // Android-specific: Optimize text rendering
    ...(Platform.OS === 'android' && {
      includeFontPadding: false,
      textAlignVertical: 'center',
    }),
  },
  completionContainer: {
    alignItems: 'center',
    width: '100%',
  },
  completionText: {
    fontSize: Platform.OS === 'android' ? 16 : 16,
    fontWeight: Platform.OS === 'android' ? '500' : '600',
    color: Colors.text,
    marginBottom: 12,
    // Android-specific: Optimize text rendering
    ...(Platform.OS === 'android' && {
      includeFontPadding: false,
      textAlignVertical: 'center',
    }),
  },
  progressBar: {
    width: '100%',
    maxWidth: 280,
    height: Platform.OS === 'android' ? 8 : 8,
    backgroundColor: Colors.surface,
    borderRadius: 4,
    overflow: 'hidden',
    // Android-specific: Add elevation
    ...(Platform.OS === 'android' && {
      elevation: 1,
    }),
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 4,
  },
  formSection: {
    padding: 20,
    backgroundColor: Colors.background,
  },
  sectionTitle: {
    fontSize: Platform.OS === 'android' ? 18 : 18,
    fontWeight: Platform.OS === 'android' ? '500' : '600',
    color: Colors.text,
    marginBottom: 24,
    // Android-specific: Optimize text rendering
    ...(Platform.OS === 'android' && {
      includeFontPadding: false,
      textAlignVertical: 'center',
    }),
  },
  formGroup: {
    marginBottom: 24,
  },
  fieldLabel: {
    fontSize: Platform.OS === 'android' ? 14 : 14,
    fontWeight: Platform.OS === 'android' ? '500' : '500',
    color: Colors.text,
    marginBottom: 8,
    // Android-specific: Optimize text rendering
    ...(Platform.OS === 'android' && {
      includeFontPadding: false,
      textAlignVertical: 'center',
    }),
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: Platform.OS === 'android' ? 8 : 12,
    padding: Platform.OS === 'android' ? 16 : 16,
    color: Colors.text,
    fontSize: Platform.OS === 'android' ? 16 : 16, // Prevents zoom on Android
    borderWidth: 1,
    borderColor: Colors.border,
    // Android-specific: Add elevation and optimize
    ...(Platform.OS === 'android' && {
      elevation: 1,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      includeFontPadding: false,
      textAlignVertical: 'center',
    }),
  },
  textArea: {
    minHeight: Platform.OS === 'android' ? 100 : 100,
    paddingTop: Platform.OS === 'android' ? 16 : 16,
    textAlignVertical: 'top',
  },
  signatureButton: {
    backgroundColor: Colors.surface,
    borderRadius: Platform.OS === 'android' ? 8 : 12,
    padding: Platform.OS === 'android' ? 16 : 16,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    minHeight: Platform.OS === 'android' ? 56 : 56,
    justifyContent: 'center',
    // Android-specific: Add elevation
    ...(Platform.OS === 'android' && {
      elevation: 1,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
    }),
  },
  signatureDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signatureDisplayText: {
    color: Colors.success,
    fontSize: Platform.OS === 'android' ? 16 : 16,
    fontWeight: Platform.OS === 'android' ? '500' : '500',
    marginLeft: 8,
    // Android-specific: Optimize text rendering
    ...(Platform.OS === 'android' && {
      includeFontPadding: false,
      textAlignVertical: 'center',
    }),
  },
  signaturePlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signaturePlaceholderText: {
    color: Colors.textSecondary,
    fontSize: Platform.OS === 'android' ? 16 : 16,
    marginLeft: 8,
    // Android-specific: Optimize text rendering
    ...(Platform.OS === 'android' && {
      includeFontPadding: false,
      textAlignVertical: 'center',
    }),
  },
  bottomSection: {
    padding: 20,
    paddingBottom: Platform.OS === 'android' ? 100 : 80,
  },
  saveButtonLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: Platform.OS === 'android' ? 8 : 12,
    padding: Platform.OS === 'android' ? 16 : 16,
    minHeight: Platform.OS === 'android' ? 56 : 56,
    gap: 8,
    // Android-specific: Add elevation and Material Design
    ...(Platform.OS === 'android' && {
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
    }),
  },
  saveButtonLargeText: {
    color: Colors.text,
    fontSize: Platform.OS === 'android' ? 16 : 16,
    fontWeight: Platform.OS === 'android' ? '500' : '600',
    // Android-specific: Optimize text rendering
    ...(Platform.OS === 'android' && {
      includeFontPadding: false,
      textAlignVertical: 'center',
    }),
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: Platform.OS === 'android' ? 16 : 16,
    color: Colors.textSecondary,
    // Android-specific: Optimize text rendering
    ...(Platform.OS === 'android' && {
      includeFontPadding: false,
      textAlignVertical: 'center',
    }),
  },
  // Signature Modal Styles
  signatureModalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  signatureModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Platform.OS === 'android' ? 20 : 20,
    paddingTop: Platform.OS === 'android' ? 16 : 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    // Android-specific: Add elevation
    ...(Platform.OS === 'android' && {
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 3.84,
    }),
  },
  signatureModalTitle: {
    fontSize: Platform.OS === 'android' ? 18 : 18,
    fontWeight: Platform.OS === 'android' ? '500' : '600',
    color: Colors.text,
    // Android-specific: Optimize text rendering
    ...(Platform.OS === 'android' && {
      includeFontPadding: false,
      textAlignVertical: 'center',
    }),
  },
  closeButton: {
    padding: Platform.OS === 'android' ? 8 : 8,
    minWidth: 48,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Platform.OS === 'android' ? 24 : 0,
  },
  signatureCanvas: {
    flex: 1,
    backgroundColor: Colors.surface,
    margin: 20,
    borderRadius: Platform.OS === 'android' ? 8 : 12,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    // Android-specific: Add elevation
    ...(Platform.OS === 'android' && {
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 3.84,
    }),
  },
  signatureNote: {
    fontSize: Platform.OS === 'android' ? 14 : 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    // Android-specific: Optimize text rendering
    ...(Platform.OS === 'android' && {
      includeFontPadding: false,
      textAlignVertical: 'center',
    }),
  },
  signatureModalFooter: {
    padding: Platform.OS === 'android' ? 20 : 20,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    // Android-specific: Add elevation
    ...(Platform.OS === 'android' && {
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.1,
      shadowRadius: 3.84,
    }),
  },
  signatureSaveButton: {
    backgroundColor: Colors.primary,
    borderRadius: Platform.OS === 'android' ? 8 : 12,
    padding: Platform.OS === 'android' ? 16 : 16,
    minHeight: Platform.OS === 'android' ? 56 : 56,
    alignItems: 'center',
    justifyContent: 'center',
    // Android-specific: Add elevation
    ...(Platform.OS === 'android' && {
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
    }),
  },
  signatureSaveButtonText: {
    color: Colors.text,
    fontSize: Platform.OS === 'android' ? 16 : 16,
    fontWeight: Platform.OS === 'android' ? '500' : '600',
    // Android-specific: Optimize text rendering
    ...(Platform.OS === 'android' && {
      includeFontPadding: false,
      textAlignVertical: 'center',
    }),
  },
});
