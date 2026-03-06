import ExpoModulesCore

/**
 * Separate module for ChapterSelectableTextView
 *
 * This is a separate module because Expo Modules with React Native New Architecture
 * has issues registering multiple views in a single module.
 *
 * Style Spec Architecture:
 * - All styling is defined in React Native and passed as a styleSpec object
 * - Native module only applies styles, doesn't define them
 * - This keeps styling logic in one place (React Native)
 */
public class ChapterSelectableTextModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ChapterSelectableText")

    // Register the chapter-level selectable text view
    View(ChapterSelectableTextView.self) {
      Events("onAction", "onContentSizeChange")

      // Pre-formatted plain text with unicode superscript verse numbers (legacy fallback)
      Prop("text") { (view, text: String?) in
        view.setText(text)
      }

      // Styled sections for rich rendering
      Prop("sections") { (view, sections: [[String: Any]]?) in
        view.setSections(sections)
      }

      // Style specification from React Native - contains ALL styling decisions
      Prop("styleSpec") { (view, spec: [String: Any]?) in
        view.setStyleSpec(spec)
      }

      // Verse highlights - array of { verseId: Int, color: String }
      Prop("highlights") { (view, highlights: [[String: Any]]?) in
        view.setHighlights(highlights)
      }
    }
  }
}
