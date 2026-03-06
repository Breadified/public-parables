/**
 * Forgot Password Route
 *
 * Allows users to request a password reset email.
 */

import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useUnifiedAuth } from "../../hooks/useUnifiedAuth";
import { ConfirmationModal } from "../../components/ConfirmationModal";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { resetPassword } = useUnifiedAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  // Modal state
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const handleResetPassword = async () => {
    if (!email) {
      setErrorMessage("Please enter your email address");
      setShowErrorModal(true);
      return;
    }

    setLoading(true);
    try {
      await resetPassword(email);
      setShowSuccessModal(true);
    } catch (error: any) {
      console.error("Reset password error:", error);
      setErrorMessage(error.message || "Failed to send reset email");
      setShowErrorModal(true);
    } finally {
      setLoading(false);
    }
  };

  // Handle success confirmation (navigates back)
  const handleSuccessConfirm = () => {
    setShowSuccessModal(false);
    router.back();
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>Reset Password</Text>
        <Text style={styles.subtitle}>
          Enter your email address and we&apos;ll send you a link to reset your
          password.
        </Text>

        <View style={styles.form}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="your@email.com"
            placeholderTextColor="#999"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleResetPassword}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Send Reset Link</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Error Modal */}
      <ConfirmationModal
        visible={showErrorModal}
        variant="info"
        title="Error"
        message={errorMessage}
        semanticType="error"
        onConfirm={() => setShowErrorModal(false)}
      />

      {/* Success Modal */}
      <ConfirmationModal
        visible={showSuccessModal}
        variant="info"
        title="Success"
        message="Password reset email sent. Please check your inbox."
        semanticType="success"
        onConfirm={handleSuccessConfirm}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  backButton: {
    fontSize: 16,
    color: "#007AFF",
  },
  content: {
    flex: 1,
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: "#000",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    lineHeight: 24,
    marginBottom: 32,
  },
  form: {
    width: "100%",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#DDDDDD",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: "#FFFFFF",
    color: "#000",
    marginBottom: 16,
  },
  button: {
    backgroundColor: "#007AFF",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
