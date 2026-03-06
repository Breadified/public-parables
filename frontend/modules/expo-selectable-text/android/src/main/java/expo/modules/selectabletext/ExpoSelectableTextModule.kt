package expo.modules.selectabletext

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * ExpoSelectableTextModule - Paragraph-level native text selection
 *
 * Style Spec Architecture:
 * - All styling can be defined in React Native via styleSpec prop
 * - Native module applies styles from spec (uses "prose" section)
 * - Legacy individual props still work as fallback
 */
class ExpoSelectableTextModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExpoSelectableText")

    // Paragraph-level selectable text view
    View(ExpoSelectableTextView::class) {
      Events("onAction", "onContentSizeChange")

      Prop("text") { view: ExpoSelectableTextView, text: String? ->
        view.setText(text ?: "")
      }

      Prop("verseId") { view: ExpoSelectableTextView, verseId: Int? ->
        view.setVerseId(verseId)
      }

      // Style specification from React Native (preferred)
      Prop("styleSpec") { view: ExpoSelectableTextView, spec: Map<String, Any>? ->
        view.setStyleSpec(spec)
      }

      // Legacy props (fallback when styleSpec not provided)
      Prop("fontSize") { view: ExpoSelectableTextView, fontSize: Double? ->
        view.setFontSize(fontSize?.toFloat() ?: 17f)
      }

      Prop("fontFamily") { view: ExpoSelectableTextView, fontFamily: String? ->
        view.setFontFamily(fontFamily)
      }

      Prop("textColor") { view: ExpoSelectableTextView, textColor: String? ->
        view.setTextColor(textColor)
      }

      Prop("verseNumberColor") { view: ExpoSelectableTextView, color: String? ->
        view.setVerseNumberColor(color)
      }

      Prop("lineHeight") { view: ExpoSelectableTextView, lineHeight: Double? ->
        // lineHeight is now absolute value (e.g., 32.4) not multiplier
        // Default: 18 * 1.75 = 31.5 (typical Bible text)
        view.setLineHeight(lineHeight?.toFloat() ?: 31.5f)
      }

      // Character-range based highlights for persisted verse highlights
      Prop("highlights") { view: ExpoSelectableTextView, highlights: List<Map<String, Any>>? ->
        view.setHighlights(highlights)
      }

      // First-line indent for poetry (only first line indented, wrapped lines at left margin)
      Prop("indent") { view: ExpoSelectableTextView, indent: Double? ->
        view.setIndent(indent?.toFloat() ?: 0f)
      }

      // Per-line indents for flattened poetry
      Prop("lineIndents") { view: ExpoSelectableTextView, lineIndents: List<Map<String, Any>>? ->
        view.setLineIndents(lineIndents)
      }
    }
  }
}
