/**
 * Animated Typing Placeholder Component
 * Displays animated Bible verse shortcuts that appear to be typed in real-time
 */

import React, { useEffect, useState, useRef } from "react";
import { Text, StyleSheet } from "react-native";
import { getRandomVerseSuggestion } from "@/modules/bible/searchSuggestions";

interface AnimatedPlaceholderProps {
  isVisible: boolean;
  color?: string;
  fontSize?: number;
}

const TYPING_SPEED = 80; // ms per character
const PAUSE_AFTER_COMPLETE = 2000; // ms to show complete text
const PAUSE_BEFORE_DELETE = 500; // ms before starting to delete
const DELETE_SPEED = 40; // ms per character deletion

export const AnimatedPlaceholder = React.memo(
  ({
    isVisible,
    color = "#9CA3AF",
    fontSize = 16,
  }: AnimatedPlaceholderProps) => {
    const [displayText, setDisplayText] = useState("");
    const animationRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const phaseRef = useRef<"typing" | "paused" | "deleting">("typing");
    const charIndexRef = useRef(0);
    const currentSuggestionRef = useRef("");

    useEffect(() => {
      if (!isVisible) {
        // Clear animation when hidden
        if (animationRef.current) {
          clearTimeout(animationRef.current);
          animationRef.current = null;
        }
        setDisplayText("");
        charIndexRef.current = 0;
        phaseRef.current = "typing";
        currentSuggestionRef.current = "";
        return;
      }

      // Initialize with first suggestion if needed
      if (!currentSuggestionRef.current) {
        currentSuggestionRef.current = getRandomVerseSuggestion();
        charIndexRef.current = 0;
        phaseRef.current = "typing";
      }

      const animate = () => {
        const currentSuggestion = currentSuggestionRef.current;

        if (phaseRef.current === "typing") {
          // Typing phase
          if (charIndexRef.current < currentSuggestion.length) {
            setDisplayText(
              currentSuggestion.substring(0, charIndexRef.current + 1)
            );
            charIndexRef.current += 1;
            animationRef.current = setTimeout(
              animate,
              TYPING_SPEED
            ) as ReturnType<typeof setTimeout>;
          } else {
            // Finished typing, pause
            phaseRef.current = "paused";
            animationRef.current = setTimeout(
              animate,
              PAUSE_AFTER_COMPLETE
            ) as ReturnType<typeof setTimeout>;
          }
        } else if (phaseRef.current === "paused") {
          // Paused, start deleting
          phaseRef.current = "deleting";
          animationRef.current = setTimeout(
            animate,
            PAUSE_BEFORE_DELETE
          ) as ReturnType<typeof setTimeout>;
        } else if (phaseRef.current === "deleting") {
          // Deleting phase
          if (charIndexRef.current > 0) {
            charIndexRef.current -= 1;
            setDisplayText(
              currentSuggestion.substring(0, charIndexRef.current)
            );
            animationRef.current = setTimeout(
              animate,
              DELETE_SPEED
            ) as ReturnType<typeof setTimeout>;
          } else {
            // Finished deleting, get new suggestion
            currentSuggestionRef.current = getRandomVerseSuggestion();
            charIndexRef.current = 0;
            phaseRef.current = "typing";
            animationRef.current = setTimeout(
              animate,
              TYPING_SPEED
            ) as ReturnType<typeof setTimeout>;
          }
        }
      };

      // Start animation
      animationRef.current = setTimeout(animate, TYPING_SPEED) as ReturnType<
        typeof setTimeout
      >;

      return () => {
        if (animationRef.current) {
          clearTimeout(animationRef.current);
          animationRef.current = null;
        }
      };
    }, [isVisible]);

    if (!isVisible) return null;

    return (
      <Text style={[styles.placeholder, { color, fontSize }]}>
        Search: {displayText}
        <Text style={styles.cursor}>|</Text>
      </Text>
    );
  }
);

AnimatedPlaceholder.displayName = "AnimatedPlaceholder";

const styles = StyleSheet.create({
  placeholder: {
    fontFamily: "System",
  },
  cursor: {
    opacity: 0.7,
  },
});
