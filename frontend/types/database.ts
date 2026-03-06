// Generated TypeScript types for Supabase Database
// Compatible with Legend State observables

export interface Database {
  public: {
    Tables: {
      books: {
        Row: {
          id: number;
          name: string;
          testament: 'Old' | 'New';
          book_order: number;
          abbreviation: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: number;
          name: string;
          testament: 'Old' | 'New';
          book_order: number;
          abbreviation?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          name?: string;
          testament?: 'Old' | 'New';
          book_order?: number;
          abbreviation?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      chapters: {
        Row: {
          id: number;
          chapter_number: number;
          book_id: number;
          version: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: number;
          chapter_number: number;
          book_id: number;
          version?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          chapter_number?: number;
          book_id?: number;
          version?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      sections: {
        Row: {
          id: number;
          chapter_id: number;
          title: string;
          section_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: number;
          chapter_id: number;
          title: string;
          section_order: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          chapter_id?: number;
          title?: string;
          section_order?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      paragraphs: {
        Row: {
          id: number;
          section_id: number;
          paragraph_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: number;
          section_id: number;
          paragraph_order: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          section_id?: number;
          paragraph_order?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      verse_lines: {
        Row: {
          id: string;
          text: string;
          is_isolated: boolean;
          indent_level: number;
          paragraph_id: number;
          verse_id: number;
          verse_number: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          text: string;
          is_isolated?: boolean;
          indent_level?: number;
          paragraph_id: number;
          verse_id: number;
          verse_number: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          text?: string;
          is_isolated?: boolean;
          indent_level?: number;
          paragraph_id?: number;
          verse_id?: number;
          verse_number?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      cross_references: {
        Row: {
          id: string;
          source_verse_id: number;
          target_verse_id: number;
          reference_type: string;
          strength: number;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          source_verse_id: number;
          target_verse_id: number;
          reference_type?: string;
          strength?: number;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          source_verse_id?: number;
          target_verse_id?: number;
          reference_type?: string;
          strength?: number;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      user_profiles: {
        Row: {
          id: string;
          display_name: string | null;
          avatar_url: string | null;
          preferred_version: string;
          reading_plan_id: string | null;
          settings: Record<string, any>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          avatar_url?: string | null;
          preferred_version?: string;
          reading_plan_id?: string | null;
          settings?: Record<string, any>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          preferred_version?: string;
          reading_plan_id?: string | null;
          settings?: Record<string, any>;
          created_at?: string;
          updated_at?: string;
        };
      };
      bookmarks: {
        Row: {
          id: string;
          user_id: string;
          verse_line_id: string;
          title: string | null;
          color: string;
          tags: string[];
          status: 'active' | 'inactive';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          verse_line_id: string;
          title?: string | null;
          color?: string;
          tags?: string[];
          status?: 'active' | 'inactive';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          verse_line_id?: string;
          title?: string | null;
          color?: string;
          tags?: string[];
          status?: 'active' | 'inactive';
          created_at?: string;
          updated_at?: string;
        };
      };
      notes: {
        Row: {
          id: string;
          user_id: string;
          book_id: number | null;
          chapter_id: number | null;
          verse_id: number | null;
          verse_line_id: string | null;
          verse_start_id: number | null;  // Start of verse range (for multi-verse notes)
          verse_end_id: number | null;    // End of verse range (for multi-verse notes)
          // title: string | null; // DEPRECATED - migrated to content
          content: string;
          tags: string[];
          is_private: boolean;
          status: 'active' | 'inactive';
          created_at: string;
          updated_at: string;
          edit_history: string[];
          formatting_type: 'prose' | 'poetry' | 'custom';
        };
        Insert: {
          id?: string;
          user_id: string;
          book_id?: number | null;
          chapter_id?: number | null;
          verse_id?: number | null;
          verse_line_id?: string | null;
          verse_start_id?: number | null;
          verse_end_id?: number | null;
          // title?: string | null; // DEPRECATED - migrated to content
          content: string;
          tags?: string[];
          is_private?: boolean;
          status?: 'active' | 'inactive';
          created_at?: string;
          updated_at?: string;
          edit_history?: string[];
          formatting_type?: 'prose' | 'poetry' | 'custom';
        };
        Update: {
          id?: string;
          user_id?: string;
          book_id?: number | null;
          chapter_id?: number | null;
          verse_id?: number | null;
          verse_line_id?: string | null;
          verse_start_id?: number | null;
          verse_end_id?: number | null;
          // title?: string | null; // DEPRECATED - migrated to content
          content?: string;
          tags?: string[];
          is_private?: boolean;
          status?: 'active' | 'inactive';
          created_at?: string;
          updated_at?: string;
          edit_history?: string[];
          formatting_type?: 'prose' | 'poetry' | 'custom';
        };
      };
      reading_sessions: {
        Row: {
          id: string;
          user_id: string;
          verse_line_id: string;
          duration_seconds: number;
          started_at: string;
          ended_at: string | null;
          session_type: 'reading' | 'study' | 'search';
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          verse_line_id: string;
          duration_seconds?: number;
          started_at?: string;
          ended_at?: string | null;
          session_type?: 'reading' | 'study' | 'search';
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          verse_line_id?: string;
          duration_seconds?: number;
          started_at?: string;
          ended_at?: string | null;
          session_type?: 'reading' | 'study' | 'search';
          created_at?: string;
        };
      };
      search_history: {
        Row: {
          id: string;
          user_id: string | null;
          search_query: string;
          search_type: 'text' | 'reference' | 'topic' | 'semantic';
          results_count: number;
          selected_verse_line_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          search_query: string;
          search_type?: 'text' | 'reference' | 'topic' | 'semantic';
          results_count?: number;
          selected_verse_line_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          search_query?: string;
          search_type?: 'text' | 'reference' | 'topic' | 'semantic';
          results_count?: number;
          selected_verse_line_id?: string | null;
          created_at?: string;
        };
      };
      ai_context: {
        Row: {
          id: string;
          verse_line_id: string;
          context_type: 'commentary' | 'historical' | 'theological' | 'cross_reference' | 'application';
          content: string;
          source_model: string;
          confidence_score: number | null;
          language: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          verse_line_id: string;
          context_type: 'commentary' | 'historical' | 'theological' | 'cross_reference' | 'application';
          content: string;
          source_model?: string;
          confidence_score?: number | null;
          language?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          verse_line_id?: string;
          context_type?: 'commentary' | 'historical' | 'theological' | 'cross_reference' | 'application';
          content?: string;
          source_model?: string;
          confidence_score?: number | null;
          language?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      comments: {
        Row: {
          id: string;
          user_id: string;
          parent_comment_id: string | null;
          content: string;
          like_count: number;
          reply_count: number;
          status: 'active' | 'inactive';
          is_anonymous: boolean;
          is_humans_only: boolean;
          is_ai_generated: boolean;
          ai_review_status: 'pending' | 'read' | 'responded' | null;
          created_at: string;
          updated_at: string;
          // Polymorphic context fields
          context_type: 'devotion' | 'plan_session';
          question_id: string | null;       // For devotion context
          plan_session_id: string | null;   // For plan_session context
          day_number: number | null;        // For plan_session context
        };
        Insert: {
          id?: string;
          user_id: string;
          parent_comment_id?: string | null;
          content: string;
          like_count?: number;
          reply_count?: number;
          status?: 'active' | 'inactive';
          is_anonymous?: boolean;
          is_humans_only?: boolean;
          is_ai_generated?: boolean;
          ai_review_status?: 'pending' | 'read' | 'responded' | null;
          created_at?: string;
          updated_at?: string;
          // Polymorphic context fields
          context_type: 'devotion' | 'plan_session';
          question_id?: string | null;
          plan_session_id?: string | null;
          day_number?: number | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          parent_comment_id?: string | null;
          content?: string;
          like_count?: number;
          reply_count?: number;
          status?: 'active' | 'inactive';
          is_anonymous?: boolean;
          is_humans_only?: boolean;
          is_ai_generated?: boolean;
          ai_review_status?: 'pending' | 'read' | 'responded' | null;
          created_at?: string;
          updated_at?: string;
          // Polymorphic context fields
          context_type?: 'devotion' | 'plan_session';
          question_id?: string | null;
          plan_session_id?: string | null;
          day_number?: number | null;
        };
      };
      comment_likes: {
        Row: {
          id: string;
          comment_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          comment_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          comment_id?: string;
          user_id?: string;
          created_at?: string;
        };
      };
      // ========================================================================
      // BIBLE PLANS FEATURE
      // ========================================================================
      plan_sessions: {
        Row: {
          id: string;
          plan_id: string;              // References bundled SQLite plan ID
          user_id: string;
          current_day: number;
          started_at: string;
          completed_at: string | null;
          status: 'active' | 'paused' | 'completed' | 'inactive';
          // Sharing fields (consolidated from shared_sessions)
          is_shared: boolean;
          shared_name: string | null;   // Name for the shared session
          invite_code: string | null;   // 8-char alphanumeric code for sharing
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          plan_id: string;
          user_id: string;
          current_day?: number;
          started_at?: string;
          completed_at?: string | null;
          status?: 'active' | 'paused' | 'completed' | 'inactive';
          is_shared?: boolean;
          shared_name?: string | null;
          invite_code?: string | null;  // Auto-generated if sharing
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          plan_id?: string;
          user_id?: string;
          current_day?: number;
          started_at?: string;
          completed_at?: string | null;
          status?: 'active' | 'paused' | 'completed' | 'inactive';
          is_shared?: boolean;
          shared_name?: string | null;
          invite_code?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      session_participants: {
        Row: {
          id: string;
          plan_session_id: string;
          user_id: string;
          role: 'owner' | 'admin' | 'member';
          current_day: number;          // Individual progress (real-time shared)
          joined_at: string;
          last_active_at: string;
          status: 'active' | 'inactive';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          plan_session_id: string;
          user_id: string;
          role?: 'owner' | 'admin' | 'member';
          current_day?: number;
          joined_at?: string;
          last_active_at?: string;
          status?: 'active' | 'inactive';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          plan_session_id?: string;
          user_id?: string;
          role?: 'owner' | 'admin' | 'member';
          current_day?: number;
          joined_at?: string;
          last_active_at?: string;
          status?: 'active' | 'inactive';
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

// Convenience types for use in the application
export type Book = Database['public']['Tables']['books']['Row'];
export type Chapter = Database['public']['Tables']['chapters']['Row'];
export type Section = Database['public']['Tables']['sections']['Row'];
export type Paragraph = Database['public']['Tables']['paragraphs']['Row'];
export type VerseLine = Database['public']['Tables']['verse_lines']['Row'];
export type CrossReference = Database['public']['Tables']['cross_references']['Row'];
export type UserProfile = Database['public']['Tables']['user_profiles']['Row'];
export type Bookmark = Database['public']['Tables']['bookmarks']['Row'];
export type Note = Database['public']['Tables']['notes']['Row'];
export type ReadingSession = Database['public']['Tables']['reading_sessions']['Row'];
export type SearchHistory = Database['public']['Tables']['search_history']['Row'];
export type AIContext = Database['public']['Tables']['ai_context']['Row'];
export type Comment = Database['public']['Tables']['comments']['Row'];
export type CommentLike = Database['public']['Tables']['comment_likes']['Row'];

// Insert types for creating new records
export type BookInsert = Database['public']['Tables']['books']['Insert'];
export type ChapterInsert = Database['public']['Tables']['chapters']['Insert'];
export type SectionInsert = Database['public']['Tables']['sections']['Insert'];
export type ParagraphInsert = Database['public']['Tables']['paragraphs']['Insert'];
export type VerseLineInsert = Database['public']['Tables']['verse_lines']['Insert'];
export type CrossReferenceInsert = Database['public']['Tables']['cross_references']['Insert'];
export type UserProfileInsert = Database['public']['Tables']['user_profiles']['Insert'];
export type BookmarkInsert = Database['public']['Tables']['bookmarks']['Insert'];
export type NoteInsert = Database['public']['Tables']['notes']['Insert'];
export type ReadingSessionInsert = Database['public']['Tables']['reading_sessions']['Insert'];
export type SearchHistoryInsert = Database['public']['Tables']['search_history']['Insert'];
export type AIContextInsert = Database['public']['Tables']['ai_context']['Insert'];
export type CommentInsert = Database['public']['Tables']['comments']['Insert'];
export type CommentLikeInsert = Database['public']['Tables']['comment_likes']['Insert'];

// Update types for modifying existing records
export type BookUpdate = Database['public']['Tables']['books']['Update'];
export type ChapterUpdate = Database['public']['Tables']['chapters']['Update'];
export type SectionUpdate = Database['public']['Tables']['sections']['Update'];
export type ParagraphUpdate = Database['public']['Tables']['paragraphs']['Update'];
export type VerseLineUpdate = Database['public']['Tables']['verse_lines']['Update'];
export type CrossReferenceUpdate = Database['public']['Tables']['cross_references']['Update'];
export type UserProfileUpdate = Database['public']['Tables']['user_profiles']['Update'];
export type BookmarkUpdate = Database['public']['Tables']['bookmarks']['Update'];
export type NoteUpdate = Database['public']['Tables']['notes']['Update'];
export type ReadingSessionUpdate = Database['public']['Tables']['reading_sessions']['Update'];
export type SearchHistoryUpdate = Database['public']['Tables']['search_history']['Update'];
export type AIContextUpdate = Database['public']['Tables']['ai_context']['Update'];
export type CommentUpdate = Database['public']['Tables']['comments']['Update'];
export type CommentLikeUpdate = Database['public']['Tables']['comment_likes']['Update'];

// Bible Plans Feature types
export type PlanSession = Database['public']['Tables']['plan_sessions']['Row'];
export type SessionParticipant = Database['public']['Tables']['session_participants']['Row'];

export type PlanSessionInsert = Database['public']['Tables']['plan_sessions']['Insert'];
export type SessionParticipantInsert = Database['public']['Tables']['session_participants']['Insert'];

export type PlanSessionUpdate = Database['public']['Tables']['plan_sessions']['Update'];
export type SessionParticipantUpdate = Database['public']['Tables']['session_participants']['Update'];

// Backwards compatibility aliases (deprecated)
export type SharedSession = PlanSession;  // Use PlanSession with is_shared=true
export type SessionComment = Comment;      // Use Comment with context_type='plan_session'
export type SessionCommentLike = CommentLike;
export type SessionCommentInsert = CommentInsert;
export type SessionCommentLikeInsert = CommentLikeInsert;
export type SessionCommentUpdate = CommentUpdate;
export type SessionCommentLikeUpdate = CommentLikeUpdate;

// SQLite Bible Plan types (bundled with app)
export interface BiblePlan {
  id: string;
  name: string;
  description: string | null;
  duration_days: number;
  group_id: string | null;
  group_name: string | null;
  sort_order: number;
  source: string | null;
  created_at: string | null; // Optional in SQLite
}

export interface BiblePlanDay {
  id: number;
  plan_id: string;
  day_number: number;
}

export interface BiblePlanReading {
  id: number;
  plan_day_id: number;
  reference: string;
  verse_id_start: number;
  verse_id_end: number;
  sort_order: number;
}

// Simplified reading data for display (doesn't need db IDs)
export interface BiblePlanReadingData {
  reference: string;
  verse_id_start: number;
  verse_id_end: number;
  sort_order: number;
}

// ============================================================================
// New unified content structure for Bible plans
// ============================================================================

/** Content types for plan day items */
export type PlanContentType = 'intro' | 'reading' | 'recap';

/** Unified content item - can be intro text, reading, or recap text */
export interface PlanContentItem {
  order: number;
  type: PlanContentType;
  // For readings only:
  reference?: string;
  verse_id_start?: number;
  verse_id_end?: number;
  // For intro/recap only:
  text?: string;
}

// Simplified day structure for discovery/display
export interface BiblePlanDayData {
  day_number: number;
  content: PlanContentItem[];  // Unified content array (replaces readings + recap)

  // Legacy fields (deprecated - for backwards compatibility during migration)
  readings?: BiblePlanReadingData[];
  recap?: string;
  recap_text?: string;
}

// Enriched types for UI - uses simplified structures
export interface BiblePlanWithDays extends BiblePlan {
  days: BiblePlanDayData[];
}

// Full day with readings (includes db IDs)
export interface BiblePlanDayWithReadings extends BiblePlanDay {
  readings: BiblePlanReading[];
}

// ============================================================================
// Gamification Types
// ============================================================================

// Reward type constants
export const REWARD_TYPES = {
  LOGIN: 'login',
  LOGIN_STREAK_7: 'login_streak_7',
  LOGIN_STREAK_30: 'login_streak_30',
  LOGIN_STREAK_365: 'login_streak_365',
  DAY_COMPLETE: 'day_complete',
  DAY_COMMENT: 'day_comment',
  CHAPTER_READ: 'chapter_read',
  DAILY_NOTE: 'daily_note',
  DAILY_DEVOTION: 'daily_devotion',
  // Reading streaks
  READ_STREAK_7: 'read_streak_7',
  READ_STREAK_30: 'read_streak_30',
  READ_STREAK_365: 'read_streak_365',
  // Notes streaks
  NOTE_STREAK_7: 'note_streak_7',
  NOTE_STREAK_30: 'note_streak_30',
  NOTE_STREAK_365: 'note_streak_365',
  // Plan streaks
  STREAK_3: 'streak_3',
  STREAK_7: 'streak_7',
  STREAK_14: 'streak_14',
  STREAK_30: 'streak_30',
  STREAK_60: 'streak_60',
  STREAK_90: 'streak_90',
  STREAK_365: 'streak_365',
  PLAN_COMPLETE: 'plan_complete',
  // Devotion streaks
  DEVOTION_STREAK_7: 'devotion_streak_7',
  DEVOTION_STREAK_30: 'devotion_streak_30',
  DEVOTION_STREAK_365: 'devotion_streak_365',
  // Daily completion bonus
  DAILY_ALL_COMPLETE: 'daily_all_complete',
} as const;

export type RewardType = typeof REWARD_TYPES[keyof typeof REWARD_TYPES];

// Reward points configuration (updated XP values for meaningful progression)
export const REWARD_POINTS: Record<RewardType, number> = {
  // Daily activities
  [REWARD_TYPES.LOGIN]: 1000,
  [REWARD_TYPES.DAY_COMPLETE]: 10000,
  [REWARD_TYPES.CHAPTER_READ]: 2000,
  [REWARD_TYPES.DAILY_NOTE]: 3000,
  [REWARD_TYPES.DAILY_DEVOTION]: 5000,
  [REWARD_TYPES.DAY_COMMENT]: 500,
  // Login streaks (x5 weekly, x20 monthly, x500 yearly)
  [REWARD_TYPES.LOGIN_STREAK_7]: 5000,
  [REWARD_TYPES.LOGIN_STREAK_30]: 20000,
  [REWARD_TYPES.LOGIN_STREAK_365]: 500000,
  // Reading streaks (x5 weekly, x20 monthly, x500 yearly)
  [REWARD_TYPES.READ_STREAK_7]: 10000,
  [REWARD_TYPES.READ_STREAK_30]: 40000,
  [REWARD_TYPES.READ_STREAK_365]: 1000000,
  // Notes streaks (x5 weekly, x20 monthly, x500 yearly)
  [REWARD_TYPES.NOTE_STREAK_7]: 15000,
  [REWARD_TYPES.NOTE_STREAK_30]: 60000,
  [REWARD_TYPES.NOTE_STREAK_365]: 1500000,
  // Plan streaks (x5 weekly, x20 monthly, x500 yearly)
  [REWARD_TYPES.STREAK_3]: 1500,
  [REWARD_TYPES.STREAK_7]: 50000,
  [REWARD_TYPES.STREAK_14]: 100000,
  [REWARD_TYPES.STREAK_30]: 200000,
  [REWARD_TYPES.STREAK_60]: 400000,
  [REWARD_TYPES.STREAK_90]: 600000,
  [REWARD_TYPES.STREAK_365]: 5000000,
  [REWARD_TYPES.PLAN_COMPLETE]: 500,
  // Devotion streaks (x5 weekly, x20 monthly, x500 yearly)
  [REWARD_TYPES.DEVOTION_STREAK_7]: 25000,
  [REWARD_TYPES.DEVOTION_STREAK_30]: 100000,
  [REWARD_TYPES.DEVOTION_STREAK_365]: 2500000,
  // Daily completion bonus (all 5 activities)
  [REWARD_TYPES.DAILY_ALL_COMPLETE]: 20000,
};

// Diminishing returns multipliers for daily notes
export const DAILY_NOTE_MULTIPLIERS = [1.0, 0.5, 0.25, 0.1, 0.05];

/** Multipliers for multiple plan day completions on same day */
export const DAILY_PLAN_COMPLETION_MULTIPLIERS = [1.0, 0.5, 0.25, 0.1];

/** Get multiplier for nth plan day completion today (0-indexed) */
export function getDailyPlanCompletionMultiplier(completionsToday: number): number {
  const index = Math.min(completionsToday, DAILY_PLAN_COMPLETION_MULTIPLIERS.length - 1);
  return DAILY_PLAN_COMPLETION_MULTIPLIERS[index];
}

/** Multipliers for plan completion bonuses (when completing multiple plans) */
export const PLAN_COMPLETION_MULTIPLIERS = [1.0, 0.5, 0.25, 0.1];

/** Get multiplier for nth plan completion (0-indexed) */
export function getPlanCompletionMultiplier(plansCompletedRecently: number): number {
  const index = Math.min(plansCompletedRecently, PLAN_COMPLETION_MULTIPLIERS.length - 1);
  return PLAN_COMPLETION_MULTIPLIERS[index];
}

// User global stats (from user_global_stats table)
export interface UserGlobalStats {
  id: string;
  user_id: string;
  total_xp: number;
  level: number;
  total_days_completed: number;
  total_comments: number;
  plans_completed: number;
  longest_streak: number;
  created_at: string;
  updated_at: string;
}

// User reward record (from user_rewards table)
export interface UserReward {
  id: string;
  plan_session_id: string | null; // Nullable for global rewards
  user_id: string;
  reward_type: RewardType;
  day_number: number | null;
  reference_id: string | null;
  points: number;
  is_on_time: boolean | null; // True for on-time completions, false for catch-up
  created_at: string;
}

// Day rewards summary for UI display
export interface DayRewardsSummary {
  dayNumber: number;
  isComplete: boolean;
  hasComment: boolean;
}

// Session user stats (from session_user_stats table)
export interface SessionUserStats {
  id: string;
  plan_session_id: string;
  user_id: string;
  total_points: number;
  days_completed: number;
  comments_count: number;
  current_streak: number;
  longest_streak: number;
  level: number;
  updated_at: string;
}

// User reward insert type
export interface UserRewardInsert {
  id?: string;
  plan_session_id?: string | null;
  user_id: string;
  reward_type: RewardType;
  day_number?: number | null;
  reference_id?: string | null;
  points?: number;
  is_on_time?: boolean | null;
  created_at?: string;
}

// Backwards compatibility aliases
export type SessionUserReward = UserReward;
export type SessionUserRewardInsert = UserRewardInsert;