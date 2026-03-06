/**
 * Display Name Picker Component
 *
 * Allows users to choose their display name during signup.
 * Shows preview with discriminator format: username#0000
 * Validates display name format (3-20 alphanumeric + underscores).
 */

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from "react-native";
import { supabase } from "../../lib/supabase";

interface DisplayNamePickerProps {
  value: string;
  onChangeText: (text: string) => void;
  onValidationChange?: (isValid: boolean) => void;
}

export const DisplayNamePicker: React.FC<DisplayNamePickerProps> = ({
  value,
  onChangeText,
  onValidationChange,
}) => {
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextDiscriminator, setNextDiscriminator] = useState<number | null>(
    null
  );

  // Validate display name format
  const validateFormat = (name: string): boolean => {
    if (!name) return false;
    if (name.length < 3 || name.length > 20) return false;
    if (!/^[a-zA-Z0-9_]+$/.test(name)) return false;
    return true;
  };

  // Check availability and get next discriminator
  useEffect(() => {
    const checkAvailability = async () => {
      if (!value || !validateFormat(value)) {
        setError(null);
        setNextDiscriminator(null);
        onValidationChange?.(false);
        return;
      }

      setIsChecking(true);
      setError(null);

      try {
        // Call the discriminator generator function
        const { data, error: rpcError } = await supabase.rpc(
          "generate_unique_discriminator",
          {
            p_display_name: value,
          }
        );

        if (rpcError) throw rpcError;

        setNextDiscriminator(data as number);
        onValidationChange?.(true);
      } catch (err: any) {
        console.error("Error checking display name:", err);
        setError("Failed to check availability");
        onValidationChange?.(false);
      } finally {
        setIsChecking(false);
      }
    };

    const debounceTimer = setTimeout(checkAvailability, 500);
    return () => clearTimeout(debounceTimer);
  }, [value, onValidationChange]);

  const formatDiscriminator = (num: number | null): string => {
    if (num === null) return "####";
    return num.toString().padStart(4, "0");
  };

  const getValidationMessage = (): string | null => {
    if (!value) return null;
    if (value.length < 3) return "Minimum 3 characters";
    if (value.length > 20) return "Maximum 20 characters";
    if (!/^[a-zA-Z0-9_]+$/.test(value))
      return "Only letters, numbers, and underscores";
    return null;
  };

  const validationMessage = getValidationMessage();

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Display Name</Text>

      <View style={styles.inputContainer}>
        <TextInput
          style={[
            styles.input,
            (error || validationMessage) && styles.inputError,
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder="username"
          placeholderTextColor="#999"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={20}
        />
        {isChecking && (
          <ActivityIndicator
            size="small"
            color="#666"
            style={styles.loadingIndicator}
          />
        )}
      </View>

      {/* Preview */}
      <View style={styles.previewContainer}>
        <Text style={styles.previewLabel}>Preview:</Text>
        <Text style={styles.preview}>
          {value || "username"}#{formatDiscriminator(nextDiscriminator)}
        </Text>
      </View>

      {/* Validation messages */}
      {validationMessage && (
        <Text style={styles.errorText}>{validationMessage}</Text>
      )}
      {error && <Text style={styles.errorText}>{error}</Text>}

      {/* Help text */}
      {!validationMessage && !error && (
        <Text style={styles.helpText}>
          3-20 characters. Letters, numbers, and underscores only.
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  inputContainer: {
    position: "relative",
    width: "100%",
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
  },
  inputError: {
    borderColor: "#FF3B30",
  },
  loadingIndicator: {
    position: "absolute",
    right: 16,
    top: 14,
  },
  previewContainer: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  previewLabel: {
    fontSize: 14,
    color: "#666",
    marginRight: 8,
  },
  preview: {
    fontSize: 16,
    fontWeight: "600",
    color: "#007AFF",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  helpText: {
    fontSize: 12,
    color: "#666",
    marginTop: 6,
  },
  errorText: {
    fontSize: 12,
    color: "#FF3B30",
    marginTop: 6,
  },
});
