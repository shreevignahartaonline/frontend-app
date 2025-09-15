import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Platform } from "react-native";
import { Colors } from "../constants/Colors";

// Android-specific utilities
const isAndroid = Platform.OS === 'android';

export default function RootLayout() {
  return (
    <>
      <StatusBar 
        style={isAndroid ? "dark" : "light"} 
        backgroundColor={Colors.background}
        // Android-specific: Better status bar handling
        {...(isAndroid && {
          translucent: true,
          barStyle: "dark-content",
        })}
      />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { 
            backgroundColor: Colors.background,
            // Android-specific: Add padding for status bar
            ...(isAndroid && {
              paddingTop: 0, // Let individual screens handle status bar
            }),
          },
          // Android-specific: Add animation and gesture handling
          ...(isAndroid && {
            animation: "slide_from_right",
            gestureEnabled: true,
            gestureDirection: "horizontal",
          }),
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="edit-invoice" />
        <Stack.Screen name="edit-purchase" />
        <Stack.Screen name="edit-payin" />
        <Stack.Screen name="edit-payout" />
        <Stack.Screen name="company-details" />
        <Stack.Screen name="partyTransactions" />
      </Stack>
    </>
  );
}
