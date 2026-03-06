package expo.modules.selectabletext

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Module for ChapterSelectableTextView
 *
 * Style Spec Architecture:
 * - All styling is defined in React Native and passed as a styleSpec object
 * - Native module only applies styles, doesn't define them
 * - This keeps styling logic in one place (React Native)
 */
class ChapterSelectableTextModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ChapterSelectableText")

    View(ChapterSelectableTextView::class) {
      Events("onAction", "onContentSizeChange")

      // Pre-formatted plain text (legacy fallback)
      Prop("text") { view: ChapterSelectableTextView, text: String? ->
        view.setText(text)
      }

      // Styled sections for rich rendering
      Prop("sections") { view: ChapterSelectableTextView, sections: List<Map<String, Any>>? ->
        view.setSections(sections)
      }

      // Style specification from React Native - contains ALL styling decisions
      Prop("styleSpec") { view: ChapterSelectableTextView, spec: Map<String, Any>? ->
        view.setStyleSpec(spec)
      }

      // Verse highlights - array of { verseId: Int, color: String }
      Prop("highlights") { view: ChapterSelectableTextView, highlights: List<Map<String, Any>>? ->
        view.setHighlights(highlights)
      }
    }
  }
}
