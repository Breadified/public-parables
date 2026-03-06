/**
 * Type declarations for talisman library
 * @see https://github.com/Yomguithereal/talisman
 */

declare module 'talisman/phonetics/double-metaphone' {
  /**
   * Double Metaphone phonetic algorithm
   * Returns two possible phonetic encodings for a word
   * @param word - The word to encode
   * @returns Tuple of [primary encoding, secondary encoding]
   */
  function doubleMetaphone(word: string): [string, string];
  export = doubleMetaphone;
}

declare module 'talisman/metrics/jaro-winkler' {
  /**
   * Jaro-Winkler string similarity metric
   * @param a - First string
   * @param b - Second string
   * @returns Similarity score between 0 and 1 (1 = identical)
   */
  function jaroWinkler(a: string, b: string): number;
  export = jaroWinkler;
}
