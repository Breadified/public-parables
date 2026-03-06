/**
 * Fuzzy Matcher for Bible Search
 *
 * Combines phonetic matching (Double Metaphone) with fuzzy string matching (Jaro-Winkler)
 * to handle misspellings, phonetic errors, and typos in search queries.
 *
 * Uses the 'talisman' library for battle-tested implementations.
 * Vocabulary is extracted from actual ESV Bible text (9,000+ words).
 *
 * Handles cases like:
 * - "Gyros" → "Jairus" (phonetic: G/J sound similar)
 * - "Farisees" → "Pharisees" (phonetic: F/Ph)
 * - "forgivness" → "forgiveness" (typo: missing letter)
 * - "resurection" → "resurrection" (typo: missing letter)
 * - "Mefibosheth" → "Mephibosheth" (obscure biblical name)
 */

import doubleMetaphone from 'talisman/phonetics/double-metaphone';
import jaroWinklerFn from 'talisman/metrics/jaro-winkler';

import { BIBLE_VOCABULARY, PROPER_NOUNS, isKnownWord } from './bibleVocabulary';

// =============================================================================
// TYPES
// =============================================================================

export interface FuzzyMatch {
  term: string;
  score: number;
  method: 'exact' | 'phonetic' | 'fuzzy';
}

// =============================================================================
// STOPWORDS (common words we don't need to fuzzy match)
// =============================================================================

const STOPWORDS = new Set([
  'the',
  'and',
  'you',
  'for',
  'that',
  'his',
  'your',
  'they',
  'shall',
  'not',
  'will',
  'with',
  'him',
  'all',
  'who',
  'them',
  'from',
  'have',
  'was',
  'but',
  'said',
  'their',
  'are',
  'when',
  'this',
  'out',
  'then',
  'has',
  'were',
  'one',
  'had',
  'her',
  'what',
  'before',
  'into',
  'may',
  'also',
  'been',
  'there',
  'which',
  'about',
  'these',
  'those',
  'other',
  'after',
  'would',
  'could',
  'should',
  'being',
  'more',
  'some',
  'than',
  'upon',
  'over',
  'because',
  'through',
  'only',
  'even',
  'every',
  'against',
]);

// =============================================================================
// SEARCHABLE VOCABULARY WITH PRE-COMPUTED PHONETIC CODES
// Filter out stopwords, keep meaningful words for fuzzy matching
// =============================================================================

interface VocabEntry {
  word: string;
  phonetic: [string, string]; // Pre-computed Double Metaphone
  isProperNoun: boolean; // Names, places get priority when query is capitalized
}

/**
 * Vocabulary for fuzzy matching - excludes common stopwords
 * Pre-computes phonetic codes for fast matching
 * Tracks proper nouns for capitalization-based prioritization
 */
export const SEARCHABLE_VOCABULARY: VocabEntry[] = (() => {
  // Filter vocabulary to exclude stopwords and very short words
  const meaningfulWords = BIBLE_VOCABULARY.filter(
    (word) => word.length >= 4 && !STOPWORDS.has(word),
  );

  // Track which words are proper nouns
  const properNounSet = new Set(PROPER_NOUNS.map((w) => w.toLowerCase()));

  // Add proper nouns (already filtered for length in extraction)
  const properNounsLower = PROPER_NOUNS.map((w) => w.toLowerCase());

  // Combine and deduplicate
  const combined = [...new Set([...meaningfulWords, ...properNounsLower])];

  // Pre-compute phonetic codes and mark proper nouns
  return combined.map((word) => ({
    word,
    phonetic: doubleMetaphone(word),
    isProperNoun: properNounSet.has(word),
  }));
})();

// Simple string array for backward compatibility
export const VOCABULARY_WORDS: string[] = SEARCHABLE_VOCABULARY.map((v) => v.word);

// =============================================================================
// CORE MATCHING FUNCTIONS
// =============================================================================

/**
 * Jaro-Winkler similarity (0-1, higher is more similar)
 * Re-export from talisman for convenience
 */
export function jaroWinkler(s1: string, s2: string): number {
  return jaroWinklerFn(s1, s2);
}

/**
 * Check if two words match phonetically using Double Metaphone
 */
export function phoneticMatch(word1: string, word2: string): boolean {
  const dm1 = doubleMetaphone(word1);
  const dm2 = doubleMetaphone(word2);

  // Match if any encoding matches
  return dm1.some((a) => dm2.some((b) => a && b && a === b));
}

/**
 * Find the best matching term from a list of candidates
 *
 * @param query - The search query (possibly misspelled)
 * @param candidates - List of correct terms to match against
 * @param options - Matching options
 * @returns Best match or null if no good match found
 */
export function findBestMatch(
  query: string,
  candidates: string[],
  options: {
    minJaroWinkler?: number;
    phoneticOnly?: boolean;
  } = {},
): FuzzyMatch | null {
  const { minJaroWinkler = 0.85, phoneticOnly = false } = options;

  const queryLower = query.toLowerCase();

  // Check for exact match first
  for (const candidate of candidates) {
    if (candidate.toLowerCase() === queryLower) {
      return { term: candidate, score: 1, method: 'exact' };
    }
  }

  let bestMatch: FuzzyMatch | null = null;
  let bestScore = 0;

  for (const candidate of candidates) {
    // Check phonetic match (Double Metaphone)
    if (phoneticMatch(query, candidate)) {
      const score = 0.95; // High score for phonetic match
      if (score > bestScore) {
        bestScore = score;
        bestMatch = { term: candidate, score, method: 'phonetic' };
      }
      continue;
    }

    // Check fuzzy match (Jaro-Winkler) if not phonetic-only
    if (!phoneticOnly) {
      const jwScore = jaroWinkler(queryLower, candidate.toLowerCase());
      if (jwScore >= minJaroWinkler && jwScore > bestScore) {
        bestScore = jwScore;
        bestMatch = { term: candidate, score: jwScore, method: 'fuzzy' };
      }
    }
  }

  return bestMatch;
}

/**
 * Find all matching terms above threshold
 */
export function findAllMatches(
  query: string,
  candidates: string[],
  options: {
    minScore?: number;
    maxResults?: number;
  } = {},
): FuzzyMatch[] {
  const { minScore = 0.8, maxResults = 5 } = options;

  const queryLower = query.toLowerCase();
  const matches: FuzzyMatch[] = [];

  for (const candidate of candidates) {
    const candidateLower = candidate.toLowerCase();

    // Exact match
    if (candidateLower === queryLower) {
      matches.push({ term: candidate, score: 1, method: 'exact' });
      continue;
    }

    // Phonetic match
    if (phoneticMatch(query, candidate)) {
      matches.push({ term: candidate, score: 0.95, method: 'phonetic' });
      continue;
    }

    // Fuzzy match
    const jwScore = jaroWinkler(queryLower, candidateLower);
    if (jwScore >= minScore) {
      matches.push({ term: candidate, score: jwScore, method: 'fuzzy' });
    }
  }

  // Sort by score descending and limit results
  return matches.sort((a, b) => b.score - a.score).slice(0, maxResults);
}

// =============================================================================
// HIGH-LEVEL API (uses full Bible vocabulary)
// =============================================================================

/**
 * Check if a word exists in the Bible (exact match)
 */
export { isKnownWord };

/**
 * Fast phonetic matching using pre-computed codes
 * Much faster than computing Double Metaphone for each comparison
 * Uses Jaro-Winkler as tie-breaker for multiple phonetic matches
 * Boosts proper nouns when query starts with capital letter
 */
function findBestMatchFast(query: string, minJaroWinkler = 0.8): FuzzyMatch | null {
  const queryLower = query.toLowerCase();
  const queryPhonetic = doubleMetaphone(query);

  // If query starts with capital, user likely wants a proper noun (name/place)
  const queryIsCapitalized = query.length > 0 && query[0] === query[0].toUpperCase() && query[0] !== query[0].toLowerCase();
  const PROPER_NOUN_BOOST = 0.15; // Boost for proper nouns when query is capitalized
  const FIRST_LETTER_BOOST = 0.2; // Boost when first letter sounds similar (G/J, F/Ph, etc.)

  // Letters that sound similar (for first-letter matching)
  const SIMILAR_SOUNDS: Record<string, string[]> = {
    g: ['g', 'j', 'k'],
    j: ['j', 'g', 'y'],
    f: ['f', 'p', 'v'],
    p: ['p', 'f', 'b'],
    c: ['c', 'k', 's'],
    k: ['k', 'c', 'g'],
    s: ['s', 'c', 'z'],
    z: ['z', 's'],
    v: ['v', 'f', 'w'],
    w: ['w', 'v'],
    y: ['y', 'j', 'i'],
  };

  const queryFirstLetter = queryLower[0];
  const similarLetters = SIMILAR_SOUNDS[queryFirstLetter] || [queryFirstLetter];

  let bestPhoneticMatch: { word: string; score: number; isProperNoun: boolean } | null = null;
  let bestFuzzyMatch: FuzzyMatch | null = null;
  let bestFuzzyScore = 0;

  for (const entry of SEARCHABLE_VOCABULARY) {
    // Exact match - return immediately
    if (entry.word === queryLower) {
      return { term: entry.word, score: 1, method: 'exact' };
    }

    // Fast phonetic match (compare pre-computed codes)
    const phoneticMatches = queryPhonetic.some((qCode) =>
      entry.phonetic.some((eCode) => qCode && eCode && qCode === eCode),
    );

    if (phoneticMatches) {
      // Use Jaro-Winkler + boosts as tie-breaker
      let score = jaroWinkler(queryLower, entry.word);

      // Boost when first letter sounds similar (Gyros → Jairus, not Cross)
      const entryFirstLetter = entry.word[0];
      if (similarLetters.includes(entryFirstLetter)) {
        score += FIRST_LETTER_BOOST;
      }

      // Boost proper nouns when query is capitalized
      if (queryIsCapitalized && entry.isProperNoun) {
        score += PROPER_NOUN_BOOST;
      }

      if (!bestPhoneticMatch || score > bestPhoneticMatch.score) {
        bestPhoneticMatch = { word: entry.word, score, isProperNoun: entry.isProperNoun };
      }
      continue;
    }

    // Fuzzy match (Jaro-Winkler) for non-phonetic matches
    let jwScore = jaroWinkler(queryLower, entry.word);
    if (queryIsCapitalized && entry.isProperNoun) {
      jwScore += PROPER_NOUN_BOOST;
    }

    if (jwScore >= minJaroWinkler && jwScore > bestFuzzyScore) {
      bestFuzzyScore = jwScore;
      bestFuzzyMatch = { term: entry.word, score: jwScore, method: 'fuzzy' };
    }
  }

  // Prefer phonetic match over fuzzy match
  if (bestPhoneticMatch) {
    return {
      term: bestPhoneticMatch.word,
      score: 0.95,
      method: 'phonetic',
    };
  }

  return bestFuzzyMatch;
}

/**
 * Correct a potentially misspelled word against Bible vocabulary
 * Returns the corrected word or null if no good match
 */
export function correctWord(query: string): FuzzyMatch | null {
  // Skip very short words or stopwords
  if (query.length < 4 || STOPWORDS.has(query.toLowerCase())) {
    return null;
  }

  return findBestMatchFast(query, 0.8);
}

/**
 * Get spelling suggestions for a word (fast version)
 */
export function suggestCorrections(query: string, maxSuggestions = 3): FuzzyMatch[] {
  if (query.length < 4) {
    return [];
  }

  const queryLower = query.toLowerCase();
  const queryPhonetic = doubleMetaphone(query);
  const matches: FuzzyMatch[] = [];

  for (const entry of SEARCHABLE_VOCABULARY) {
    // Exact match
    if (entry.word === queryLower) {
      matches.push({ term: entry.word, score: 1, method: 'exact' });
      continue;
    }

    // Phonetic match (using pre-computed codes)
    const phoneticMatches = queryPhonetic.some((qCode) =>
      entry.phonetic.some((eCode) => qCode && eCode && qCode === eCode),
    );

    if (phoneticMatches) {
      matches.push({ term: entry.word, score: 0.95, method: 'phonetic' });
      continue;
    }

    // Fuzzy match
    const jwScore = jaroWinkler(queryLower, entry.word);
    if (jwScore >= 0.75) {
      matches.push({ term: entry.word, score: jwScore, method: 'fuzzy' });
    }
  }

  // Sort by score descending and limit
  return matches.sort((a, b) => b.score - a.score).slice(0, maxSuggestions);
}

// =============================================================================
// LEGACY API (backward compatibility)
// =============================================================================

/** @deprecated Use VOCABULARY_WORDS instead */
export const ALL_BIBLICAL_TERMS = VOCABULARY_WORDS;

/** @deprecated Use correctWord instead */
export function correctBiblicalTerm(query: string): FuzzyMatch | null {
  return correctWord(query);
}

/** @deprecated Use suggestCorrections instead */
export function suggestBiblicalTerms(query: string, maxSuggestions = 3): FuzzyMatch[] {
  return suggestCorrections(query, maxSuggestions);
}
