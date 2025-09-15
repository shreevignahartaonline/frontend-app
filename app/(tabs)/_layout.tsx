import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { Platform, StatusBar } from "react-native";
import { Colors } from "../../constants/Colors";

// Android-specific utilities
const isAndroid = Platform.OS === 'android';

// Android-specific constants for bottom navigation
const ANDROID_TAB_CONSTANTS = {
  statusBarHeight: isAndroid ? StatusBar.currentHeight || 24 : 0,
  navigationBarHeight: isAndroid ? 48 : 0,
  tabBarHeight: isAndroid ? 80 : 60, // Increased height for Android
  elevation: isAndroid ? 8 : 0,
  rippleColor: isAndroid ? 'rgba(0, 0, 0, 0.1)' : undefined,
};

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textTertiary,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          paddingBottom: isAndroid ? 12 : 8, // More padding for Android
          paddingTop: isAndroid ? 12 : 8, // More padding for Android
          height: ANDROID_TAB_CONSTANTS.tabBarHeight,
          // Android-specific: Add elevation and safe area handling
          ...(isAndroid && {
            elevation: ANDROID_TAB_CONSTANTS.elevation,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.25,
            shadowRadius: 3.84,
            // Handle safe area for Android devices with navigation gestures
            paddingBottom: 16, // Account for gesture navigation area
          }),
        },
        headerShown: false,
        headerStyle: {
          backgroundColor: Colors.surface,
          // Android-specific: Add elevation to header
          ...(isAndroid && {
            elevation: ANDROID_TAB_CONSTANTS.elevation,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 3.84,
          }),
        },
        headerTintColor: Colors.text,
        headerTitleStyle: {
          fontWeight: '600',
          // Android-specific: Optimize text rendering
          ...(isAndroid && {
            includeFontPadding: false,
            textAlignVertical: 'center',
          }),
        },
        tabBarLabelStyle: {
          fontSize: isAndroid ? 11 : 12, // Slightly smaller for Android
          fontWeight: '500',
          // Android-specific: Optimize text rendering
          ...(isAndroid && {
            includeFontPadding: false,
            textAlignVertical: 'center',
            marginTop: 2, // Better spacing for Android
          }),
        },
        // Android-specific: Add ripple effect to tab bar items
        tabBarItemStyle: isAndroid ? {
          minHeight: 48, // Ensure minimum touch target
          justifyContent: 'center',
          alignItems: 'center',
          // Remove any additional ripple effects
          backgroundColor: 'transparent',
        } : undefined,
        // Remove ripple effect on tab press
        tabBarPressColor: 'transparent',
        tabBarPressOpacity: 0.8,
        // Android-specific: Optimize tab bar icon
        tabBarIconStyle: isAndroid ? {
          marginBottom: 2, // Better spacing for Android
        } : undefined,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, size }) => (
            <Ionicons 
              name="home" 
              size={isAndroid ? size + 2 : size} // Slightly larger icons for Android
              color={color} 
            />
          ),
          // Android-specific: Better touch handling
          ...(isAndroid && {
            tabBarAccessibilityLabel: "Dashboard tab",
            tabBarTestID: "dashboard-tab",
          }),
        }}
      />
      <Tabs.Screen
        name="sales"
        options={{
          title: "Sales",
          tabBarIcon: ({ color, size }) => (
            <Ionicons 
              name="trending-up" 
              size={isAndroid ? size + 2 : size} // Slightly larger icons for Android
              color={color} 
            />
          ),
          // Android-specific: Better touch handling
          ...(isAndroid && {
            tabBarAccessibilityLabel: "Sales tab",
            tabBarTestID: "sales-tab",
          }),
        }}
      />
      <Tabs.Screen
        name="purchase"
        options={{
          title: "Purchase",
          tabBarIcon: ({ color, size }) => (
            <Ionicons 
              name="cart" 
              size={isAndroid ? size + 2 : size} // Slightly larger icons for Android
              color={color} 
            />
          ),
          // Android-specific: Better touch handling
          ...(isAndroid && {
            tabBarAccessibilityLabel: "Purchase tab",
            tabBarTestID: "purchase-tab",
          }),
        }}
      />

      <Tabs.Screen
        name="items"
        options={{
          title: "Items",
          tabBarIcon: ({ color, size }) => (
            <Ionicons 
              name="cube" 
              size={isAndroid ? size + 2 : size} // Slightly larger icons for Android
              color={color} 
            />
          ),
          // Android-specific: Better touch handling
          ...(isAndroid && {
            tabBarAccessibilityLabel: "Items tab",
            tabBarTestID: "items-tab",
          }),
        }}
      />
    </Tabs>
  );
}
