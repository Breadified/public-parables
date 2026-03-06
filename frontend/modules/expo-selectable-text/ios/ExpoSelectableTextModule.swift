import ExpoModulesCore

/**
 * ExpoSelectableTextModule - Paragraph-level native text selection
 *
 * Style Spec Architecture:
 * - All styling can be defined in React Native via styleSpec prop
 * - Native module applies styles from spec (uses "prose" section)
 * - Legacy individual props still work as fallback
 */
public class ExpoSelectableTextModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoSelectableText")

    // Paragraph-level selectable text view
    View(ExpoSelectableTextView.self) {
      Events("onAction", "onContentSizeChange")

      Prop("text") { (view, text: String?) in
        view.setText(text ?? "")
      }

      Prop("verseId") { (view, verseId: Int?) in
        view.setVerseId(verseId)
      }

      // Style specification from React Native (preferred)
      Prop("styleSpec") { (view, spec: [String: Any]?) in
        view.setStyleSpec(spec)
      }

      // Legacy props (fallback when styleSpec not provided)
      Prop("fontSize") { (view, fontSize: Double?) in
        view.setFontSize(fontSize ?? 17.0)
      }

      Prop("fontFamily") { (view, fontFamily: String?) in
        view.setFontFamily(fontFamily)
      }

      Prop("textColor") { (view, textColor: String?) in
        view.setTextColor(textColor)
      }

      Prop("verseNumberColor") { (view, color: String?) in
        view.setVerseNumberColor(color)
      }

      Prop("lineHeight") { (view, lineHeight: Double?) in
        // lineHeight is now absolute value (e.g., 31.5) not multiplier
        // Default: 18 * 1.75 = 31.5 (typical Bible text)
        view.setLineHeight(lineHeight ?? 31.5)
      }

      // Character-range based highlights for persisted verse highlights
      Prop("highlights") { (view, highlights: [[String: Any]]?) in
        view.setHighlights(highlights)
      }

      // First-line indent for poetry (only first line indented, wrapped lines at left margin)
      Prop("indent") { (view, indent: Double?) in
        view.setIndent(indent ?? 0)
      }

      // Per-line indents for flattened poetry
      Prop("lineIndents") { (view, lineIndents: [[String: Any]]?) in
        view.setLineIndents(lineIndents)
      }
    }
  }
}
