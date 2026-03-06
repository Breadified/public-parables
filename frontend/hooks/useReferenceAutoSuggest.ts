/**
 * Reference Auto-Suggest Hook
 * Monitors text input for Bible references and provides suggestions
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getBookMatchesForTyping,
  parsePartialInput,
  generateRangeSuggestions,
  detectVerseShorthand,
} from '@/modules/bible/referenceDetector';
import { parseReference, type ParsedReference } from '@/modules/bible/referenceParser';

export interface ReferenceSuggestion {
  type: 'book' | 'chapter' | 'verse' | 'range' | 'verseShorthand';
  displayText: string;
  reference: string; // Full reference string to insert
  isComplete: boolean;
}

export interface UseReferenceAutoSuggestOptions {
  minChars?: number; // Minimum characters before showing suggestions (default: 3)
  chapterId?: number; // For v[N] shorthand resolution
}

export function useReferenceAutoSuggest(options: UseReferenceAutoSuggestOptions = {}) {
  const { minChars = 3, chapterId } = options;

  const [text, setText] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const [suggestions, setSuggestions] = useState<ReferenceSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);

  // Analyze text and generate suggestions
  const analyzeTex = useCallback(
    (inputText: string, cursor: number) => {
      if (!inputText || cursor < minChars) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      // Get the word being typed at cursor position
      const beforeCursor = inputText.slice(0, cursor);
      const afterCursor = inputText.slice(cursor);

      // Find the start of the current word
      const wordStartMatch = beforeCursor.match(/\S+$/);
      if (!wordStartMatch) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      const currentWord = wordStartMatch[0];

      // Check for v[number] shorthand
      const verseShorthandMatches = detectVerseShorthand(currentWord);
      if (verseShorthandMatches.length > 0 && chapterId) {
        // v[N] detected - suggest this as a quick reference
        const match = verseShorthandMatches[0];
        setSuggestions([
          {
            type: 'verseShorthand',
            displayText: `Insert ${match.suggestedReference} from this chapter`,
            reference: match.suggestedReference || '',
            isComplete: true,
          },
        ]);
        setShowSuggestions(true);
        setSelectedSuggestionIndex(0);
        return;
      }

      // Parse partial input for Bible reference
      const parsed = parsePartialInput(currentWord);

      if (parsed.bookQuery.length >= minChars) {
        const bookMatches = getBookMatchesForTyping(parsed.bookQuery, minChars);

        if (bookMatches.length > 0) {
          const newSuggestions: ReferenceSuggestion[] = [];

          // Add book suggestions
          bookMatches.slice(0, 3).forEach((book) => {
            // Just book name
            newSuggestions.push({
              type: 'book',
              displayText: book.name,
              reference: book.name,
              isComplete: false,
            });

            // Book with popular chapter
            if (book.name === 'Psalms') {
              newSuggestions.push({
                type: 'chapter',
                displayText: `${book.name} 23`,
                reference: `${book.name} 23`,
                isComplete: false,
              });
            } else if (book.name === 'John') {
              newSuggestions.push({
                type: 'verse',
                displayText: `${book.name} 3:16`,
                reference: `${book.name} 3:16`,
                isComplete: true,
              });
            }

            // Add range suggestions for first match
            if (newSuggestions.length < 5 && bookMatches.indexOf(book) === 0) {
              const rangeSuggestions = generateRangeSuggestions(book, 1);
              rangeSuggestions.slice(0, 2).forEach((range) => {
                newSuggestions.push({
                  type: 'range',
                  displayText: range,
                  reference: range,
                  isComplete: true,
                });
              });
            }
          });

          setSuggestions(newSuggestions.slice(0, 5));
          setShowSuggestions(newSuggestions.length > 0);
          setSelectedSuggestionIndex(0);
          return;
        }
      }

      // Try to parse as full reference
      const fullParse = parseReference(currentWord);
      if (fullParse.isValid && fullParse.chapter) {
        setSuggestions([
          {
            type: fullParse.verseStart ? 'verse' : 'chapter',
            displayText: fullParse.normalizedReference,
            reference: fullParse.normalizedReference,
            isComplete: !!fullParse.verseStart,
          },
        ]);
        setShowSuggestions(true);
        setSelectedSuggestionIndex(0);
        return;
      }

      // No matches
      setSuggestions([]);
      setShowSuggestions(false);
    },
    [minChars, chapterId]
  );

  // Update text and trigger analysis
  const updateText = useCallback(
    (newText: string, newCursor: number) => {
      setText(newText);
      setCursorPosition(newCursor);
      analyzeTex(newText, newCursor);
    },
    [analyzeTex]
  );

  // Select a suggestion
  const selectSuggestion = useCallback(
    (index: number) => {
      if (index >= 0 && index < suggestions.length) {
        setSelectedSuggestionIndex(index);
        return suggestions[index];
      }
      return null;
    },
    [suggestions]
  );

  // Accept current suggestion
  const acceptSuggestion = useCallback(() => {
    if (suggestions.length > 0 && selectedSuggestionIndex < suggestions.length) {
      const selected = suggestions[selectedSuggestionIndex];
      setShowSuggestions(false);
      return selected;
    }
    return null;
  }, [suggestions, selectedSuggestionIndex]);

  // Dismiss suggestions
  const dismissSuggestions = useCallback(() => {
    setShowSuggestions(false);
    setSuggestions([]);
  }, []);

  return {
    suggestions,
    showSuggestions,
    selectedSuggestionIndex,
    updateText,
    selectSuggestion,
    acceptSuggestion,
    dismissSuggestions,
  };
}
