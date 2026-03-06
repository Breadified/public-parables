/**
 * SearchInterface - Reusable Bible search component
 * Can be used in modals, panes, or any container
 */

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { withTiming, withSequence, Easing } from 'react-native-reanimated';
import { observer, useSelector } from '@legendapp/state/react';
import { useTheme } from '@/contexts/ThemeContext';
import { appStateStore$ } from '@/state/appStateStore';
import { getTheme } from '@/config/theme';
import { bibleSQLite } from '@/services/sqlite';
import { BookCard } from './BookCard';
import { BOOK_CATEGORIES, BOOK_IDS } from './constants';
import type { Book, DisplayMode } from './types';
import { AnimatedPlaceholder } from './AnimatedPlaceholder';
import { AutoSuggestOverlay } from './AutoSuggestOverlay';
import { GroupedSemanticResultsList } from './GroupedSemanticResultsList';
import { KeywordSearchResultsList } from './KeywordSearchResultsList';
import { detectIntent, type SearchIntent } from '@/modules/search/intentDetector';
import {
  semanticSearchGrouped,
  initializeEmbeddingsDb,
  loadEmbeddingsToMemory,
  type PassageSearchResult,
} from '@/modules/search/vectorSearch';
import { searchBible, type SearchResult } from '@/modules/bible/searchEngine';
import { containsChinese, findBookIdByChineseName, BOOK_NAMES_ZH } from '@/modules/bible/bookNameTranslations';
import { bibleVersionStore$ } from '@/state/bibleVersionStore';

export interface SearchInterfaceProps {
  /** Callback when a location is selected */
  onSelect: (params: {
    bookId: number;
    chapterId: number;
    verseId: number | null;
    bookName: string;
    chapter: number;
    verse?: number;
  }) => void;
  /** Operation mode - affects behavior but UI is the same */
  mode: 'navigate' | 'relocate';
  /** Optional initial location to pre-select */
  initialLocation?: {
    bookId: number;
    chapterId: number;
  };
  /** Optional close callback */
  onClose?: () => void;
  /** Whether to auto-focus the search input */
  autoFocus?: boolean;
  /** Optional padding bottom for safe area */
  paddingBottom?: number;
  /** Optional container width for proper button sizing (defaults to screen width) */
  containerWidth?: number;
  /** Optional scale factor for button sizes (defaults to 1.0) */
  scaleFactor?: number;
}

export const SearchInterface = observer(({
  onSelect,
  mode,
  initialLocation,
  onClose,
  autoFocus = true,
  paddingBottom = 20,
  containerWidth,
  scaleFactor,
}: SearchInterfaceProps) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  // Check if semantic search is ready (embeddings loaded in background)
  const embeddingsReady = useSelector(appStateStore$.embeddings_ready);

  // Get primary version's language for localized book names
  const primaryVersion = useSelector(bibleVersionStore$.primaryVersion);
  const versionLanguage = useMemo(() => {
    const versionData = bibleVersionStore$.getVersionData(primaryVersion);
    return versionData?.language || 'en';
  }, [primaryVersion]);

  // Helper to get localized book name
  const getLocalizedBookName = useCallback((englishName: string): string => {
    if (versionLanguage !== 'zh') return englishName;
    const bookId = BOOK_IDS[englishName];
    if (!bookId) return englishName;
    return BOOK_NAMES_ZH[bookId] || englishName;
  }, [versionLanguage]);

  // State
  const [searchText, setSearchText] = useState('');
  const [expandedBook, setExpandedBook] = useState<string | null>(null);
  const [verseNumbers, setVerseNumbers] = useState<number[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const [prepareAnimations, setPrepareAnimations] = useState(false);

  // PERF: Defer rendering book list until after modal animation
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    // Small delay to let modal animate in first
    const timer = setTimeout(() => setIsReady(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Semantic search state
  const [semanticResults, setSemanticResults] = useState<PassageSearchResult[]>([]);
  const [isSemanticLoading, setIsSemanticLoading] = useState(false);
  const [semanticProgress, setSemanticProgress] = useState<string>(''); // Progress message
  const [hasSearched, setHasSearched] = useState(false); // Track if a search has ever completed

  // Keyword search state
  const [keywordResults, setKeywordResults] = useState<SearchResult[]>([]);
  const [isKeywordLoading, setIsKeywordLoading] = useState(false);
  const keywordSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollViewRef = useRef<ScrollView>(null);
  const animationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<TextInput>(null);

  // Refs to track search cancellation - separate for semantic and keyword to prevent cross-cancellation
  const semanticSearchVersionRef = useRef(0);
  const keywordSearchVersionRef = useRef(0);

  // All books flat list
  const allBooks = useMemo(() => {
    const books: Book[] = [];
    Object.entries(BOOK_CATEGORIES).forEach(([categoryKey, category]) => {
      category.books.forEach(book => {
        books.push({ ...book, category: categoryKey });
      });
    });
    return books;
  }, []);

  // Parser: detect book+chapter or book+chapter:verse
  // Accepts colon, semicolon, or space as separator: "gen3:16", "gen3;16", "gen 3 16"
  // Also supports Chinese book names: "约翰福音3:16", "约3:16"
  const parseBookChapterVerse = useCallback((input: string) => {
    const trimmed = input.trim();
    if (!trimmed) return null;

    // Check if input contains Chinese characters
    if (containsChinese(trimmed)) {
      return parseChineseBookChapterVerse(trimmed);
    }

    // English parsing (existing logic)
    const lower = trimmed.toLowerCase();

    // Check for verse separator (colon, semicolon, or space after chapter number)
    const hasSeparator = lower.includes(':') || lower.includes(';');

    if (hasSeparator) {
      // Try to parse complete verse reference: "gen3:16", "gen3;16", "gen 3:16", "gen 3;16"
      const completeMatch = lower.match(/^([a-z0-9\s]*?)(\d+)[:;](\d+)$/i);
      if (completeMatch) {
        const [, bookPart, chapterPart, versePart] = completeMatch;
        const bookQuery = bookPart.replace(/\s+/g, '').toLowerCase().trim();
        const chapter = parseInt(chapterPart);
        const verse = parseInt(versePart);
        return { bookQuery, chapter, verse };
      }

      // Handle partial input: "gen3:", "gen 3;", etc. (separator but no verse number yet)
      const partialMatch = lower.match(/^([a-z0-9\s]*?)(\d+)[:;]\s*$/i);
      if (partialMatch) {
        const [, bookPart, chapterPart] = partialMatch;
        const bookQuery = bookPart.replace(/\s+/g, '').toLowerCase().trim();
        const chapter = parseInt(chapterPart);
        return { bookQuery, chapter, verse: 0 };
      }

      return null;
    } else {
      // Try to parse space-separated verse patterns
      const verseMatch = lower.match(/^([a-z0-9\s]*?)(\d+)\s+(\d+)$/i);
      if (verseMatch) {
        const [, bookPart, chapterPart, versePart] = verseMatch;
        const bookQuery = bookPart.replace(/\s+/g, '').toLowerCase().trim();
        const chapter = parseInt(chapterPart);
        const verse = parseInt(versePart);
        return { bookQuery, chapter, verse };
      }

      // Check for partial space-separated input
      const hasTrailingSpace = input !== input.trimEnd();
      if (hasTrailingSpace) {
        const match = lower.match(/^([a-z0-9\s]*?)(\d+)$/i);
        if (match) {
          const [, bookPart, chapterPart] = match;
          const bookQuery = bookPart.replace(/\s+/g, '').toLowerCase().trim();
          const chapter = parseInt(chapterPart);
          return { bookQuery, chapter, verse: 0 };
        }
      }

      // Chapter mode only: "gen3" or "gen 20"
      const match = lower.match(/^([a-z0-9\s]*?)(\d+)$/i);
      if (!match) return null;

      const [, bookPart, chapterPart] = match;
      const bookQuery = bookPart.replace(/\s+/g, '').toLowerCase().trim();
      if (!bookQuery) return null;

      const chapter = parseInt(chapterPart);
      return { bookQuery, chapter };
    }
  }, []);

  // Parse Chinese book + chapter + verse patterns
  const parseChineseBookChapterVerse = useCallback((input: string) => {
    // Try complete verse reference: "约翰福音3:16", "约3:16"
    const completeMatch = input.match(/^([\u4e00-\u9fff]+)\s*(\d+)[:;](\d+)$/);
    if (completeMatch) {
      const [, bookPart, chapterPart, versePart] = completeMatch;
      return {
        bookQuery: bookPart,
        chapter: parseInt(chapterPart),
        verse: parseInt(versePart),
      };
    }

    // Handle partial input with separator: "约3:", "约翰福音3;"
    const partialMatch = input.match(/^([\u4e00-\u9fff]+)\s*(\d+)[:;]\s*$/);
    if (partialMatch) {
      const [, bookPart, chapterPart] = partialMatch;
      return {
        bookQuery: bookPart,
        chapter: parseInt(chapterPart),
        verse: 0,
      };
    }

    // Chapter only: "约翰福音3", "约3"
    const chapterMatch = input.match(/^([\u4e00-\u9fff]+)\s*(\d+)$/);
    if (chapterMatch) {
      const [, bookPart, chapterPart] = chapterMatch;
      return {
        bookQuery: bookPart,
        chapter: parseInt(chapterPart),
      };
    }

    // Book only: "约翰福音", "约"
    const bookOnlyMatch = input.match(/^([\u4e00-\u9fff]+)$/);
    if (bookOnlyMatch) {
      return {
        bookQuery: bookOnlyMatch[1],
      };
    }

    return null;
  }, []);

  // INSTANT filter values - computed synchronously for immediate UI response
  const { filterText, chapterFilter, verseFilter, displayMode, selectedChapter } = useMemo(() => {
    const parsed = parseBookChapterVerse(searchText);

    if (parsed) {
      return {
        filterText: parsed.bookQuery,
        chapterFilter: String(parsed.chapter),
        verseFilter: parsed.verse !== undefined ? (parsed.verse === 0 ? '' : String(parsed.verse)) : '',
        displayMode: (parsed.verse !== undefined ? 'verses' : 'chapters') as DisplayMode,
        selectedChapter: parsed.verse !== undefined ? parsed.chapter : null,
      };
    }

    return {
      filterText: searchText.trim(),
      chapterFilter: '',
      verseFilter: '',
      displayMode: 'chapters' as DisplayMode,
      selectedChapter: null,
    };
  }, [searchText, parseBookChapterVerse]);

  // Filter books - supports both English and Chinese
  const matchesFilter = useCallback((bookName: string, filter: string) => {
    if (!filter) return true;
    const filterTrimmed = filter.trim();

    // Check if filter contains Chinese characters
    if (containsChinese(filterTrimmed)) {
      // Find which book ID this English book name corresponds to
      const bookId = BOOK_IDS[bookName];
      if (!bookId) return false;

      // Get the Chinese name for this book
      const chineseName = BOOK_NAMES_ZH[bookId];
      if (!chineseName) return false;

      // Check if the Chinese name starts with or matches the filter
      if (chineseName.startsWith(filterTrimmed)) {
        return true;
      }

      // Also check if filter matches via findBookIdByChineseName
      const matchedBookId = findBookIdByChineseName(filterTrimmed);
      return matchedBookId === bookId;
    }

    // English matching (existing logic)
    const filterLower = filterTrimmed.toLowerCase();
    const bookLower = bookName.toLowerCase();

    // Normalize: remove all spaces for comparison (matches parsing logic)
    const filterNormalized = filterLower.replace(/\s+/g, '');
    const bookNormalized = bookLower.replace(/\s+/g, '');

    // Check normalized match (handles multi-word books like "Song of Solomon")
    if (bookNormalized.startsWith(filterNormalized)) {
      return true;
    }

    // Original logic for numbered books (with space handling)
    const numberMatch = bookLower.match(/^(\d)\s+(.+)$/);
    if (numberMatch) {
      const [, num, rest] = numberMatch;
      if (filterLower.startsWith(num)) {
        const afterNum = filterLower.substring(1).trim();
        if (!afterNum) return true;
        return rest.startsWith(afterNum) || rest.replace(/\s+/g, '').startsWith(afterNum.replace(/\s+/g, ''));
      }
      if (!filterLower.match(/^\d/)) {
        return rest.startsWith(filterLower) || rest.replace(/\s+/g, '').startsWith(filterNormalized);
      }
      return false;
    }

    // Fallback: original starts-with check
    return bookLower.startsWith(filterLower);
  }, []);

  const filteredBooks = useMemo(() => {
    return allBooks.filter(book => matchesFilter(book.name, filterText));
  }, [allBooks, filterText, matchesFilter]);

  // Intent detection - computed AFTER filteredBooks so we can prioritize book matches
  const searchIntent = useMemo<SearchIntent>(() => detectIntent(searchText), [searchText]);

  // CRITICAL: Book matches ALWAYS take priority over semantic search
  // If user types "exodus" and we have book matches, NEVER show semantic search
  const showSemanticSearch = useMemo(() => {
    // No search text = show book list
    if (!searchText.trim()) return false;
    // If there are ANY book matches, show book list (not semantic)
    if (filteredBooks.length > 0) return false;
    // Only show semantic if intent says semantic AND no book matches
    return searchIntent.type === 'semantic';
  }, [searchText, filteredBooks.length, searchIntent.type]);

  // Show keyword search when intent is 'keyword' and no book matches
  const showKeywordSearch = useMemo(() => {
    if (!searchText.trim()) return false;
    if (filteredBooks.length > 0) return false;
    return searchIntent.type === 'keyword';
  }, [searchText, filteredBooks.length, searchIntent.type]);

  // Parse search and find book
  const parseSearch = useCallback((input: string): { book: string; chapter: number; verse?: number } | null => {
    const parsed = parseBookChapterVerse(input);
    if (!parsed) return null;

    const { bookQuery, chapter, verse } = parsed;

    // If bookQuery contains Chinese, use Chinese lookup
    if (containsChinese(bookQuery)) {
      const bookId = findBookIdByChineseName(bookQuery);
      if (bookId) {
        const foundBook = allBooks.find(b => BOOK_IDS[b.name] === bookId);
        if (foundBook) {
          // If no chapter specified, return chapter 1
          const chapterNum = chapter || 1;
          if (chapterNum > 0 && chapterNum <= foundBook.chapters) {
            return { book: foundBook.name, chapter: chapterNum, verse };
          }
        }
      }
      return null;
    }

    // English matching (existing logic)
    const foundBook = allBooks.find(book => {
      if (book.name.toLowerCase().startsWith(bookQuery)) return true;

      const nameWords = book.name.toLowerCase().split(' ');
      if (nameWords.length > 1 && bookQuery.length >= 2) {
        const firstChar = nameWords[0];
        const secondStart = nameWords[1].substring(0, bookQuery.length - 1);
        if (bookQuery === firstChar + secondStart) return true;
      }

      return false;
    });

    // Chapter must be specified for English matching
    if (foundBook && chapter && chapter > 0 && chapter <= foundBook.chapters) {
      return { book: foundBook.name, chapter, verse };
    }

    return null;
  }, [allBooks, parseBookChapterVerse]);

  // Handle search submission
  const handleSearch = useCallback(() => {
    const result = parseSearch(searchText);
    if (result) {
      const bookId = BOOK_IDS[result.book];
      if (bookId) {
        const chapterId = bookId * 1000000 + result.chapter * 1000;

        // If verse was specified, include it in the selection
        if (result.verse && result.verse > 0) {
          const verseId = bookId * 1000000 + result.chapter * 1000 + result.verse;
          onSelect({
            bookId,
            chapterId,
            verseId,
            bookName: result.book,
            chapter: result.chapter,
            verse: result.verse,
          });
        } else {
          // Navigate to chapter without verse highlighting
          onSelect({
            bookId,
            chapterId,
            verseId: null,
            bookName: result.book,
            chapter: result.chapter,
          });
        }

        setSearchText('');
      }
    }
  }, [searchText, parseSearch, onSelect]);

  // Toggle book
  const toggleBook = useCallback((bookName: string) => {
    if (animationTimerRef.current) {
      clearTimeout(animationTimerRef.current);
    }
    setIsAnimating(true);

    animationTimerRef.current = setTimeout(() => {
      setIsAnimating(false);
      animationTimerRef.current = null;
    }, 550);

    setExpandedBook(current => (current === bookName ? null : bookName));
  }, []);

  // Return to chapter mode from verse mode by modifying search text
  const handleBackToChapters = useCallback(() => {
    // Remove verse separator and verse number from search text to go back to chapter mode
    // "gen3:16" → "gen3", "gen3:" → "gen3", "gen 3 16" → "gen3"
    const parsed = parseBookChapterVerse(searchText);
    if (parsed) {
      setSearchText(`${parsed.bookQuery}${parsed.chapter}`);
    }
    setVerseNumbers([]);
  }, [searchText, parseBookChapterVerse]);

  // Handle number selection (chapter or verse)
  const handleNumberSelect = useCallback((bookName: string, number: number) => {
    const bookId = BOOK_IDS[bookName];
    if (!bookId) return;

    if (displayMode === 'chapters') {
      // Chapter selected
      const chapterId = bookId * 1000000 + number * 1000;
      onSelect({
        bookId,
        chapterId,
        verseId: null,
        bookName,
        chapter: number,
      });
      setExpandedBook(null);
    } else {
      // Verse selected
      if (selectedChapter) {
        const chapterId = bookId * 1000000 + selectedChapter * 1000;
        const verseId = bookId * 1000000 + selectedChapter * 1000 + number;
        onSelect({
          bookId,
          chapterId,
          verseId,
          bookName,
          chapter: selectedChapter,
          verse: number,
        });
        setExpandedBook(null);
      }
    }
  }, [displayMode, selectedChapter, onSelect]);

  // Fetch verse numbers when entering verse mode
  useEffect(() => {
    if (displayMode === 'verses' && expandedBook && selectedChapter) {
      const bookId = BOOK_IDS[expandedBook];
      if (bookId) {
        bibleSQLite.getVerseNumbersForChapter(bookId, selectedChapter)
          .then(verses => {
            setVerseNumbers(verses);
          })
          .catch(err => {
            console.error('[SearchInterface] Failed to fetch verses:', err);
            setVerseNumbers([]);
          });
      }
    }
  }, [displayMode, expandedBook, selectedChapter]);

  // Auto-collapse on filter change
  const prevFilteredBooksRef = useRef<Book[]>([]);
  useEffect(() => {
    const prevBooks = prevFilteredBooksRef.current;
    const currentBooks = filteredBooks;

    const hasChanged =
      prevBooks.length !== currentBooks.length ||
      !prevBooks.every((book, idx) => book.name === currentBooks[idx]?.name);

    if (hasChanged && expandedBook) {
      setExpandedBook(null);
    }

    prevFilteredBooksRef.current = currentBooks;
  }, [filteredBooks, expandedBook]);

  // Auto-expand single result
  useEffect(() => {
    if (filterText && filteredBooks.length === 1) {
      setExpandedBook(filteredBooks[0].name);
    }
  }, [filterText, filteredBooks]);

  // Auto-expand first matching book when typing a book reference with chapter
  useEffect(() => {
    const parsed = parseBookChapterVerse(searchText);
    if (parsed && filteredBooks.length > 0) {
      setExpandedBook(filteredBooks[0].name);
    }
  }, [searchText, filteredBooks, parseBookChapterVerse]);

  // Prepare animations
  useEffect(() => {
    const trimmed = searchText.trim();
    if (trimmed) {
      setPrepareAnimations(true);
    } else {
      setPrepareAnimations(false);
    }
  }, [searchText]);

  // Auto-focus search input
  useEffect(() => {
    if (autoFocus) {
      const focusTimer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(focusTimer);
    }
  }, [autoFocus]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationTimerRef.current) {
        clearTimeout(animationTimerRef.current);
      }
      if (keywordSearchTimeoutRef.current) {
        clearTimeout(keywordSearchTimeoutRef.current);
      }
    };
  }, []);

  // Semantic search effect
  // Only runs when showSemanticSearch is true (no book matches)
  // No debounce - starts immediately and cancels previous search via version ref
  useEffect(() => {
    // Increment version to cancel any in-flight semantic searches
    semanticSearchVersionRef.current += 1;
    const thisSearchVersion = semanticSearchVersionRef.current;

    // Clear semantic state immediately when NOT showing semantic search
    if (!showSemanticSearch) {
      setSemanticResults([]);
      setIsSemanticLoading(false);
      setSemanticProgress('');
      setHasSearched(false); // Reset when leaving semantic search
      return;
    }

    // Get query from intent (only valid when type is 'semantic')
    const query = searchIntent.type === 'semantic' ? searchIntent.query : '';

    // Only search if we have enough characters
    if (query.length < 3) {
      setSemanticResults([]);
      setIsSemanticLoading(false);
      setSemanticProgress('');
      setHasSearched(false); // Reset for short queries
      return;
    }

    // Lazy load embeddings on first semantic search
    if (!embeddingsReady) {
      setIsSemanticLoading(true);
      setSemanticProgress('Preparing search...');
      setHasSearched(false);

      // Trigger lazy loading of embeddings
      (async () => {
        try {
          await initializeEmbeddingsDb();
          await loadEmbeddingsToMemory((progress) => {
            // Only update if this search is still current
            if (semanticSearchVersionRef.current === thisSearchVersion) {
              appStateStore$.embeddings_progress.set({
                percent: progress.percent,
                message: progress.message,
              });
              setSemanticProgress(progress.message || 'Loading search data...');
            }
          });
          appStateStore$.embeddings_ready.set(true);
          console.log('✅ Embeddings lazy-loaded - semantic search ready');
        } catch (err) {
          console.warn('[SearchInterface] Embeddings lazy load failed:', err);
          appStateStore$.embeddings_ready.set(false);
          if (semanticSearchVersionRef.current === thisSearchVersion) {
            setIsSemanticLoading(false);
            setSemanticProgress('Search unavailable');
          }
        }
      })();

      return; // Effect will re-run when embeddingsReady becomes true
    }

    // Start search immediately (no debounce)
    const runSearch = async () => {
      setIsSemanticLoading(true);
      setSemanticProgress('Searching scripture...');
      try {
        const results = await semanticSearchGrouped(query, {
          limit: 15,
          onProgress: (progress) => {
            // Only update progress if this search is still current
            if (semanticSearchVersionRef.current === thisSearchVersion) {
              setSemanticProgress(progress.message);
            }
          },
        });
        // Only update state if this search is still current
        if (semanticSearchVersionRef.current === thisSearchVersion) {
          setSemanticResults(results);
          setHasSearched(true); // Mark that a search has completed
        }
      } catch (error) {
        if (semanticSearchVersionRef.current === thisSearchVersion) {
          console.error('[SearchInterface] Semantic search failed:', error);
          setSemanticResults([]);
          setHasSearched(true); // Mark as searched even on error
        }
      } finally {
        if (semanticSearchVersionRef.current === thisSearchVersion) {
          setIsSemanticLoading(false);
          setSemanticProgress('');
        }
      }
    };

    runSearch();
  }, [showSemanticSearch, searchIntent, embeddingsReady]);

  // Keyword search effect
  // Only runs when showKeywordSearch is true (no book matches, not a question)
  useEffect(() => {
    // Increment version to cancel any in-flight keyword searches
    keywordSearchVersionRef.current += 1;
    const thisSearchVersion = keywordSearchVersionRef.current;

    // Clear keyword state immediately when NOT showing keyword search
    if (!showKeywordSearch) {
      setKeywordResults([]);
      setIsKeywordLoading(false);
      if (keywordSearchTimeoutRef.current) {
        clearTimeout(keywordSearchTimeoutRef.current);
      }
      return;
    }

    // Get query from intent (only valid when type is 'keyword')
    const query = searchIntent.type === 'keyword' ? searchIntent.query : '';

    // Debounce keyword search
    if (keywordSearchTimeoutRef.current) {
      clearTimeout(keywordSearchTimeoutRef.current);
    }

    // Only search if we have enough characters
    if (query.length < 2) {
      setKeywordResults([]);
      setIsKeywordLoading(false);
      return;
    }

    setIsKeywordLoading(true);

    // 150ms debounce (faster than semantic since it's local)
    keywordSearchTimeoutRef.current = setTimeout(async () => {
      // Check if this search was cancelled
      if (keywordSearchVersionRef.current !== thisSearchVersion) {
        return;
      }

      try {
        const { results } = await searchBible({
          query,
          searchType: 'text',
          maxResults: 50,
          includeContext: false,
        });
        // Only update state if this search is still current
        if (keywordSearchVersionRef.current === thisSearchVersion) {
          setKeywordResults(results);
        }
      } catch (error) {
        if (keywordSearchVersionRef.current === thisSearchVersion) {
          console.error('[SearchInterface] Keyword search failed:', error);
          setKeywordResults([]);
        }
      } finally {
        if (keywordSearchVersionRef.current === thisSearchVersion) {
          setIsKeywordLoading(false);
        }
      }
    }, 150); // 150ms debounce
  }, [showKeywordSearch, searchIntent]);

  // Handle navigation from keyword search results
  const handleKeywordNavigate = useCallback(
    (bookId: number, chapter: number, verse: number) => {
      const chapterId = bookId * 1000000 + chapter * 1000;
      const verseId = bookId * 1000000 + chapter * 1000 + verse;

      // Get book name from book ID
      const bookEntry = Object.entries(BOOK_IDS).find(([, id]) => id === bookId);
      const bookName = bookEntry ? bookEntry[0] : 'Unknown';

      onSelect({
        bookId,
        chapterId,
        verseId,
        bookName,
        chapter,
        verse,
      });
      setSearchText('');
      setKeywordResults([]);
    },
    [onSelect],
  );

  // Handle navigation from semantic search results
  const handleSemanticNavigate = useCallback(
    (bookId: number, chapter: number, verse: number) => {
      const chapterId = bookId * 1000000 + chapter * 1000;
      const verseId = bookId * 1000000 + chapter * 1000 + verse;

      // Get book name from book ID
      const bookEntry = Object.entries(BOOK_IDS).find(([, id]) => id === bookId);
      const bookName = bookEntry ? bookEntry[0] : 'Unknown';

      onSelect({
        bookId,
        chapterId,
        verseId,
        bookName,
        chapter,
        verse,
      });
      setSearchText('');
      setSemanticResults([]);
    },
    [onSelect],
  );

  // PERF: Memoize layout transitions to avoid creating new functions per book per render
  const layoutTransition = useMemo(() => {
    'worklet';
    return (values: any) => {
      'worklet';
      const duration = isAnimating ? 0 : 400;
      const deltaX = Math.abs(values.targetOriginX - values.currentOriginX);
      const deltaY = Math.abs(values.targetOriginY - values.currentOriginY);
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      const normalizedDistance = Math.min(distance / 1000, 1);
      const easeStrength = 0.4 - (normalizedDistance * 0.25);
      const customEasing = Easing.bezier(easeStrength, 0.0, easeStrength, 1.0);
      const isPrimarilyVertical = Math.abs(deltaY) > Math.abs(deltaX) * 3;
      const isActuallyTranslating = distance > 1 && !isPrimarilyVertical;

      const animations: any = {
        originX: withTiming(values.targetOriginX, { duration, easing: customEasing }),
        originY: withTiming(values.targetOriginY, { duration, easing: customEasing }),
        width: withTiming(values.targetWidth, { duration, easing: Easing.inOut(Easing.ease) }),
        height: withTiming(values.targetHeight, { duration, easing: Easing.inOut(Easing.ease) }),
      };

      if (duration > 0 && isActuallyTranslating) {
        animations.opacity = withSequence(
          withTiming(0.2, { duration: 100, easing: Easing.in(Easing.ease) }),
          withTiming(1.0, { duration: 500, easing: Easing.out(Easing.ease) })
        );
      }

      const initialValues: any = {
        originX: values.currentOriginX,
        originY: values.currentOriginY,
        width: values.currentWidth,
        height: values.currentHeight,
      };

      if (duration > 0 && isActuallyTranslating) {
        initialValues.opacity = 1;
      }

      return { animations, initialValues };
    };
  }, [isAnimating]);

  const chapterLayoutTransition = useMemo(() => {
    'worklet';
    return (values: any) => {
      'worklet';
      const duration = isAnimating ? 0 : 350;
      const deltaX = Math.abs(values.targetOriginX - values.currentOriginX);
      const deltaY = Math.abs(values.targetOriginY - values.currentOriginY);
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      const normalizedDistance = Math.min(distance / 500, 1);
      const easeStrength = 0.4 - (normalizedDistance * 0.25);
      const customEasing = Easing.bezier(easeStrength, 0.0, easeStrength, 1.0);
      const isPrimarilyVertical = Math.abs(deltaY) > Math.abs(deltaX) * 3;
      const isActuallyTranslating = distance > 1 && !isPrimarilyVertical;

      const animations: any = {
        originX: withTiming(values.targetOriginX, { duration, easing: customEasing }),
        originY: withTiming(values.targetOriginY, { duration, easing: customEasing }),
        width: withTiming(values.targetWidth, { duration, easing: Easing.inOut(Easing.ease) }),
        height: withTiming(values.targetHeight, { duration, easing: Easing.inOut(Easing.ease) }),
      };

      if (duration > 0 && isActuallyTranslating) {
        animations.opacity = withSequence(
          withTiming(0.2, { duration: 50, easing: Easing.in(Easing.ease) }),
          withTiming(1.0, { duration: 500, easing: Easing.out(Easing.ease) })
        );
      }

      const initialValues: any = {
        originX: values.currentOriginX,
        originY: values.currentOriginY,
        width: values.currentWidth,
        height: values.currentHeight,
      };

      if (duration > 0 && isActuallyTranslating) {
        initialValues.opacity = 1;
      }

      return { animations, initialValues };
    };
  }, [isAnimating]);

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <View style={styles.inputWrapper}>
          {/* Animated placeholder when input is empty */}
          {!searchText && (
            <View style={styles.placeholderContainer} pointerEvents="none">
              <AnimatedPlaceholder
                isVisible={!searchText}
                color={theme.colors.text.muted}
                fontSize={theme.typography.fontSize.base}
              />
            </View>
          )}
          {/* Auto-suggest overlay when user is typing */}
          {!!searchText && (
            <AutoSuggestOverlay
              inputText={searchText}
              filteredBooksCount={filteredBooks.length}
              textColor={theme.colors.text.muted}
              fontSize={theme.typography.fontSize.base}
              fontFamily={theme.typography.fontFamily.sansSerif}
              paddingHorizontal={16}
            />
          )}
          {/* TextInput with transparent background to show overlays */}
          <TextInput
            ref={searchInputRef}
            style={[
              styles.searchInput,
              { backgroundColor: 'transparent' }
            ]}
            placeholder=""
            placeholderTextColor={theme.colors.text.muted}
            value={searchText}
            onChangeText={setSearchText}
            onSubmitEditing={handleSearch}
            returnKeyType="go"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {/* Background for input (behind everything) */}
          <View
            style={[styles.inputBackground, {
              backgroundColor: theme.colors.interactive.modal.searchInput,
              borderColor: theme.colors.border,
            }]}
            pointerEvents="none"
          />
        </View>
        <TouchableOpacity
          style={[styles.searchButton, { opacity: searchText ? 1 : 0.5 }]}
          onPress={handleSearch}
          disabled={!searchText}
        >
          <Text style={styles.searchButtonText}>Go</Text>
        </TouchableOpacity>
      </View>

      {/* Conditional rendering: semantic search, keyword search, or book list */}
      {showSemanticSearch ? (
        <View style={styles.content}>
          <GroupedSemanticResultsList
            results={semanticResults}
            isLoading={isSemanticLoading}
            progressMessage={semanticProgress}
            query={searchIntent.type === 'semantic' ? searchIntent.query : ''}
            hasSearched={hasSearched}
            onNavigate={handleSemanticNavigate}
          />
        </View>
      ) : showKeywordSearch ? (
        <View style={styles.content}>
          <KeywordSearchResultsList
            results={keywordResults}
            isLoading={isKeywordLoading}
            query={searchIntent.type === 'keyword' ? searchIntent.query : ''}
            onNavigate={handleKeywordNavigate}
          />
        </View>
      ) : (
        <ScrollView
          ref={scrollViewRef}
          style={styles.content}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        contentContainerStyle={{ paddingBottom }}
      >
        <View style={styles.booksWrapper}>
          {/* PERF: Only render books after modal animation completes */}
          {isReady && allBooks.map(book => {
            const categoryKey = book.category as keyof typeof theme.colors.bookCategories;
            const categoryColors = theme.colors.bookCategories[categoryKey];
            const isExpanded = expandedBook === book.name;
            const isVisible = filteredBooks.some(b => b.name === book.name);
            const isFiltering = !!(filterText || chapterFilter || verseFilter);

            // Determine what numbers to show
            let numbers: number[] = [];
            // Use localized book name for display
            const localizedName = getLocalizedBookName(book.name);
            let headerText = localizedName;
            const bookDisplayMode: DisplayMode =
              (displayMode === 'verses' && book.name === expandedBook) ? 'verses' : 'chapters';

            if (isExpanded) {
              if (bookDisplayMode === 'verses' && verseNumbers.length > 0) {
                numbers = verseNumbers.filter(v =>
                  !verseFilter || String(v).startsWith(verseFilter)
                );
                headerText = `${localizedName} ${selectedChapter}`;
              } else {
                numbers = Array.from({ length: book.chapters }, (_, i) => i + 1)
                  .filter(ch => !chapterFilter || String(ch).startsWith(chapterFilter));
              }
            }

            return (
              <BookCard
                key={book.name}
                book={book}
                categoryColors={categoryColors}
                isExpanded={isExpanded}
                isVisible={isVisible}
                isFiltering={isFiltering}
                isAnimating={isAnimating}
                prepareAnimations={prepareAnimations}
                displayMode={bookDisplayMode}
                numbers={numbers}
                onToggle={toggleBook}
                onNumberSelect={handleNumberSelect}
                layoutTransition={layoutTransition}
                chapterLayoutTransition={chapterLayoutTransition}
                theme={theme}
                headerText={headerText}
                selectedChapter={selectedChapter}
                onBackToChapters={handleBackToChapters}
                containerWidth={containerWidth}
                scaleFactor={scaleFactor}
              />
            );
          })}
          </View>
        </ScrollView>
      )}
    </View>
  );
});

const createStyles = (theme: ReturnType<typeof getTheme>) => StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    backgroundColor: theme.colors.background.primary,
  },
  searchContainer: {
    flexDirection: 'row' as const,
    padding: 16,
    gap: 12,
    backgroundColor: theme.colors.background.secondary,
  },
  inputWrapper: {
    flex: 1,
    position: 'relative',
  },
  inputBackground: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    zIndex: 0,
  },
  placeholderContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 44,
    justifyContent: 'center',
    paddingHorizontal: 16,
    zIndex: 1,
  },
  searchInput: {
    height: 44,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.sansSerif,
    color: theme.colors.text.primary,
    zIndex: 2,
  },
  searchButton: {
    paddingHorizontal: 20,
    height: 44,
    backgroundColor: theme.colors.interactive.modal.searchButton,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchButtonText: {
    color: theme.mode === 'dark' ? theme.colors.text.primary : '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
  },
  booksWrapper: {
    padding: 8,
    gap: 6,
  },
});
