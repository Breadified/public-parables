/**
 * expo-selectable-text module
 *
 * React Native wrapper components have moved to @/components/Bible/selectableText
 * This file re-exports them for backward compatibility.
 *
 * Native modules (iOS/Android) remain in this folder.
 */

// Re-export everything from the new location
export {
  // Paragraph-level SelectableTextView
  SelectableTextView,
  type SelectableTextViewProps,
  type SelectableTextEvent,
  type SelectableTextAction,
  type TextRangeHighlight,
  type LineIndent,

  // Chapter-level view
  ChapterSelectableText,
  type ChapterSelectableTextProps,
  type ChapterSelectionEvent,
  type ChapterSelectableTextAction,
  type ChapterContentSizeEvent,
  type StyledSection,
  type VerseHighlight,

  // StyleSpec types and builder
  buildStyleSpec,
  getBibleFontSize,
  DEFAULT_STYLE_SPEC,
  type StyleSpec,
  type TextStyle,
  type FontWeight,
  type FontStyle,
  type TextAlign,
  type SectionType,
} from '../../../components/Bible/selectableText';
