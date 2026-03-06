/**
 * Bible Book Name Translations
 * Provides localized book names for different languages
 */

/**
 * Chinese book name translations (Simplified Chinese - used in CUV)
 */
export const BOOK_NAMES_ZH: Record<number, string> = {
  // Old Testament - Law (Torah/Pentateuch)
  1: '创世记',
  2: '出埃及记',
  3: '利未记',
  4: '民数记',
  5: '申命记',

  // Old Testament - History
  6: '约书亚记',
  7: '士师记',
  8: '路得记',
  9: '撒母耳记上',
  10: '撒母耳记下',
  11: '列王纪上',
  12: '列王纪下',
  13: '历代志上',
  14: '历代志下',
  15: '以斯拉记',
  16: '尼希米记',
  17: '以斯帖记',

  // Old Testament - Poetry/Wisdom
  18: '约伯记',
  19: '诗篇',
  20: '箴言',
  21: '传道书',
  22: '雅歌',

  // Old Testament - Major Prophets
  23: '以赛亚书',
  24: '耶利米书',
  25: '耶利米哀歌',
  26: '以西结书',
  27: '但以理书',

  // Old Testament - Minor Prophets
  28: '何西阿书',
  29: '约珥书',
  30: '阿摩司书',
  31: '俄巴底亚书',
  32: '约拿书',
  33: '弥迦书',
  34: '那鸿书',
  35: '哈巴谷书',
  36: '西番雅书',
  37: '哈该书',
  38: '撒迦利亚书',
  39: '玛拉基书',

  // New Testament - Gospels
  40: '马太福音',
  41: '马可福音',
  42: '路加福音',
  43: '约翰福音',

  // New Testament - Acts
  44: '使徒行传',

  // New Testament - Paul's Letters
  45: '罗马书',
  46: '哥林多前书',
  47: '哥林多后书',
  48: '加拉太书',
  49: '以弗所书',
  50: '腓立比书',
  51: '歌罗西书',
  52: '帖撒罗尼迦前书',
  53: '帖撒罗尼迦后书',
  54: '提摩太前书',
  55: '提摩太后书',
  56: '提多书',
  57: '腓利门书',

  // New Testament - General Letters
  58: '希伯来书',
  59: '雅各书',
  60: '彼得前书',
  61: '彼得后书',
  62: '约翰一书',
  63: '约翰二书',
  64: '约翰三书',
  65: '犹大书',

  // New Testament - Prophecy
  66: '启示录',
};

export type SupportedLanguage = 'en' | 'zh';
export const DEFAULT_LANGUAGE: SupportedLanguage = 'en';

/**
 * Reverse lookup: Chinese name → book ID
 * Built from BOOK_NAMES_ZH for O(1) lookup
 */
export const BOOK_NAMES_ZH_REVERSE: Map<string, number> = new Map(
  Object.entries(BOOK_NAMES_ZH).map(([id, name]) => [name, parseInt(id, 10)])
);

/**
 * Common Chinese aliases/abbreviations for books
 * Maps shortened or alternate forms to book IDs
 */
export const BOOK_ALIASES_ZH: Map<string, number> = new Map([
  // Genesis aliases
  ['创', 1],
  ['创世', 1],

  // Exodus aliases
  ['出', 2],
  ['出埃及', 2],

  // Psalms aliases
  ['诗', 19],

  // Proverbs aliases
  ['箴', 20],

  // Song of Solomon aliases
  ['歌', 22],

  // Isaiah aliases
  ['赛', 23],

  // Matthew aliases
  ['太', 40],
  ['马太', 40],

  // Mark aliases
  ['可', 41],
  ['马可', 41],

  // Luke aliases
  ['路', 42],
  ['路加', 42],

  // John (Gospel) aliases
  ['约', 43],
  ['约翰', 43],

  // Acts aliases
  ['徒', 44],
  ['使徒', 44],

  // Romans aliases
  ['罗', 45],

  // 1 Corinthians aliases
  ['林前', 46],

  // 2 Corinthians aliases
  ['林后', 47],

  // Galatians aliases
  ['加', 48],

  // Ephesians aliases
  ['弗', 49],

  // Philippians aliases
  ['腓', 50],

  // Colossians aliases
  ['西', 51],

  // 1 Thessalonians aliases
  ['帖前', 52],

  // 2 Thessalonians aliases
  ['帖后', 53],

  // 1 Timothy aliases
  ['提前', 54],

  // 2 Timothy aliases
  ['提后', 55],

  // Titus aliases
  ['多', 56],

  // Philemon aliases
  ['门', 57],

  // Hebrews aliases
  ['来', 58],

  // James aliases
  ['雅', 59],

  // 1 Peter aliases
  ['彼前', 60],

  // 2 Peter aliases
  ['彼后', 61],

  // 1 John aliases
  ['约一', 62],
  ['约壹', 62],

  // 2 John aliases
  ['约二', 63],
  ['约贰', 63],

  // 3 John aliases
  ['约三', 64],
  ['约叁', 64],

  // Jude aliases
  ['犹', 65],

  // Revelation aliases
  ['启', 66],
]);

/**
 * Find a book ID by Chinese name (full name, alias, or partial match)
 * Returns undefined if no match found
 */
export function findBookIdByChineseName(input: string): number | undefined {
  const trimmed = input.trim();
  if (!trimmed) return undefined;

  // Try exact match first
  const exactMatch = BOOK_NAMES_ZH_REVERSE.get(trimmed);
  if (exactMatch !== undefined) return exactMatch;

  // Try alias match
  const aliasMatch = BOOK_ALIASES_ZH.get(trimmed);
  if (aliasMatch !== undefined) return aliasMatch;

  // Try partial/prefix match on full names
  for (const [name, id] of BOOK_NAMES_ZH_REVERSE) {
    if (name.startsWith(trimmed)) {
      return id;
    }
  }

  return undefined;
}

/**
 * Check if input contains Chinese characters
 */
export function containsChinese(input: string): boolean {
  return /[\u4e00-\u9fff]/.test(input);
}
