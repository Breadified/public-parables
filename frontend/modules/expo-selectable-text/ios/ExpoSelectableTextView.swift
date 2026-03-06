import ExpoModulesCore
import UIKit

/**
 * ExpoSelectableTextView - Paragraph-level native text selection
 *
 * Style Spec Architecture:
 * - Styling can be defined in React Native via styleSpec prop
 * - Native module applies styles from spec (uses "prose" section)
 * - Legacy individual props still work as fallback
 */
class ExpoSelectableTextView: ExpoView, UITextViewDelegate {
  private let textView = UITextView()
  private var verseId: Int?
  private let onAction = EventDispatcher()
  private let onContentSizeChange = EventDispatcher()
  private let impactGenerator = UIImpactFeedbackGenerator(style: .medium)
  private var lastKnownWidth: CGFloat = 0
  private var lastReportedHeight: CGFloat = 0

  // Style specification from React Native
  private var styleSpec: [String: Any]? = nil

  // Current text content
  private var currentText: String = ""

  // Character-range based highlights
  private var highlights: [[String: Any]] = []

  // Default/legacy style values
  private var legacyFontSize: CGFloat = 17.0
  private var legacyFontFamily: String? = nil
  private var legacyTextColor: UIColor = .label
  private var legacyVerseNumberColor: UIColor? = nil
  // Now stores absolute line height (in points), not multiplier - matching Android
  private var legacyLineHeight: CGFloat = 31.5  // Default: 18 * 1.75
  private var indent: CGFloat = 0  // First-line indent for poetry (single value, legacy)
  private var lineIndents: [[String: Any]] = []  // Per-line indents for flattened poetry

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    setupTextView()
  }

  private func setupTextView() {
    textView.isEditable = false
    textView.isSelectable = true
    textView.isScrollEnabled = false
    textView.backgroundColor = .clear
    textView.textContainerInset = .zero
    textView.textContainer.lineFragmentPadding = 0
    textView.delegate = self

    // Remove default link detection to prevent unwanted behaviors
    textView.dataDetectorTypes = []

    addSubview(textView)
  }

  override func layoutSubviews() {
    super.layoutSubviews()

    // Track width changes and invalidate if needed
    if bounds.width > 0 && bounds.width != lastKnownWidth {
      lastKnownWidth = bounds.width
      invalidateIntrinsicContentSize()
    }

    textView.frame = bounds

    // Report content size changes
    let size = intrinsicContentSize
    if size.height > 0 && size.height != lastReportedHeight {
      lastReportedHeight = size.height
      onContentSizeChange([
        "width": size.width,
        "height": size.height
      ])
    }
  }

  // MARK: - Intrinsic Content Size (Required for proper layout in React Native)

  override var intrinsicContentSize: CGSize {
    // Use lastKnownWidth if bounds not yet set (initial layout pass)
    let width: CGFloat
    if bounds.width > 0 {
      width = bounds.width
    } else if lastKnownWidth > 0 {
      width = lastKnownWidth
    } else {
      // True fallback: use superview width or screen width (no arbitrary subtraction)
      width = superview?.bounds.width ?? UIScreen.main.bounds.width
    }

    let size = textView.sizeThatFits(CGSize(width: width, height: CGFloat.greatestFiniteMagnitude))
    return CGSize(width: width, height: size.height)
  }

  // MARK: - Property Setters

  func setText(_ text: String) {
    currentText = text
    rebuildStyledText()
    invalidateIntrinsicContentSize()
    setNeedsLayout()
  }

  func setVerseId(_ id: Int?) {
    self.verseId = id
  }

  /// Set style specification from React Native
  func setStyleSpec(_ spec: [String: Any]?) {
    styleSpec = spec
    rebuildStyledText()
  }

  // Legacy setters (used as fallback when styleSpec not provided)
  func setFontSize(_ size: Double) {
    legacyFontSize = CGFloat(size)
    if styleSpec == nil {
      rebuildStyledText()
    }
  }

  func setFontFamily(_ family: String?) {
    legacyFontFamily = family
    if styleSpec == nil {
      rebuildStyledText()
    }
  }

  func setTextColor(_ color: String?) {
    if let color = color, let uiColor = UIColor(hex: color) {
      legacyTextColor = uiColor
      if styleSpec == nil {
        rebuildStyledText()
      }
    }
  }

  func setVerseNumberColor(_ color: String?) {
    if let color = color, let uiColor = UIColor(hex: color) {
      legacyVerseNumberColor = uiColor
    } else {
      legacyVerseNumberColor = nil
    }
    rebuildStyledText()
  }

  /// Set absolute line height in points (e.g., 31.5), not a multiplier
  /// This matches Android's behavior where lineHeight is absolute
  func setLineHeight(_ absoluteLineHeight: Double) {
    legacyLineHeight = CGFloat(absoluteLineHeight)
    if styleSpec == nil {
      rebuildStyledText()
    }
  }

  /// Set character-range based highlights
  /// Each highlight: { startIndex: Int, endIndex: Int, color: String (hex) }
  func setHighlights(_ newHighlights: [[String: Any]]?) {
    highlights = newHighlights ?? []
    rebuildStyledText()
  }

  /// Set first-line indent for poetry (legacy single value)
  /// Only the first line is indented; wrapped lines start at left margin
  func setIndent(_ value: Double) {
    indent = CGFloat(value)
    rebuildStyledText()
  }

  /// Set per-line indents for flattened poetry
  /// Each indent: { startIndex: Int, endIndex: Int, indent: Double }
  func setLineIndents(_ indents: [[String: Any]]?) {
    lineIndents = indents ?? []
    rebuildStyledText()
  }

  // MARK: - Style Parsing from StyleSpec

  /// Get prose style from styleSpec
  private func getProseStyle() -> [String: Any]? {
    return styleSpec?["prose"] as? [String: Any]
  }

  /// Get verse number color from styleSpec
  private func getVerseNumberColor() -> UIColor? {
    if let colorHex = styleSpec?["verseNumberColor"] as? String {
      return UIColor(hex: colorHex)
    }
    return legacyVerseNumberColor
  }

  /// Get font from style or legacy
  private func getFont() -> UIFont {
    if let style = getProseStyle() {
      let fontFamily = style["fontFamily"] as? String ?? "Georgia"

      // Handle various number types from JavaScript/Expo modules
      let fontSize: CGFloat
      if let fontSizeDouble = style["fontSize"] as? Double {
        fontSize = CGFloat(fontSizeDouble)
      } else if let fontSizeInt = style["fontSize"] as? Int {
        fontSize = CGFloat(fontSizeInt)
      } else if let fontSizeNumber = style["fontSize"] as? NSNumber {
        fontSize = CGFloat(fontSizeNumber.doubleValue)
      } else {
        fontSize = legacyFontSize
      }

      if fontFamily == "System" {
        return UIFont.systemFont(ofSize: fontSize)
      } else if fontFamily == "Georgia" {
        return UIFont(name: "Georgia", size: fontSize) ?? UIFont.systemFont(ofSize: fontSize)
      } else {
        return UIFont(name: fontFamily, size: fontSize) ?? UIFont.systemFont(ofSize: fontSize)
      }
    }

    // Legacy fallback - default to Georgia for Bible reading
    if let family = legacyFontFamily {
      return UIFont(name: family, size: legacyFontSize) ?? UIFont.systemFont(ofSize: legacyFontSize)
    }
    return UIFont(name: "Georgia", size: legacyFontSize) ?? UIFont.systemFont(ofSize: legacyFontSize)
  }

  /// Get text color from style or legacy
  private func getTextColor() -> UIColor {
    if let style = getProseStyle(), let colorHex = style["color"] as? String {
      return UIColor(hex: colorHex) ?? legacyTextColor
    }
    return legacyTextColor
  }

  /// Get line height from style or legacy (returns absolute value in points, not multiplier)
  private func getLineHeight() -> CGFloat {
    if let style = getProseStyle() {
      // Handle various number types from JavaScript/Expo modules
      if let lineHeightDouble = style["lineHeight"] as? Double {
        return CGFloat(lineHeightDouble)
      } else if let lineHeightInt = style["lineHeight"] as? Int {
        return CGFloat(lineHeightInt)
      } else if let lineHeightNumber = style["lineHeight"] as? NSNumber {
        return CGFloat(lineHeightNumber.doubleValue)
      }
    }
    return legacyLineHeight
  }

  // MARK: - Text Styling

  /// Rebuild styled text using styleSpec or legacy values
  private func rebuildStyledText() {
    guard !currentText.isEmpty else {
      textView.text = ""
      return
    }

    let font = getFont()
    let textColor = getTextColor()
    let lineHeight = getLineHeight()
    let verseNumColor = getVerseNumberColor()

    let paragraphStyle = NSMutableParagraphStyle()
    // lineHeight is an ABSOLUTE value (e.g., 31.5 points), not a multiplier
    // Calculate extra spacing needed to achieve the absolute line height
    // This matches Android's applyAbsoluteLineHeight() behavior
    let defaultLineHeight = font.lineHeight
    let extraSpacing = max(0, lineHeight - defaultLineHeight)
    paragraphStyle.lineSpacing = extraSpacing

    // Apply first-line indent for poetry (only first line indented, wrapped lines at left margin)
    if indent > 0 {
      paragraphStyle.firstLineHeadIndent = indent
      paragraphStyle.headIndent = 0
    }

    // Build base attributed string
    let mutableAttributed: NSMutableAttributedString
    if let verseNumColor = verseNumColor {
      // Build attributed string with verse number coloring
      mutableAttributed = NSMutableAttributedString(attributedString: buildTextWithVerseNumbers(
        text: currentText,
        font: font,
        textColor: textColor,
        verseNumColor: verseNumColor,
        paragraphStyle: paragraphStyle
      ))
    } else {
      // Simple attributed string without verse number coloring
      let attrs: [NSAttributedString.Key: Any] = [
        .font: font,
        .foregroundColor: textColor,
        .paragraphStyle: paragraphStyle
      ]
      mutableAttributed = NSMutableAttributedString(string: currentText, attributes: attrs)
    }

    // Apply highlights (background colors) for persisted verse highlights
    applyHighlights(to: mutableAttributed)

    // Apply per-line indents for flattened poetry (overrides single indent if provided)
    if !lineIndents.isEmpty {
      applyLineIndents(to: mutableAttributed, font: font, textColor: textColor, lineHeight: lineHeight)
    }

    textView.attributedText = mutableAttributed
  }

  /// Apply per-line paragraph styles for flattened poetry
  /// Each line gets its own NSMutableParagraphStyle with appropriate firstLineHeadIndent
  private func applyLineIndents(to attributed: NSMutableAttributedString, font: UIFont, textColor: UIColor, lineHeight: CGFloat) {
    for indentInfo in lineIndents {
      guard let startIndex = indentInfo["startIndex"] as? Int,
            let endIndex = indentInfo["endIndex"] as? Int,
            let indentValue = indentInfo["indent"] as? Double else {
        continue
      }

      // Validate range
      let length = attributed.length
      let clampedStart = max(0, min(startIndex, length))
      let clampedEnd = max(clampedStart, min(endIndex, length))
      let range = NSRange(location: clampedStart, length: clampedEnd - clampedStart)

      if range.length > 0 {
        // Create paragraph style for this line
        let paraStyle = NSMutableParagraphStyle()
        // lineHeight is an ABSOLUTE value, calculate extra spacing (same as rebuildStyledText)
        let defaultLineHeight = font.lineHeight
        let extraSpacing = max(0, lineHeight - defaultLineHeight)
        paraStyle.lineSpacing = extraSpacing
        paraStyle.firstLineHeadIndent = CGFloat(indentValue)
        paraStyle.headIndent = 0  // Wrapped lines start at left margin

        attributed.addAttribute(.paragraphStyle, value: paraStyle, range: range)
      }
    }
  }

  /// Apply background colors for highlight ranges
  private func applyHighlights(to attributed: NSMutableAttributedString) {
    for highlight in highlights {
      guard let startIndex = highlight["startIndex"] as? Int,
            let endIndex = highlight["endIndex"] as? Int,
            let colorHex = highlight["color"] as? String,
            let color = UIColor(hex: colorHex) else {
        continue
      }

      // Validate range
      let length = attributed.length
      let clampedStart = max(0, min(startIndex, length))
      let clampedEnd = max(clampedStart, min(endIndex, length))
      let range = NSRange(location: clampedStart, length: clampedEnd - clampedStart)

      if range.length > 0 {
        attributed.addAttribute(.backgroundColor, value: color, range: range)
      }
    }
  }

  /// Build text with colored verse numbers (superscript unicode)
  private func buildTextWithVerseNumbers(text: String, font: UIFont, textColor: UIColor, verseNumColor: UIColor, paragraphStyle: NSMutableParagraphStyle) -> NSAttributedString {
    let attributed = NSMutableAttributedString()

    let textAttrs: [NSAttributedString.Key: Any] = [
      .font: font,
      .foregroundColor: textColor,
      .paragraphStyle: paragraphStyle
    ]

    let verseNumAttrs: [NSAttributedString.Key: Any] = [
      .font: font,
      .foregroundColor: verseNumColor,
      .paragraphStyle: paragraphStyle
    ]

    var i = text.startIndex
    while i < text.endIndex {
      let char = text[i]
      if isSuperscriptChar(char) {
        // Collect superscript sequence
        var superscriptEnd = i
        while superscriptEnd < text.endIndex && isSuperscriptChar(text[superscriptEnd]) {
          superscriptEnd = text.index(after: superscriptEnd)
        }
        let superscriptStr = String(text[i..<superscriptEnd])
        attributed.append(NSAttributedString(string: superscriptStr, attributes: verseNumAttrs))
        i = superscriptEnd
      } else {
        // Collect regular text
        var textEnd = text.index(after: i)
        while textEnd < text.endIndex && !isSuperscriptChar(text[textEnd]) {
          textEnd = text.index(after: textEnd)
        }
        let textStr = String(text[i..<textEnd])
        attributed.append(NSAttributedString(string: textStr, attributes: textAttrs))
        i = textEnd
      }
    }

    return attributed
  }

  /// Check if character is a unicode superscript digit
  private func isSuperscriptChar(_ char: Character) -> Bool {
    let superscripts: Set<Character> = [
      "\u{2070}", // 0
      "\u{00B9}", // 1
      "\u{00B2}", // 2
      "\u{00B3}", // 3
      "\u{2074}", // 4
      "\u{2075}", // 5
      "\u{2076}", // 6
      "\u{2077}", // 7
      "\u{2078}", // 8
      "\u{2079}"  // 9
    ]
    return superscripts.contains(char)
  }

  // MARK: - UITextViewDelegate with Custom Menu

  // iOS 16+ custom edit menu
  @available(iOS 16.0, *)
  func textView(_ textView: UITextView, editMenuForTextIn range: NSRange, suggestedActions: [UIMenuElement]) -> UIMenu? {
    let selectedText = (textView.text as NSString).substring(with: range)

    let copyAction = UIAction(title: "Copy", image: UIImage(systemName: "doc.on.doc")) { [weak self] _ in
      self?.sendAction("copy", selectedText: selectedText, range: range)
    }

    let shareAction = UIAction(title: "Share", image: UIImage(systemName: "square.and.arrow.up")) { [weak self] _ in
      self?.sendAction("share", selectedText: selectedText, range: range)
    }

    let noteAction = UIAction(title: "Note", image: UIImage(systemName: "square.and.pencil")) { [weak self] _ in
      self?.sendAction("note", selectedText: selectedText, range: range)
    }

    let highlightAction = UIAction(title: "Highlight", image: UIImage(systemName: "highlighter")) { [weak self] _ in
      self?.sendAction("highlight", selectedText: selectedText, range: range)
    }

    let bookmarkAction = UIAction(title: "Bookmark", image: UIImage(systemName: "bookmark")) { [weak self] _ in
      self?.sendAction("bookmark", selectedText: selectedText, range: range)
    }

    // Return our custom menu, replacing the default one
    return UIMenu(children: [copyAction, shareAction, noteAction, highlightAction, bookmarkAction])
  }

  // For iOS 15 and below, use the old canPerformAction approach
  override func canPerformAction(_ action: Selector, withSender sender: Any?) -> Bool {
    if #available(iOS 16.0, *) {
      // iOS 16+ uses the new editMenuForTextIn delegate method
      return super.canPerformAction(action, withSender: sender)
    } else {
      // For older iOS, we need to handle actions differently
      // This is a simplified version - full iOS 15 support would need more work
      return false
    }
  }

  // MARK: - Event Sending

  private func sendAction(_ action: String, selectedText: String, range: NSRange) {
    // Haptic feedback when action is selected
    impactGenerator.impactOccurred()

    onAction([
      "action": action,
      "selectedText": selectedText,
      "verseId": verseId as Any,
      "selectionStart": range.location,
      "selectionEnd": range.location + range.length
    ])

    // Clear selection after action
    textView.selectedTextRange = nil
  }
}
