/**
 * Auth Modal Component
 *
 * Modal wrapper for auth screens that can be stacked over any screen.
 * Supports both login and signup flows with optional callbacks.
 */

import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../contexts/ThemeContext";
import { LoginScreen } from "./LoginScreen";
import { SignupScreen } from "./SignupScreen";

interface AuthModalProps {
  visible: boolean;
  mode: "login" | "signup";
  onClose: () => void;
  onSuccess?: () => void;
  onSkip?: () => void;
  promptMessage?: string;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  visible,
  mode,
  onClose,
  onSuccess,
  onSkip,
  promptMessage,
}) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(theme, insets);
  const [currentMode, setCurrentMode] = useState<"login" | "signup">(mode);

  // Sync internal state with prop when modal opens
  useEffect(() => {
    if (visible) {
      setCurrentMode(mode);
    }
  }, [visible, mode]);

  const handleSuccess = () => {
    onSuccess?.();
    onClose();
  };

  const handleSkip = () => {
    onSkip?.();
    onClose();
  };

  const handleSwitchMode = () => {
    setCurrentMode(currentMode === "login" ? "signup" : "login");
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Close Button */}
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>

        {/* Auth Screen */}
        {currentMode === "login" ? (
          <LoginScreen
            onLoginSuccess={handleSuccess}
            onSkip={handleSkip}
            onSwitchToSignup={handleSwitchMode}
            promptMessage={promptMessage}
          />
        ) : (
          <SignupScreen
            onSignupSuccess={handleSuccess}
            onSkip={handleSkip}
            onSwitchToLogin={handleSwitchMode}
            promptMessage={promptMessage}
          />
        )}
      </View>
    </Modal>
  );
};

const createStyles = (theme: any, insets: { top: number; bottom: number; left: number; right: number }) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
  },
  closeButton: {
    position: "absolute",
    top: Math.max(50, insets.top + 10),
    right: Math.max(20, insets.right + 20),
    zIndex: 100,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.background.secondary,
    alignItems: "center",
    justifyContent: "center",
  },
  closeButtonText: {
    fontSize: 20,
    color: theme.colors.text.secondary,
    fontWeight: "600",
  },
});
