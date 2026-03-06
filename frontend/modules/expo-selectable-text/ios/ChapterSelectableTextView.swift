import ExpoModulesCore
import UIKit

// MARK: - Custom UITextView that suppresses default menu items

/// Custom UITextView subclass that ONLY suppresses default iOS menu items.
/// It does NOT handle custom actions - those are handled by the parent ChapterSelectableTextView.
/// This separation is critical: the parent has the @objc methods, so it must be the one
/// that claims it canPerformAction for custom selectors.
class CustomMenuTextView: UITextView {

  /// Standard iOS selectors that we want to suppress (hide from menu)
  private let suppressedActions: Set<Selector> = [
    #selector(copy(_:)),
    #selector(cut(_:)),
    #selector(paste(_:)),
    #selector(select(_:)),
    #selector(selectAll(_:)),
    #selector(delete(_:)),
    Selector(("_lookup:")),
    Selector(("_define:")),
    Selector(("_share:")),
    Selector(("_translate:")),
    Selector(("_addShortcut:")),
    Selector(("_promptForReplace:")),
    Selector(("_showTextStyleOptions:")),
    Selector(("makeTextWritingDirectionLeftToRight:")),
    Selector(("makeTextWritingDirectionRightToLeft:"))
  ]

  override func canPerformAction(_ action: Selector, withSender sender: Any?) -> Bool {
    // Suppress standard iOS actions - return false so they don't appear in menu
    if suppressedActions.contains(action) {
      return false
    }
    // For everything else (including custom actions), defer to responder chain
    // The parent ChapterSelectableTextView will handle custom actions
    return super.canPerformAction(action, withSender: sender)
  }
}

/**
 * ChapterSelectableTextView - iOS Implementation
 *
 * Renders an entire chapter as one selectable UITextView with styled text.
 * Supports cross-paragraph selection and custom context menu.
 *
 * Style Spec Architecture:
 * - All styling is defined in React Native and passed via styleSpec
 * - This view only applies styles, doesn't define them
 * - No hardcoded style values - everything comes from styleSpec
 */
class ChapterSelectableTextView: ExpoView, UITextViewDelegate {
  private let textView = CustomMenuTextView()

  // Style specification from React Native
  private var styleSpec: [String: Any]? = nil

  // Content - plain text mode (legacy)
  private var plainText: String = ""

  // Content - sections mode (new)
  private var sections: [[String: Any]]? = nil

  // Verse highlights - map from verseId to color hex string
  private var highlights: [Int: String] = [:]

  // Default values (used when styleSpec not provided)
  private let defaultTextColor: UIColor = .label
  private let defaultVerseNumberColor: UIColor = .systemIndigo
  private let defaultFontSize: CGFloat = 18.0
  private let defaultLineHeight: CGFloat = 1.75

  // Event dispatcher
  let onAction = EventDispatcher()
  let onContentSizeChange = EventDispatcher()

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    setupTextView()
  }

  private func setupTextView() {
    textView.isEditable = false
    textView.isSelectable = true
    textView.isScrollEnabled = false // Let parent handle scrolling
    textView.textContainerInset = UIEdgeInsets(top: 0, left: 0, bottom: 0, right: 0)
    textView.textContainer.lineFragmentPadding = 0
    textView.backgroundColor = .clear
    textView.delegate = self

    addSubview(textView)
    textView.translatesAutoresizingMaskIntoConstraints = false
    NSLayoutConstraint.activate([
      textView.topAnchor.constraint(equalTo: topAnchor),
      textView.leadingAnchor.constraint(equalTo: leadingAnchor),
      textView.trailingAnchor.constraint(equalTo: trailingAnchor),
      textView.bottomAnchor.constraint(equalTo: bottomAnchor),
    ])

    setupCustomMenu()
  }

  private func setupCustomMenu() {
    if #available(iOS 16.0, *) {
      textView.isFindInteractionEnabled = false
    }

    // Custom menu items (for iOS 15 and below - iOS 16+ uses editMenuForTextIn delegate)
    // Note: CustomMenuTextView suppresses default iOS actions, and ChapterSelectableTextView
    // handles canPerformAction for these custom selectors
    let copyItem = UIMenuItem(title: "Copy", action: #selector(customCopy))
    let shareItem = UIMenuItem(title: "Share", action: #selector(customShare))
    let noteItem = UIMenuItem(title: "Note", action: #selector(customNote))
    let highlightItem = UIMenuItem(title: "Highlight", action: #selector(customHighlight))
    let bookmarkItem = UIMenuItem(title: "Bookmark", action: #selector(customBookmark))

    UIMenuController.shared.menuItems = [copyItem, shareItem, noteItem, highlightItem, bookmarkItem]
  }

  override var intrinsicContentSize: CGSize {
    let width = bounds.width > 0 ? bounds.width : UIScreen.main.bounds.width
    let size = textView.sizeThatFits(CGSize(width: width, height: .greatestFiniteMagnitude))
    return CGSize(width: width, height: size.height)
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    invalidateIntrinsicContentSize()

    // Report content size
    let size = intrinsicContentSize
    if size.height > 0 {
      onContentSizeChange([
        "width": size.width,
        "height": size.height
      ])
    }
  }

  // MARK: - Property Setters

  /// Set pre-formatted plain text (legacy mode)
  func setText(_ text: String?) {
    plainText = text ?? ""
    rebuildContent()
  }

  /// Set styled sections
  func setSections(_ newSections: [[String: Any]]?) {
    sections = newSections
    rebuildContent()
  }

  /// Set style specification from React Native
  func setStyleSpec(_ spec: [String: Any]?) {
    styleSpec = spec
    rebuildContent()
  }

  /// Set verse highlights - array of { verseId: Int, color: String }
  func setHighlights(_ newHighlights: [[String: Any]]?) {
    highlights.removeAll()
    if let newHighlights = newHighlights {
      for highlight in newHighlights {
        if let verseId = highlight["verseId"] as? Int,
           let color = highlight["color"] as? String {
          highlights[verseId] = color
        }
      }
    }
    rebuildContent()
  }

  // MARK: - Style Parsing Helpers

  /// Get style dictionary for a section type
  private func getStyle(for type: String) -> [String: Any]? {
    return styleSpec?[type] as? [String: Any]
  }

  /// Get verse number color from styleSpec
  private func getVerseNumberColor() -> UIColor {
    if let colorHex = styleSpec?["verseNumberColor"] as? String {
      return UIColor(hex: colorHex) ?? defaultVerseNumberColor
    }
    return defaultVerseNumberColor
  }

  /// Parse UIFont from style
  private func parseFont(from style: [String: Any]) -> UIFont {
    let fontFamily = style["fontFamily"] as? String ?? "Georgia"
    let fontWeight = style["fontWeight"] as? String ?? "regular"
    let fontStyle = style["fontStyle"] as? String ?? "normal"

    // Handle various number types from JavaScript/Expo modules
    let fontSize: CGFloat
    if let fontSizeDouble = style["fontSize"] as? Double {
      fontSize = CGFloat(fontSizeDouble)
    } else if let fontSizeInt = style["fontSize"] as? Int {
      fontSize = CGFloat(fontSizeInt)
    } else if let fontSizeNumber = style["fontSize"] as? NSNumber {
      fontSize = CGFloat(fontSizeNumber.doubleValue)
    } else {
      fontSize = defaultFontSize
    }

    // Map font weight string to UIFont.Weight
    let weight: UIFont.Weight = {
      switch fontWeight {
      case "ultralight": return .ultraLight
      case "light": return .light
      case "regular": return .regular
      case "medium": return .medium
      case "semibold": return .semibold
      case "bold": return .bold
      default: return .regular
      }
    }()

    // Create font
    var font: UIFont
    if fontFamily == "System" {
      font = UIFont.systemFont(ofSize: fontSize, weight: weight)
    } else if fontFamily == "Georgia" {
      font = UIFont(name: "Georgia", size: fontSize) ?? UIFont.systemFont(ofSize: fontSize)
    } else {
      font = UIFont(name: fontFamily, size: fontSize) ?? UIFont.systemFont(ofSize: fontSize, weight: weight)
    }

    // Apply italic if needed
    if fontStyle == "italic" {
      if let italicDescriptor = font.fontDescriptor.withSymbolicTraits(.traitItalic) {
        font = UIFont(descriptor: italicDescriptor, size: fontSize)
      }
    }

    return font
  }

  /// Parse UIColor from style
  private func parseColor(from style: [String: Any]) -> UIColor {
    if let colorHex = style["color"] as? String {
      return UIColor(hex: colorHex) ?? defaultTextColor
    }
    return defaultTextColor
  }

  /// Parse text alignment from style
  private func parseAlignment(from style: [String: Any]) -> NSTextAlignment {
    let textAlign = style["textAlign"] as? String ?? "left"
    switch textAlign {
    case "center": return .center
    case "right": return .right
    default: return .left
    }
  }

  /// Helper to extract CGFloat from style value (handles various number types)
  private func extractCGFloat(from value: Any?, defaultValue: CGFloat) -> CGFloat {
    if let doubleValue = value as? Double {
      return CGFloat(doubleValue)
    } else if let intValue = value as? Int {
      return CGFloat(intValue)
    } else if let numberValue = value as? NSNumber {
      return CGFloat(numberValue.doubleValue)
    }
    return defaultValue
  }

  /// Parse paragraph style from style
  private func parseParagraphStyle(from style: [String: Any], isPoetry: Bool = false) -> NSMutableParagraphStyle {
    let paraStyle = NSMutableParagraphStyle()

    let lineHeight = extractCGFloat(from: style["lineHeight"], defaultValue: defaultLineHeight)
    let marginTop = extractCGFloat(from: style["marginTop"], defaultValue: 0)
    let marginBottom = extractCGFloat(from: style["marginBottom"], defaultValue: 0)
    let indent = extractCGFloat(from: style["indent"], defaultValue: 0)
    // wrapIndent is the extra indent for wrapped continuation lines (default 20pt)
    let wrapIndent = extractCGFloat(from: style["wrapIndent"], defaultValue: 20)

    paraStyle.lineHeightMultiple = lineHeight
    paraStyle.paragraphSpacingBefore = marginTop
    paraStyle.paragraphSpacing = marginBottom
    paraStyle.alignment = parseAlignment(from: style)

    if indent > 0 {
      paraStyle.firstLineHeadIndent = indent
      // For poetry, wrapped continuation lines get extra indent (hanging indent style)
      paraStyle.headIndent = isPoetry ? indent + wrapIndent : 0
    }

    return paraStyle
  }

  /// Extract wrap indent from style (for continuation lines), default 20pt
  private func extractWrapIndent(from style: [String: Any]?) -> CGFloat {
    guard let style = style else { return 20 }
    return extractCGFloat(from: style["wrapIndent"], defaultValue: 20)
  }

  // MARK: - Content Building

  private func rebuildContent() {
    if let sections = sections, !sections.isEmpty {
      buildSectionsContent()
    } else {
      buildPlainTextContent()
    }
    invalidateIntrinsicContentSize()
    setNeedsLayout()
  }

  /// Build content from styled sections
  private func buildSectionsContent() {
    guard let sections = sections else { return }

    let attributed = NSMutableAttributedString()

    for (index, section) in sections.enumerated() {
      guard let type = section["type"] as? String,
            let text = section["text"] as? String else { continue }

      let verseStart = section["verseStart"] as? Int
      let verseEnd = section["verseEnd"] as? Int
      let lineIndents = section["lineIndents"] as? [[String: Any]]

      let sectionText = buildSectionAttributedString(type: type, text: text, verseStart: verseStart, verseEnd: verseEnd, lineIndents: lineIndents)
      attributed.append(sectionText)

      // Add spacing after each section (except last)
      if index < sections.count - 1 {
        let spacing = getSectionSpacing(type: type)
        attributed.append(NSAttributedString(string: spacing))
      }
    }

    textView.attributedText = attributed
  }

  /// Build attributed string for a single section based on its type
  private func buildSectionAttributedString(type: String, text: String, verseStart: Int?, verseEnd: Int?, lineIndents: [[String: Any]]? = nil) -> NSAttributedString {
    guard let style = getStyle(for: type) else {
      // Fallback: return plain text with default styling
      return buildDefaultAttributedString(text: text)
    }

    let font = parseFont(from: style)
    let color = parseColor(from: style)
    let isPoetry = type == "poetry"
    let paraStyle = parseParagraphStyle(from: style, isPoetry: isPoetry)

    // For prose/poetry, apply verse number coloring and highlights
    if type == "prose" || isPoetry {
      return buildTextWithVerseNumbers(text: text, font: font, color: color, paragraphStyle: paraStyle, verseStart: verseStart, verseEnd: verseEnd, lineIndents: lineIndents, style: style)
    }

    // For headers, just apply the style directly
    let attrs: [NSAttributedString.Key: Any] = [
      .font: font,
      .foregroundColor: color,
      .paragraphStyle: paraStyle
    ]

    return NSAttributedString(string: text, attributes: attrs)
  }

  /// Build default attributed string (fallback)
  private func buildDefaultAttributedString(text: String) -> NSAttributedString {
    let paraStyle = NSMutableParagraphStyle()
    paraStyle.lineHeightMultiple = defaultLineHeight

    let attrs: [NSAttributedString.Key: Any] = [
      .font: UIFont(name: "Georgia", size: defaultFontSize) ?? UIFont.systemFont(ofSize: defaultFontSize),
      .foregroundColor: defaultTextColor,
      .paragraphStyle: paraStyle
    ]

    return NSAttributedString(string: text, attributes: attrs)
  }

  /// Get spacing after a section type
  private func getSectionSpacing(type: String) -> String {
    switch type {
    case "chapter-header":
      return "\n\n"
    case "section-header":
      return "\n"
    case "section-subtitle":
      return "\n\n"
    case "poetry":
      return "\n"
    case "prose":
      return "\n\n"
    default:
      return "\n"
    }
  }

  /// Build text with verse number coloring and highlights (for prose/poetry)
  private func buildTextWithVerseNumbers(text: String, font: UIFont, color: UIColor, paragraphStyle: NSMutableParagraphStyle, verseStart: Int?, verseEnd: Int?, lineIndents: [[String: Any]]? = nil, style: [String: Any]? = nil) -> NSAttributedString {
    let attributed = NSMutableAttributedString()
    let verseNumColor = getVerseNumberColor()

    // Calculate base verse ID (chapter portion) from verseStart
    // verseStart format: BBCCCVVV (e.g., 43003016 for John 3:16)
    // Base = BBCCC000 (e.g., 43003000)
    let verseBase = (verseStart ?? 0) / 1000 * 1000

    // Track current verse ID
    var currentVerseId: Int? = verseStart
    var currentHighlightColor: UIColor? = nil

    // Check if current verse should be highlighted
    if let verseId = currentVerseId, let colorHex = highlights[verseId] {
      currentHighlightColor = UIColor(hex: colorHex)
    }

    // Build attributed string with verse number coloring and highlights
    var i = text.startIndex
    while i < text.endIndex {
      let char = text[i]
      if isSuperscriptChar(char) {
        // Start of superscript sequence - extract verse number
        var superscriptEnd = i
        while superscriptEnd < text.endIndex && isSuperscriptChar(text[superscriptEnd]) {
          superscriptEnd = text.index(after: superscriptEnd)
        }
        let superscriptStr = String(text[i..<superscriptEnd])

        // Decode superscript to get verse number
        let verseNum = decodeSuperscript(superscriptStr)
        if verseNum > 0 {
          currentVerseId = verseBase + verseNum
          // Check if this verse should be highlighted
          if let verseId = currentVerseId, let colorHex = highlights[verseId] {
            currentHighlightColor = UIColor(hex: colorHex)
          } else {
            currentHighlightColor = nil
          }
        }

        // Apply verse number styling (with highlight if active)
        var verseNumAttrs: [NSAttributedString.Key: Any] = [
          .font: font,
          .foregroundColor: verseNumColor,
          .paragraphStyle: paragraphStyle
        ]
        if let bgColor = currentHighlightColor {
          verseNumAttrs[.backgroundColor] = bgColor
        }
        attributed.append(NSAttributedString(string: superscriptStr, attributes: verseNumAttrs))
        i = superscriptEnd
      } else {
        // Regular text - collect until next superscript
        var textEnd = text.index(after: i)
        while textEnd < text.endIndex && !isSuperscriptChar(text[textEnd]) {
          textEnd = text.index(after: textEnd)
        }
        let textStr = String(text[i..<textEnd])

        // Apply text styling (with highlight if active)
        var textAttrs: [NSAttributedString.Key: Any] = [
          .font: font,
          .foregroundColor: color,
          .paragraphStyle: paragraphStyle
        ]
        if let bgColor = currentHighlightColor {
          textAttrs[.backgroundColor] = bgColor
        }
        attributed.append(NSAttributedString(string: textStr, attributes: textAttrs))
        i = textEnd
      }
    }

    // Apply per-line indentation for poetry (after building the full attributed string)
    if let lineIndents = lineIndents, !lineIndents.isEmpty {
      applyLineIndents(to: attributed, lineIndents: lineIndents, baseStyle: paragraphStyle, style: style)
    }

    return attributed
  }

  /// Apply per-line indentation to poetry sections
  /// Uses hanging indent style: wrapped continuation lines are indented more than the first line
  private func applyLineIndents(to attributed: NSMutableAttributedString, lineIndents: [[String: Any]], baseStyle: NSMutableParagraphStyle, style: [String: Any]?) {
    // Get the extra wrap indent from style (default 20pt)
    let wrapIndentExtra = extractWrapIndent(from: style)

    for indentInfo in lineIndents {
      guard let startIndex = indentInfo["startIndex"] as? Int,
            let endIndex = indentInfo["endIndex"] as? Int,
            let indentValue = indentInfo["indent"] as? Double else {
        continue
      }

      // Ensure range is valid
      let length = attributed.length
      let safeStart = min(startIndex, length)
      let safeEnd = min(endIndex, length)
      if safeStart >= safeEnd { continue }

      let range = NSRange(location: safeStart, length: safeEnd - safeStart)

      // Create paragraph style with this line's indent
      let lineParaStyle = baseStyle.mutableCopy() as! NSMutableParagraphStyle
      lineParaStyle.firstLineHeadIndent = CGFloat(indentValue)
      // Wrapped continuation lines get first line indent + extra wrap indent (hanging indent style)
      lineParaStyle.headIndent = CGFloat(indentValue) + wrapIndentExtra

      // Apply to this line's range
      attributed.addAttribute(.paragraphStyle, value: lineParaStyle, range: range)
    }
  }

  /// Decode superscript digits to integer
  private func decodeSuperscript(_ str: String) -> Int {
    let superscriptMap: [Character: Int] = [
      "\u{2070}": 0, // ⁰
      "\u{00B9}": 1, // ¹
      "\u{00B2}": 2, // ²
      "\u{00B3}": 3, // ³
      "\u{2074}": 4, // ⁴
      "\u{2075}": 5, // ⁵
      "\u{2076}": 6, // ⁶
      "\u{2077}": 7, // ⁷
      "\u{2078}": 8, // ⁸
      "\u{2079}": 9  // ⁹
    ]

    var result = 0
    for char in str {
      if let digit = superscriptMap[char] {
        result = result * 10 + digit
      }
    }
    return result
  }

  /// Build content from pre-formatted plain text (legacy mode)
  private func buildPlainTextContent() {
    // Use prose style from styleSpec if available, otherwise defaults
    let style = getStyle(for: "prose")

    let font: UIFont
    let color: UIColor
    let paraStyle: NSMutableParagraphStyle

    if let style = style {
      font = parseFont(from: style)
      color = parseColor(from: style)
      paraStyle = parseParagraphStyle(from: style)
    } else {
      font = UIFont(name: "Georgia", size: defaultFontSize) ?? UIFont.systemFont(ofSize: defaultFontSize)
      color = defaultTextColor
      paraStyle = NSMutableParagraphStyle()
      paraStyle.lineHeightMultiple = defaultLineHeight
    }

    // Plain text mode doesn't have verse info, pass nil for highlights
    let attributed = buildTextWithVerseNumbers(text: plainText, font: font, color: color, paragraphStyle: paraStyle, verseStart: nil, verseEnd: nil)
    textView.attributedText = attributed
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

  // MARK: - Actions

  private func sendAction(_ action: String) {
    guard let range = textView.selectedTextRange else { return }
    let selectedText = textView.text(in: range) ?? ""
    let start = textView.offset(from: textView.beginningOfDocument, to: range.start)
    let end = textView.offset(from: textView.beginningOfDocument, to: range.end)

    // JS handles verse mapping via mapSelectionToVerses() using selectionStart/End
    onAction([
      "action": action,
      "selectedText": selectedText,
      "selectionStart": start,
      "selectionEnd": end
    ])
  }

  @objc private func customCopy() {
    // JS handles clipboard via expo-clipboard (with formatted text + toast)
    sendAction("copy")
  }

  @objc private func customShare() {
    sendAction("share")
  }

  @objc private func customNote() {
    sendAction("note")
  }

  @objc private func customHighlight() {
    sendAction("highlight")
  }

  @objc private func customBookmark() {
    sendAction("bookmark")
  }

  override func canPerformAction(_ action: Selector, withSender sender: Any?) -> Bool {
    let customActions: [Selector] = [
      #selector(customCopy),
      #selector(customShare),
      #selector(customNote),
      #selector(customHighlight),
      #selector(customBookmark)
    ]
    if customActions.contains(action) {
      return textView.selectedTextRange != nil
    }
    return false
  }

  // MARK: - iOS 16+ Edit Menu Delegate

  /// For iOS 16+, this delegate method completely replaces the menu with only custom actions.
  /// This is cleaner than relying solely on canPerformAction.
  @available(iOS 16.0, *)
  func textView(_ textView: UITextView, editMenuForTextIn range: NSRange, suggestedActions: [UIMenuElement]) -> UIMenu? {
    // Only show menu if there's a selection
    guard range.length > 0 else { return nil }

    // Create custom UIActions for iOS 16+
    let copyAction = UIAction(title: "Copy", image: UIImage(systemName: "doc.on.doc")) { [weak self] _ in
      self?.customCopy()
    }
    let shareAction = UIAction(title: "Share", image: UIImage(systemName: "square.and.arrow.up")) { [weak self] _ in
      self?.customShare()
    }
    let noteAction = UIAction(title: "Note", image: UIImage(systemName: "note.text")) { [weak self] _ in
      self?.customNote()
    }
    let highlightAction = UIAction(title: "Highlight", image: UIImage(systemName: "highlighter")) { [weak self] _ in
      self?.customHighlight()
    }
    let bookmarkAction = UIAction(title: "Bookmark", image: UIImage(systemName: "bookmark")) { [weak self] _ in
      self?.customBookmark()
    }

    // Return ONLY our custom menu - ignores suggestedActions (system defaults)
    return UIMenu(children: [copyAction, shareAction, noteAction, highlightAction, bookmarkAction])
  }
}

// MARK: - UIColor Extension

extension UIColor {
  convenience init?(hex: String) {
    var hexSanitized = hex.trimmingCharacters(in: .whitespacesAndNewlines)
    hexSanitized = hexSanitized.replacingOccurrences(of: "#", with: "")

    var rgb: UInt64 = 0
    guard Scanner(string: hexSanitized).scanHexInt64(&rgb) else { return nil }

    let r, g, b, a: CGFloat
    switch hexSanitized.count {
    case 6:
      r = CGFloat((rgb & 0xFF0000) >> 16) / 255.0
      g = CGFloat((rgb & 0x00FF00) >> 8) / 255.0
      b = CGFloat(rgb & 0x0000FF) / 255.0
      a = 1.0
    case 8:
      r = CGFloat((rgb & 0xFF000000) >> 24) / 255.0
      g = CGFloat((rgb & 0x00FF0000) >> 16) / 255.0
      b = CGFloat((rgb & 0x0000FF00) >> 8) / 255.0
      a = CGFloat(rgb & 0x000000FF) / 255.0
    default:
      return nil
    }

    self.init(red: r, green: g, blue: b, alpha: a)
  }
}
