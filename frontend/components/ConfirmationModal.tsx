/**
 * ConfirmationModal - Themed modal for confirmations and alerts
 * Replaces native Alert.alert with beautiful themed UI
 *
 * Variants:
 * - info: Simple information (1 OK button)
 * - confirm: Standard confirmation (Cancel + Confirm buttons)
 * - destructive: Warning for dangerous actions (Cancel + Destructive button in red)
 */

import React, { useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

export interface ConfirmationModalProps {
  visible: boolean;
  variant?: 'info' | 'confirm' | 'destructive';
  title: string;
  message: string;
  confirmLabel?: string; // Default: "OK" for info, "Confirm" for others
  cancelLabel?: string; // Default: "Cancel"
  icon?: keyof typeof Ionicons.glyphMap;
  onConfirm: () => void;
  onCancel?: () => void; // Optional for info variant
  semanticType?: 'success' | 'error' | 'warning' | 'info'; // Overrides button color
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  visible,
  variant = 'info',
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  icon,
  onConfirm,
  onCancel,
  semanticType,
}) => {
  const { theme, themeMode } = useTheme();

  // Animation values
  const backdropOpacity = useSharedValue(0);
  const translateY = useSharedValue(300);
  const scale = useSharedValue(0.9);

  // Determine default labels
  const defaultConfirmLabel = variant === 'info' ? 'OK' : 'Confirm';
  const finalConfirmLabel = confirmLabel || defaultConfirmLabel;

  // Determine icon
  const defaultIcons = {
    info: 'information-circle' as const,
    confirm: 'checkmark-circle' as const,
    destructive: 'warning' as const,
  };
  const finalIcon = icon || defaultIcons[variant];

  // Use standard theme colors only - no variations
  const buttonColor = theme.colors.accent;
  const iconColor = theme.colors.accent;

  // Handle modal animations - fast slide only
  useEffect(() => {
    if (visible) {
      // Enter - quick slide up
      backdropOpacity.value = withTiming(1, { duration: 120 });
      translateY.value = withTiming(0, { duration: 120 });
      scale.value = 1; // No scale animation
    } else {
      // Exit - quick slide down
      backdropOpacity.value = withTiming(0, { duration: 100 });
      translateY.value = withTiming(300, { duration: 100 });
      scale.value = 1;
    }
  }, [visible]);

  // Animated styles
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const containerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  // Handle cancel (dismiss)
  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
  };

  // Handle confirm
  const handleConfirm = () => {
    onConfirm();
  };

  // Handle backdrop press (dismiss)
  const handleBackdropPress = () => {
    if (onCancel) {
      handleCancel();
    }
  };

  if (!visible) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleCancel}
    >
      {/* Backdrop with blur */}
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        {/* Background layer - BlurView must NOT be inside Pressable on iOS (blocks touches) */}
        {Platform.OS === 'ios' ? (
          <BlurView
            style={StyleSheet.absoluteFill}
            intensity={20}
            tint={themeMode === 'dark' ? 'dark' : 'light'}
            pointerEvents="none"
          />
        ) : (
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor:
                  themeMode === 'dark'
                    ? 'rgba(0, 0, 0, 0.7)'
                    : 'rgba(0, 0, 0, 0.5)',
              },
            ]}
            pointerEvents="none"
          />
        )}
        {/* Touchable layer on top */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handleBackdropPress}
        />

        {/* Modal Container */}
        <AnimatedPressable
          style={[
            styles.modalContainer,
            {
              backgroundColor: theme.colors.background.elevated,
            },
            containerStyle,
          ]}
          onPress={(e) => e.stopPropagation()} // Prevent backdrop dismiss when clicking modal
        >
          {/* Icon */}
          {finalIcon && (
            <View style={styles.iconContainer}>
              <Ionicons
                name={finalIcon}
                size={48}
                color={iconColor}
              />
            </View>
          )}

          {/* Title */}
          <Text
            style={[
              styles.title,
              { color: theme.colors.text.primary },
            ]}
          >
            {title}
          </Text>

          {/* Message */}
          <Text
            style={[
              styles.message,
              { color: theme.colors.text.secondary },
            ]}
          >
            {message}
          </Text>

          {/* Buttons */}
          <View style={styles.buttonsContainer}>
            {/* Cancel button (if not info variant) */}
            {variant !== 'info' && onCancel && (
              <TouchableOpacity
                style={[
                  styles.button,
                  styles.cancelButton,
                  {
                    backgroundColor: theme.colors.background.secondary,
                  },
                ]}
                onPress={handleCancel}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.buttonText,
                    { color: theme.colors.text.primary },
                  ]}
                >
                  {cancelLabel}
                </Text>
              </TouchableOpacity>
            )}

            {/* Confirm button */}
            <TouchableOpacity
              style={[
                styles.button,
                styles.confirmButton,
                {
                  backgroundColor: buttonColor,
                },
                variant === 'info' && styles.fullWidthButton,
              ]}
              onPress={handleConfirm}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.buttonText,
                  styles.confirmButtonText,
                  { color: theme.colors.text.inverse },
                ]}
              >
                {finalConfirmLabel}
              </Text>
            </TouchableOpacity>
          </View>
        </AnimatedPressable>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 16,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  buttonsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    // Styling handled by theme
  },
  confirmButton: {
    // Styling handled by theme
  },
  fullWidthButton: {
    flex: 1, // Takes full width when only button
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButtonText: {
    // Color overridden to inverse
  },
});
