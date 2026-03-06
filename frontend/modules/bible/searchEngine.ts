/**
 * Bible Search Engine - Sprint 3
 * Advanced search functionality with fuzzy matching and smart filtering
 */

import { bibleStore$, type VerseLineData, type BookData, type ChapterData } from "../../state/bibleStore";
import { getGlobalChapterIndexFromVerseId, BIBLE_BOOK_CHAPTER_OFFSETS, getBookName, getChapterDisplayName, findBookByPartialName } from "./bibleBookMappings";

export interface SearchResult {
  verse: VerseLineData;
  book: string;
  chapter: number;
  reference: string;
  relevanceScore: number;
  highlightedText: string;
  context: {
    previousVerse?: VerseLineData;
    nextVerse?: VerseLineData;
  };
}

export interface SearchOptions {
  query: string;
  searchType: 'text' | 'reference' | 'keyword' | 'exact';
  maxResults?: number;
  includeContext?: boolean;
  bookFilter?: string[];
  testamentFilter?: 'Old' | 'New' | 'All';
}

export interface SearchStatistics {
  totalResults: number;
  searchTimeMs: number;
  booksSearched: string[];
  mostRelevantResult?: SearchResult;
}

/**
 * Main search engine class
 */
export class BibleSearchEngine {
  private static instance: BibleSearchEngine;
  
  static getInstance(): BibleSearchEngine {
    if (!BibleSearchEngine.instance) {
      BibleSearchEngine.instance = new BibleSearchEngine();
    }
    return BibleSearchEngine.instance;
  }

  /**
   * Perform comprehensive Bible search
   */
  async search(options: SearchOptions): Promise<{
    results: SearchResult[];
    statistics: SearchStatistics;
  }> {
    const startTime = performance.now();
    const { query, searchType, maxResults = 50, includeContext = true } = options;

    if (!query || query.length < 2) {
      return {
        results: [],
        statistics: {
          totalResults: 0,
          searchTimeMs: 0,
          booksSearched: [],
        }
      };
    }

    const verseLines = bibleStore$.verse_lines.get();
    const books = bibleStore$.books.get();
    const chapters = bibleStore$.chapters.get();

    let results: SearchResult[] = [];

    switch (searchType) {
      case 'text':
        results = await this.searchByText(query, verseLines, books, chapters, includeContext);
        break;
      case 'reference':
        results = await this.searchByReference(query, verseLines, books, chapters, includeContext);
        break;
      case 'keyword':
        results = await this.searchByKeyword(query, verseLines, books, chapters, includeContext);
        break;
      case 'exact':
        results = await this.searchExact(query, verseLines, books, chapters, includeContext);
        break;
    }

    // Apply filters
    results = this.applyFilters(results, options);

    // Sort by relevance
    results.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Limit results
    results = results.slice(0, maxResults);

    const endTime = performance.now();
    const searchTimeMs = endTime - startTime;

    const statistics: SearchStatistics = {
      totalResults: results.length,
      searchTimeMs,
      booksSearched: [...new Set(results.map(r => r.book))],
      mostRelevantResult: results[0],
    };

    return { results, statistics };
  }

  /**
   * Search by text content with fuzzy matching
   */
  private async searchByText(
    query: string,
    verseLines: VerseLineData[],
    books: BookData[],
    chapters: ChapterData[],
    includeContext: boolean
  ): Promise<SearchResult[]> {
    const normalizedQuery = query.toLowerCase().trim();
    const queryWords = normalizedQuery.split(/\s+/).filter(word => word.length > 1);
    const results: SearchResult[] = [];

    for (const verse of verseLines) {
      const normalizedText = verse.text.toLowerCase();
      const textWords = normalizedText.split(/\s+/);
      
      let relevanceScore = 0;
      let highlightedText = verse.text;

      // Calculate relevance based on word matches
      for (const queryWord of queryWords) {
        for (const textWord of textWords) {
          if (textWord.includes(queryWord)) {
            relevanceScore += this.calculateWordRelevance(queryWord, textWord);
            // Highlight matching words (case insensitive)
            const regex = new RegExp(`\\b${queryWord}`, 'gi');
            highlightedText = highlightedText.replace(regex, `**$&**`);
          }
        }
      }

      // Boost score for exact phrase matches
      if (normalizedText.includes(normalizedQuery)) {
        relevanceScore *= 2;
      }

      if (relevanceScore > 0) {
        const reference = this.getVerseReference(verse, books, chapters);
        const context = includeContext ? this.getVerseContext(verse, verseLines) : {};

        results.push({
          verse,
          book: reference.book,
          chapter: reference.chapter,
          reference: reference.fullReference,
          relevanceScore,
          highlightedText,
          context,
        });
      }
    }

    return results;
  }

  /**
   * Search by Bible reference (e.g., "John 3:16", "Genesis 1", "Romans")
   * Uses the X00Y00Z ID structure for precise book/chapter/verse identification
   */
  private async searchByReference(
    query: string,
    verseLines: VerseLineData[],
    books: BookData[],
    chapters: ChapterData[],
    includeContext: boolean
  ): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const normalizedQuery = query.toLowerCase().trim();

    // Parse reference patterns
    const patterns = [
      /^(\w+(?:\s+\w+)*)\s+(\d+):(\d+)$/i,  // "John 3:16" or "1 Kings 2:3"
      /^(\w+(?:\s+\w+)*)\s+(\d+)$/i,        // "John 3" or "1 Kings 2"
      /^(\w+(?:\s+\w+)*)$/i,                // "John" or "1 Kings"
    ];

    for (const pattern of patterns) {
      const match = normalizedQuery.match(pattern);
      if (match) {
        const [, bookName, chapterNum, verseNum] = match;
        
        // Find matching book using the unified book mappings
        const matchedBook = findBookByPartialName(bookName);
        const book = matchedBook ? books.find(b => b.name === matchedBook.name) : null;

        if (book) {
          // Extract book ID from the book data structure (assuming numerical ID system)
          const bookId = this.extractBookIdFromBook(book);
          
          if (bookId) {
            // Get verses using the X00Y00Z ID structure
            const targetVerses = this.getVersesByReferenceWithId(
              bookId,
              verseLines,
              books,
              chapters,
              chapterNum ? parseInt(chapterNum) : undefined,
              verseNum ? parseInt(verseNum) : undefined
            );

            for (const verse of targetVerses) {
              const reference = this.getVerseReference(verse, books, chapters);
              const context = includeContext ? this.getVerseContext(verse, verseLines) : {};

              results.push({
                verse,
                book: reference.book,
                chapter: reference.chapter,
                reference: reference.fullReference,
                relevanceScore: 100, // High relevance for exact reference matches
                highlightedText: verse.text,
                context,
              });
            }
          }
        }
        break;
      }
    }

    return results;
  }

  /**
   * Search by keywords with semantic matching
   */
  private async searchByKeyword(
    query: string,
    verseLines: VerseLineData[],
    books: BookData[],
    chapters: ChapterData[],
    includeContext: boolean
  ): Promise<SearchResult[]> {
    // For now, use enhanced text search
    // In a full implementation, this would include semantic analysis
    const keywords = query.toLowerCase().split(/[,\s]+/).filter(k => k.length > 2);
    const results: SearchResult[] = [];

    for (const verse of verseLines) {
      const normalizedText = verse.text.toLowerCase();
      let relevanceScore = 0;
      let highlightedText = verse.text;

      for (const keyword of keywords) {
        if (normalizedText.includes(keyword)) {
          relevanceScore += 50;
          const regex = new RegExp(`\\b${keyword}`, 'gi');
          highlightedText = highlightedText.replace(regex, `**$&**`);
        }
      }

      if (relevanceScore > 0) {
        const reference = this.getVerseReference(verse, books, chapters);
        const context = includeContext ? this.getVerseContext(verse, verseLines) : {};

        results.push({
          verse,
          book: reference.book,
          chapter: reference.chapter,
          reference: reference.fullReference,
          relevanceScore,
          highlightedText,
          context,
        });
      }
    }

    return results;
  }

  /**
   * Exact phrase search
   */
  private async searchExact(
    query: string,
    verseLines: VerseLineData[],
    books: BookData[],
    chapters: ChapterData[],
    includeContext: boolean
  ): Promise<SearchResult[]> {
    const normalizedQuery = query.toLowerCase().trim();
    const results: SearchResult[] = [];

    for (const verse of verseLines) {
      const normalizedText = verse.text.toLowerCase();
      
      if (normalizedText.includes(normalizedQuery)) {
        const reference = this.getVerseReference(verse, books, chapters);
        const context = includeContext ? this.getVerseContext(verse, verseLines) : {};

        // Highlight exact match
        const regex = new RegExp(`(${query})`, 'gi');
        const highlightedText = verse.text.replace(regex, '**$1**');

        results.push({
          verse,
          book: reference.book,
          chapter: reference.chapter,
          reference: reference.fullReference,
          relevanceScore: 100,
          highlightedText,
          context,
        });
      }
    }

    return results;
  }

  /**
   * Apply search filters
   */
  private applyFilters(results: SearchResult[], options: SearchOptions): SearchResult[] {
    let filteredResults = results;

    // Filter by books
    if (options.bookFilter && options.bookFilter.length > 0) {
      filteredResults = filteredResults.filter(result =>
        options.bookFilter!.includes(result.book)
      );
    }

    // Filter by testament
    if (options.testamentFilter && options.testamentFilter !== 'All') {
      const books = bibleStore$.books.get();
      filteredResults = filteredResults.filter(result => {
        const book = books.find((b: any) => b.name === result.book);
        return book?.testament === options.testamentFilter;
      });
    }

    return filteredResults;
  }

  /**
   * Calculate word relevance score
   */
  private calculateWordRelevance(queryWord: string, textWord: string): number {
    if (queryWord === textWord) return 10;
    if (textWord.startsWith(queryWord)) return 8;
    if (textWord.includes(queryWord)) return 5;
    if (this.levenshteinDistance(queryWord, textWord) <= 2) return 3;
    return 1;
  }

  /**
   * Calculate Levenshtein distance for fuzzy matching
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Get verse reference information using X00Y00Z ID structure for better performance
   */
  private getVerseReference(
    verse: VerseLineData,
    books: BookData[],
    chapters: ChapterData[]
  ): { book: string; chapter: number; fullReference: string } {
    // Try to extract reference from verse ID using X00Y00Z structure
    if ('id' in verse && typeof verse.id === 'number') {
      const bookNumber = Math.floor(verse.id / 1000000);
      const chapterNumber = Math.floor((verse.id % 1000000) / 1000);
      const verseNumber = verse.id % 1000;
      
      // Use centralized book name mapping
      const bookName = getBookName(bookNumber);
      if (bookName !== 'Unknown') {
        const fullReference = `${bookName} ${chapterNumber}:${verseNumber}`;
        return {
          book: bookName,
          chapter: chapterNumber,
          fullReference,
        };
      }
    }

    // Fallback to the original method if ID structure doesn't work
    const chapter = chapters.find(ch =>
      ch.sections.some(section =>
        section.paragraphs.some(paragraph =>
          paragraph.verse_lines.some(vl => vl.id === verse.id)
        )
      )
    );

    if (!chapter) {
      return { book: 'Unknown', chapter: 0, fullReference: 'Unknown' };
    }

    const book = books.find(b =>
      b.chapters.some(ch => ch.id === chapter.id)
    );

    if (!book) {
      return { book: 'Unknown', chapter: chapter.chapter_number || 0, fullReference: 'Unknown' };
    }

    const verseNumber = 'verse_number' in verse ? verse.verse_number : 1;
    const fullReference = `${book.name} ${chapter.chapter_number}:${verseNumber}`;
    
    return {
      book: book.name,
      chapter: chapter.chapter_number || 0,
      fullReference,
    };
  }

  /**
   * Get verse context (previous and next verses)
   */
  private getVerseContext(
    verse: VerseLineData,
    verseLines: VerseLineData[]
  ): { previousVerse?: VerseLineData; nextVerse?: VerseLineData } {
    const currentIndex = verseLines.findIndex(vl => vl.id === verse.id);
    
    return {
      previousVerse: currentIndex > 0 ? verseLines[currentIndex - 1] : undefined,
      nextVerse: currentIndex < verseLines.length - 1 ? verseLines[currentIndex + 1] : undefined,
    };
  }

  /**
   * Extract book ID from book data structure
   * Assumes the book has an ID that follows the X000000 pattern
   */
  private extractBookIdFromBook(book: BookData): number | null {
    // If the book has a direct ID field that follows the X000000 pattern
    if ('id' in book && typeof book.id === 'number') {
      const bookNumber = Math.floor(book.id / 1000000);
      if (bookNumber >= 1 && bookNumber <= 66) {
        return bookNumber;
      }
    }
    
    // Fallback: try to determine from chapters if available
    if (book.chapters && book.chapters.length > 0) {
      const firstChapter = book.chapters[0];
      if ('id' in firstChapter && typeof firstChapter.id === 'number') {
        const bookNumber = Math.floor(firstChapter.id / 1000000);
        if (bookNumber >= 1 && bookNumber <= 66) {
          return bookNumber;
        }
      }
    }
    
    // Final fallback: reverse lookup using the centralized book name mapping
    // Search through BIBLE_BOOK_NAMES to find the book number by name
    for (let i = 1; i <= 66; i++) {
      if (getBookName(i) === book.name) {
        return i;
      }
    }
    
    return null;
  }

  /**
   * Get verses by reference using the X00Y00Z ID structure
   */
  private getVersesByReferenceWithId(
    bookId: number,
    verseLines: VerseLineData[],
    books: BookData[],
    chapters: ChapterData[],
    chapterNum?: number,
    verseNum?: number
  ): VerseLineData[] {
    const results: VerseLineData[] = [];
    
    // Filter verses based on the X00Y00Z ID structure
    for (const verse of verseLines) {
      if ('id' in verse && typeof verse.id === 'number') {
        const verseBookId = Math.floor(verse.id / 1000000);
        const verseChapterNum = Math.floor((verse.id % 1000000) / 1000);
        const verseVerseNum = verse.id % 1000;
        
        // Check if this verse matches our search criteria
        if (verseBookId === bookId) {
          // If chapter specified, must match
          if (chapterNum && verseChapterNum !== chapterNum) continue;
          
          // If verse specified, must match
          if (verseNum && verseVerseNum !== verseNum) continue;
          
          results.push(verse);
        }
      }
    }
    
    return results;
  }

  /**
   * Get verses by reference (legacy method - kept for compatibility)
   */
  private getVersesByReference(
    bookName: string,
    verseLines: VerseLineData[],
    books: BookData[],
    chapters: ChapterData[],
    chapterNum?: number,
    verseNum?: number
  ): VerseLineData[] {
    const book = books.find(b =>
      b.name.toLowerCase().startsWith(bookName.toLowerCase())
    );

    if (!book) return [];

    let targetChapters = book.chapters;
    
    if (chapterNum) {
      targetChapters = targetChapters.filter(ch => ch.chapter_number === chapterNum);
    }

    const results: VerseLineData[] = [];

    for (const chapter of targetChapters) {
      for (const section of chapter.sections) {
        for (const paragraph of section.paragraphs) {
          for (const verseLine of paragraph.verse_lines) {
            if (!verseNum || verseLine.verse_number === verseNum) {
              results.push(verseLine);
            }
          }
        }
      }
    }

    return results;
  }
}

/**
 * Convenient search function
 */
export const searchBible = async (options: SearchOptions) => {
  const engine = BibleSearchEngine.getInstance();
  return engine.search(options);
};