export const Colors = {
  // Primary colors
  primary: '#6366f1', // Indigo
  primaryDark: '#4f46e5',
  primaryLight: '#818cf8',
  
  // Secondary colors
  secondary: '#10b981', // Emerald
  secondaryDark: '#059669',
  secondaryLight: '#34d399',
  
  // Background colors
  background: '#0f0f23', // Very dark blue-gray
  surface: '#1a1a2e', // Dark blue-gray
  surfaceVariant: '#16213e', // Slightly lighter surface
  card: '#1e293b', // Dark slate
  
  // Text colors
  text: '#f8fafc', // Light gray
  textSecondary: '#cbd5e1', // Medium gray
  textTertiary: '#94a3b8', // Darker gray
  textDisabled: '#64748b', // Muted gray
  
  // Status colors
  success: '#10b981', // Green
  warning: '#f59e0b', // Amber
  error: '#ef4444', // Red
  info: '#3b82f6', // Blue
  
  // Border colors
  border: '#334155', // Dark gray
  borderLight: '#475569', // Medium gray
  
  // Overlay colors
  overlay: 'rgba(0, 0, 0, 0.5)',
  overlayLight: 'rgba(0, 0, 0, 0.3)',
  
  // Gradient colors
  gradientStart: '#6366f1',
  gradientEnd: '#8b5cf6',
  
  // Shadow colors
  shadow: 'rgba(0, 0, 0, 0.25)',
  shadowLight: 'rgba(0, 0, 0, 0.1)',
} as const;

export type ColorScheme = typeof Colors;
