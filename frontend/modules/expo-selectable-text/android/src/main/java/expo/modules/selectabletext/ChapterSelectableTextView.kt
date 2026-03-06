package expo.modules.selectabletext

import android.content.Context
import android.graphics.Color
import android.graphics.Rect
import android.graphics.Typeface
import android.os.Build
import android.text.Layout
import android.text.SpannableStringBuilder
import android.text.Spanned
import android.text.style.AbsoluteSizeSpan
import android.text.style.AlignmentSpan
import android.text.style.BackgroundColorSpan
import android.text.style.ForegroundColorSpan
import android.text.style.LeadingMarginSpan
import android.text.style.StyleSpan
import android.util.TypedValue
import android.view.ActionMode
import android.view.HapticFeedbackConstants
import android.view.Menu
import android.view.MenuItem
import android.view.View
import android.widget.TextView
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView

/**
 * ChapterSelectableTextView - Android Implementation
 *
 * Renders an entire chapter as one selectable TextView with styled text.
 * Supports cross-paragraph selection and custom context menu.
 *
 * Style Spec Architecture:
 * - All styling is defined in React Native and passed via styleSpec
 * - This view only applies styles, doesn't define them
 * - No hardcoded style values - everything comes from styleSpec
 */
class ChapterSelectableTextView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {

  /**
   * Custom TextView that prevents scroll-into-view behavior when gaining focus.
   * This fixes the auto-scroll issue in RecyclerView/FlashList when text is tapped.
   *
   * The root cause: setTextIsSelectable(true) makes TextView focusable, and ANY touch
   * (including single tap) can trigger focus. When focus is gained, TextView calls
   * requestRectangleOnScreen() which propagates to RecyclerView's LayoutManager,
   * causing unwanted scroll jumps.
   *
   * By overriding requestRectangleOnScreen() on the TextView itself, we intercept
   * the scroll request at the source while still allowing text selection to work.
   */
  private inner class NoScrollTextView(context: Context) : TextView(context) {
    override fun requestRectangleOnScreen(rectangle: Rect?, immediate: Boolean): Boolean {
      // Don't request parent to scroll - prevents FlashList jump
      return false
    }
  }

  private val textView = NoScrollTextView(context)
  private var lastReportedHeight: Int = 0

  // Style specification from React Native
  private var styleSpec: Map<String, Any>? = null

  // Content - plain text mode (legacy)
  private var plainText: String = ""

  // Content - sections mode (new)
  private var sections: List<Map<String, Any>>? = null

  // Verse highlights - map from verseId to color hex string
  private var highlights: MutableMap<Int, String> = mutableMapOf()

  // Default values (used when styleSpec not provided)
  private val defaultTextColor: Int = Color.parseColor("#1F2937")
  private val defaultVerseNumberColor: Int = Color.parseColor("#6366F1")
  private val defaultFontSize: Float = 18f
  private val defaultLineHeight: Float = 1.75f

  private val onAction by EventDispatcher()
  private val onContentSizeChange by EventDispatcher()

  // Unicode superscript digits used for verse numbers
  private val superscriptChars = setOf(
    '\u2070', // 0
    '\u00B9', // 1
    '\u00B2', // 2
    '\u00B3', // 3
    '\u2074', // 4
    '\u2075', // 5
    '\u2076', // 6
    '\u2077', // 7
    '\u2078', // 8
    '\u2079'  // 9
  )

  companion object {
    private const val MENU_COPY = 1
    private const val MENU_SHARE = 2
    private const val MENU_NOTE = 3
    private const val MENU_HIGHLIGHT = 4
    private const val MENU_BOOKMARK = 5
  }

  init {
    setupTextView()
    addView(textView, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT))

    // Disable baseline alignment to prevent Fabric crash
    setBaselineAligned(false)

    // Prevent clipping of selection handles
    clipChildren = false
    clipToPadding = false
  }

  override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
    val specWidth = MeasureSpec.getSize(widthMeasureSpec)
    val width = if (specWidth > 0) specWidth else context.resources.displayMetrics.widthPixels

    val childWidthSpec = MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY)
    val childHeightSpec = MeasureSpec.makeMeasureSpec(0, MeasureSpec.UNSPECIFIED)
    textView.measure(childWidthSpec, childHeightSpec)

    val minLineHeight = textView.lineHeight.coerceAtLeast(20)
    val contentHeight = textView.measuredHeight.coerceAtLeast(minLineHeight)

    setMeasuredDimension(width, contentHeight)

    if (contentHeight != lastReportedHeight && contentHeight > 0) {
      lastReportedHeight = contentHeight
      // Convert pixels to dp for React Native (which expects dp values)
      val density = context.resources.displayMetrics.density
      val widthDp = width / density
      val heightDp = contentHeight / density
      post {
        onContentSizeChange(mapOf("width" to widthDp, "height" to heightDp))
      }
    }
  }

  override fun onLayout(changed: Boolean, l: Int, t: Int, r: Int, b: Int) {
    val width = r - l
    // Use textView's measured height, not the constrained height from parent
    val textHeight = textView.measuredHeight
    textView.layout(0, 0, width, textHeight)
  }

  /**
   * Tell parent (FlashList) that this view doesn't scroll vertically.
   * This prevents setTextIsSelectable from enabling internal scrolling.
   */
  override fun canScrollVertically(direction: Int): Boolean = false

  /**
   * Prevent parent RecyclerView/FlashList from auto-scrolling when this view gains focus.
   * This is called by the framework when a child needs to be made visible.
   * By returning false, we tell the parent not to scroll.
   */
  override fun requestRectangleOnScreen(rectangle: Rect?, immediate: Boolean): Boolean {
    // Don't request scrolling - prevents FlashList jump on text selection
    return false
  }

  /**
   * Override to prevent RecyclerView from receiving focus change notifications.
   * When a child requests focus, the default behavior notifies the parent chain,
   * which causes RecyclerView's LayoutManager to call requestChildRectangleOnScreen().
   * By not calling super, we break this chain while still allowing the child to have focus.
   */
  override fun requestChildFocus(child: View?, focused: View?) {
    // Don't call super - this prevents RecyclerView from being notified
    // The TextView still gets focus, but RecyclerView doesn't scroll
  }

  /**
   * Override to prevent focus clear notifications from propagating to RecyclerView.
   * This complements requestChildFocus() to fully isolate focus changes from the parent.
   */
  override fun clearChildFocus(child: View?) {
    // Don't call super - prevents focus change from propagating to RecyclerView
  }

  private fun setupTextView() {
    textView.setTextIsSelectable(true)
    textView.isFocusable = true
    textView.isFocusableInTouchMode = true

    // Disable scrolling - FlashList handles scrolling
    textView.isVerticalScrollBarEnabled = false
    textView.isHorizontalScrollBarEnabled = false
    textView.setHorizontallyScrolling(false)
    textView.isNestedScrollingEnabled = false
    textView.overScrollMode = View.OVER_SCROLL_NEVER

    // Prevent internal scrolling by resetting scroll on any scroll attempt
    textView.setOnScrollChangeListener { _, _, _, _, _ ->
      textView.scrollTo(0, 0)
    }

    val callback = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      object : ActionMode.Callback2() {
        override fun onCreateActionMode(mode: ActionMode?, menu: Menu?): Boolean {
          textView.performHapticFeedback(HapticFeedbackConstants.LONG_PRESS)
          menu?.clear()
          menu?.removeItem(android.R.id.selectAll)
          menu?.removeItem(android.R.id.cut)
          menu?.removeItem(android.R.id.copy)
          menu?.removeItem(android.R.id.paste)
          menu?.add(0, MENU_COPY, 0, "Copy")
          menu?.add(0, MENU_SHARE, 1, "Share")
          menu?.add(0, MENU_NOTE, 2, "Note")
          menu?.add(0, MENU_HIGHLIGHT, 3, "Highlight")
          menu?.add(0, MENU_BOOKMARK, 4, "Bookmark")
          return true
        }

        override fun onPrepareActionMode(mode: ActionMode?, menu: Menu?): Boolean = true

        override fun onActionItemClicked(mode: ActionMode?, item: MenuItem?): Boolean {
          textView.performHapticFeedback(HapticFeedbackConstants.CONTEXT_CLICK)
          return handleActionClick(item, mode)
        }

        override fun onDestroyActionMode(mode: ActionMode?) {}

        override fun onGetContentRect(mode: ActionMode?, view: View?, outRect: Rect?) {
          if (outRect != null && view != null) {
            val selStart = textView.selectionStart
            val selEnd = textView.selectionEnd
            if (selStart >= 0 && selEnd > selStart) {
              val layout = textView.layout
              if (layout != null) {
                val startLine = layout.getLineForOffset(selStart)
                val endLine = layout.getLineForOffset(selEnd)
                outRect.set(0, layout.getLineTop(startLine), view.width, layout.getLineBottom(endLine))
              }
            }
          }
        }
      }
    } else {
      object : ActionMode.Callback {
        override fun onCreateActionMode(mode: ActionMode?, menu: Menu?): Boolean {
          textView.performHapticFeedback(HapticFeedbackConstants.LONG_PRESS)
          menu?.clear()
          menu?.removeItem(android.R.id.selectAll)
          menu?.removeItem(android.R.id.cut)
          menu?.removeItem(android.R.id.copy)
          menu?.removeItem(android.R.id.paste)
          menu?.add(0, MENU_COPY, 0, "Copy")
          menu?.add(0, MENU_SHARE, 1, "Share")
          menu?.add(0, MENU_NOTE, 2, "Note")
          menu?.add(0, MENU_HIGHLIGHT, 3, "Highlight")
          menu?.add(0, MENU_BOOKMARK, 4, "Bookmark")
          return true
        }

        override fun onPrepareActionMode(mode: ActionMode?, menu: Menu?): Boolean = true

        override fun onActionItemClicked(mode: ActionMode?, item: MenuItem?): Boolean {
          textView.performHapticFeedback(HapticFeedbackConstants.CONTEXT_CLICK)
          return handleActionClick(item, mode)
        }

        override fun onDestroyActionMode(mode: ActionMode?) {}
      }
    }

    textView.customSelectionActionModeCallback = callback
    textView.customInsertionActionModeCallback = callback
  }

  private fun handleActionClick(item: MenuItem?, mode: ActionMode?): Boolean {
    val start = textView.selectionStart
    val end = textView.selectionEnd
    val selectedText = if (start >= 0 && end > start) {
      textView.text.subSequence(start, end).toString()
    } else ""

    val action = when (item?.itemId) {
      MENU_COPY -> "copy"
      MENU_SHARE -> "share"
      MENU_NOTE -> "note"
      MENU_HIGHLIGHT -> "highlight"
      MENU_BOOKMARK -> "bookmark"
      else -> return false
    }

    // JS handles clipboard via expo-clipboard (with formatted text + toast)
    onAction(mapOf(
      "action" to action,
      "selectedText" to selectedText,
      "selectionStart" to start,
      "selectionEnd" to end
    ))

    mode?.finish()
    return true
  }

  // MARK: - Property Setters

  /**
   * Set pre-formatted plain text (legacy mode)
   */
  fun setText(text: String?) {
    plainText = text ?: ""
    rebuildContent()
  }

  /**
   * Set styled sections
   */
  fun setSections(newSections: List<Map<String, Any>>?) {
    sections = newSections
    rebuildContent()
  }

  /**
   * Set style specification from React Native
   */
  fun setStyleSpec(spec: Map<String, Any>?) {
    styleSpec = spec
    rebuildContent()
  }

  /**
   * Set verse highlights - array of { verseId: Int, color: String }
   */
  fun setHighlights(newHighlights: List<Map<String, Any>>?) {
    highlights.clear()
    newHighlights?.forEach { highlight ->
      val verseId = (highlight["verseId"] as? Number)?.toInt()
      val color = highlight["color"] as? String
      if (verseId != null && color != null) {
        highlights[verseId] = color
      }
    }
    rebuildContent()
  }

  // MARK: - Style Parsing Helpers

  /**
   * Get style map for a section type
   */
  @Suppress("UNCHECKED_CAST")
  private fun getStyle(type: String): Map<String, Any>? {
    return styleSpec?.get(type) as? Map<String, Any>
  }

  /**
   * Get verse number color from styleSpec
   */
  private fun getVerseNumberColor(): Int {
    val colorHex = styleSpec?.get("verseNumberColor") as? String
    return if (colorHex != null) {
      try {
        Color.parseColor(colorHex)
      } catch (_: Exception) {
        defaultVerseNumberColor
      }
    } else {
      defaultVerseNumberColor
    }
  }

  /**
   * Parse font size from style
   */
  private fun parseFontSize(style: Map<String, Any>): Float {
    return (style["fontSize"] as? Number)?.toFloat() ?: defaultFontSize
  }

  /**
   * Parse text color from style
   */
  private fun parseColor(style: Map<String, Any>): Int {
    val colorHex = style["color"] as? String
    return if (colorHex != null) {
      try {
        Color.parseColor(colorHex)
      } catch (_: Exception) {
        defaultTextColor
      }
    } else {
      defaultTextColor
    }
  }

  /**
   * Parse font weight to Typeface style
   */
  private fun parseFontWeight(style: Map<String, Any>): Int {
    return when (style["fontWeight"] as? String) {
      "bold" -> Typeface.BOLD
      "semibold" -> Typeface.BOLD
      "medium" -> Typeface.BOLD // Android doesn't have medium, use bold
      else -> Typeface.NORMAL
    }
  }

  /**
   * Parse font style (italic)
   */
  private fun parseFontStyle(style: Map<String, Any>): Int {
    return if (style["fontStyle"] == "italic") {
      Typeface.ITALIC
    } else {
      Typeface.NORMAL
    }
  }

  /**
   * Combine font weight and style
   */
  private fun parseTypefaceStyle(style: Map<String, Any>): Int {
    val weight = parseFontWeight(style)
    val fontStyle = parseFontStyle(style)
    return when {
      weight == Typeface.BOLD && fontStyle == Typeface.ITALIC -> Typeface.BOLD_ITALIC
      weight == Typeface.BOLD -> Typeface.BOLD
      fontStyle == Typeface.ITALIC -> Typeface.ITALIC
      else -> Typeface.NORMAL
    }
  }

  /**
   * Parse text alignment
   */
  private fun parseAlignment(style: Map<String, Any>): Layout.Alignment {
    return when (style["textAlign"] as? String) {
      "center" -> Layout.Alignment.ALIGN_CENTER
      "right" -> Layout.Alignment.ALIGN_OPPOSITE
      else -> Layout.Alignment.ALIGN_NORMAL
    }
  }

  /**
   * Parse line height multiplier
   */
  private fun parseLineHeight(style: Map<String, Any>): Float {
    return (style["lineHeight"] as? Number)?.toFloat() ?: defaultLineHeight
  }

  /**
   * Parse indent in pixels
   */
  private fun parseIndent(style: Map<String, Any>): Int {
    val indentDp = (style["indent"] as? Number)?.toFloat() ?: 0f
    return if (indentDp > 0) {
      TypedValue.applyDimension(
        TypedValue.COMPLEX_UNIT_DIP,
        indentDp,
        context.resources.displayMetrics
      ).toInt()
    } else {
      0
    }
  }

  /**
   * Parse wrap indent (for continuation lines) in pixels.
   * This is the EXTRA indent added to wrapped lines beyond the first line indent.
   * Default is 20dp if not specified.
   */
  private fun parseWrapIndent(style: Map<String, Any>): Int {
    // wrapIndent is the additional indent for wrapped continuation lines
    val wrapIndentDp = (style["wrapIndent"] as? Number)?.toFloat() ?: 20f
    return TypedValue.applyDimension(
      TypedValue.COMPLEX_UNIT_DIP,
      wrapIndentDp,
      context.resources.displayMetrics
    ).toInt()
  }

  // MARK: - Content Building

  private fun rebuildContent() {
    val currentSections = sections
    if (currentSections != null && currentSections.isNotEmpty()) {
      buildSectionsContent()
    } else {
      buildPlainTextContent()
    }
    requestLayout()
  }

  /**
   * Build content from styled sections
   */
  @Suppress("UNCHECKED_CAST")
  private fun buildSectionsContent() {
    val sectionsList = sections ?: return
    val spannable = SpannableStringBuilder()

    for ((index, section) in sectionsList.withIndex()) {
      val type = section["type"] as? String ?: continue
      val text = section["text"] as? String ?: continue
      val verseStart = (section["verseStart"] as? Number)?.toInt()
      val verseEnd = (section["verseEnd"] as? Number)?.toInt()
      val lineIndents = section["lineIndents"] as? List<Map<String, Any>>

      val startPos = spannable.length
      spannable.append(text)
      val endPos = spannable.length

      // Apply styling based on section type
      applySectionStyle(spannable, type, startPos, endPos, verseStart, verseEnd, lineIndents)

      // Add spacing after each section (except last)
      if (index < sectionsList.size - 1) {
        val spacing = getSectionSpacing(type)
        spannable.append(spacing)
      }
    }

    textView.text = spannable

    // Apply default line height and font from prose style if available
    val proseStyle = getStyle("prose")
    val lineHeight = if (proseStyle != null) parseLineHeight(proseStyle) else defaultLineHeight
    val fontFamily = if (proseStyle != null) proseStyle["fontFamily"] as? String else null
    textView.setLineSpacing(0f, lineHeight)
    textView.typeface = getTypefaceForFamily(fontFamily)
  }

  /**
   * Apply styling for a section based on its type and styleSpec
   */
  private fun applySectionStyle(spannable: SpannableStringBuilder, type: String, start: Int, end: Int, verseStart: Int? = null, verseEnd: Int? = null, lineIndents: List<Map<String, Any>>? = null) {
    val style = getStyle(type)
    if (style == null) {
      // Fallback: apply default styling
      applyDefaultStyle(spannable, start, end)
      return
    }

    val fontSize = parseFontSize(style)
    val color = parseColor(style)
    val typefaceStyle = parseTypefaceStyle(style)
    val alignment = parseAlignment(style)

    // Apply font size
    spannable.setSpan(
      AbsoluteSizeSpan(spToPx(fontSize)),
      start, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
    )

    // Apply text color
    spannable.setSpan(
      ForegroundColorSpan(color),
      start, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
    )

    // Apply typeface style (bold/italic)
    if (typefaceStyle != Typeface.NORMAL) {
      spannable.setSpan(
        StyleSpan(typefaceStyle),
        start, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
      )
    }

    // Apply alignment
    spannable.setSpan(
      AlignmentSpan.Standard(alignment),
      start, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
    )

    // For poetry with lineIndents, apply per-line indentation
    // Otherwise fall back to global indent from style spec
    if (type == "poetry" && lineIndents != null && lineIndents.isNotEmpty()) {
      applyLineIndents(spannable, start, lineIndents, style)
    } else {
      // Apply global indent if needed
      val indent = parseIndent(style)
      if (indent > 0) {
        // For poetry, wrapped continuation lines get extra indent (hanging indent style)
        val wrapIndent = if (type == "poetry") indent + parseWrapIndent(style) else 0
        spannable.setSpan(
          LeadingMarginSpan.Standard(indent, wrapIndent),
          start, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
        )
      }
    }

    // For prose/poetry, apply verse number coloring and highlights
    if (type == "prose" || type == "poetry") {
      applyVerseNumberColorAndHighlights(spannable, start, end, verseStart)
    }
  }

  /**
   * Apply per-line indentation for poetry sections
   * Uses hanging indent style: wrapped continuation lines are indented more than the first line
   */
  private fun applyLineIndents(spannable: SpannableStringBuilder, sectionStart: Int, lineIndents: List<Map<String, Any>>, style: Map<String, Any>) {
    // Get the extra wrap indent from style (default 20dp)
    val wrapIndentExtra = parseWrapIndent(style)

    for (indentInfo in lineIndents) {
      val startIndex = (indentInfo["startIndex"] as? Number)?.toInt() ?: continue
      val endIndex = (indentInfo["endIndex"] as? Number)?.toInt() ?: continue
      val indentDp = (indentInfo["indent"] as? Number)?.toFloat() ?: 0f

      // Convert dp to pixels
      val indentPx = if (indentDp > 0) {
        TypedValue.applyDimension(
          TypedValue.COMPLEX_UNIT_DIP,
          indentDp,
          context.resources.displayMetrics
        ).toInt()
      } else {
        0
      }

      // Calculate absolute positions in spannable
      val absStart = sectionStart + startIndex
      val absEnd = sectionStart + endIndex

      // Ensure range is valid
      val length = spannable.length
      val safeStart = absStart.coerceIn(0, length)
      val safeEnd = absEnd.coerceIn(0, length)
      if (safeStart >= safeEnd) continue

      // Apply leading margin span for this line
      // First param: first line indent, Second param: rest (wrapped) lines indent
      // Wrapped lines get first line indent + extra wrap indent (hanging indent style)
      val wrapIndentPx = indentPx + wrapIndentExtra
      spannable.setSpan(
        LeadingMarginSpan.Standard(indentPx, wrapIndentPx),
        safeStart, safeEnd, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
      )
    }
  }

  /**
   * Apply default styling (fallback when no styleSpec)
   */
  private fun applyDefaultStyle(spannable: SpannableStringBuilder, start: Int, end: Int) {
    spannable.setSpan(
      AbsoluteSizeSpan(spToPx(defaultFontSize)),
      start, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
    )
    spannable.setSpan(
      ForegroundColorSpan(defaultTextColor),
      start, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
    )
  }

  /**
   * Get spacing after a section type
   */
  private fun getSectionSpacing(type: String): String {
    return when (type) {
      "chapter-header" -> "\n\n"
      "section-header" -> "\n"
      "section-subtitle" -> "\n\n"
      "poetry" -> "\n"
      "prose" -> "\n\n"
      else -> "\n"
    }
  }

  /**
   * Apply verse number coloring and highlights to a range in the spannable
   * Tracks verse boundaries based on superscript verse numbers and applies background colors
   */
  private fun applyVerseNumberColorAndHighlights(spannable: SpannableStringBuilder, start: Int, end: Int, verseStart: Int?) {
    val verseNumColor = getVerseNumberColor()
    val text = spannable.subSequence(start, end).toString()

    // Calculate base verse ID (chapter portion) from verseStart
    // verseStart format: BBCCCVVV (e.g., 43003016 for John 3:16)
    // Base = BBCCC000 (e.g., 43003000)
    val verseBase = (verseStart ?: 0) / 1000 * 1000

    // Track current verse ID
    var currentVerseId: Int? = verseStart
    var currentHighlightColor: Int? = null

    // Check if current verse should be highlighted
    if (currentVerseId != null) {
      highlights[currentVerseId]?.let { colorHex ->
        currentHighlightColor = parseHexColor(colorHex)
      }
    }

    var i = 0
    while (i < text.length) {
      if (text[i] in superscriptChars) {
        // Start of superscript sequence - extract verse number
        val ssStart = i
        while (i < text.length && text[i] in superscriptChars) i++
        val superscriptStr = text.substring(ssStart, i)

        // Decode superscript to get verse number and update current verse ID
        val verseNum = decodeSuperscript(superscriptStr)
        if (verseNum > 0) {
          currentVerseId = verseBase + verseNum
          // Check if this verse should be highlighted
          currentHighlightColor = currentVerseId?.let { vid ->
            highlights[vid]?.let { colorHex -> parseHexColor(colorHex) }
          }
        }

        // Apply verse number color
        spannable.setSpan(
          ForegroundColorSpan(verseNumColor),
          start + ssStart,
          start + i,
          Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
        )

        // Apply highlight background if active
        currentHighlightColor?.let { bgColor ->
          spannable.setSpan(
            BackgroundColorSpan(bgColor),
            start + ssStart,
            start + i,
            Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
          )
        }
      } else {
        // Regular text - collect until next superscript
        val textStart = i
        while (i < text.length && text[i] !in superscriptChars) i++

        // Apply highlight background if active
        currentHighlightColor?.let { bgColor ->
          spannable.setSpan(
            BackgroundColorSpan(bgColor),
            start + textStart,
            start + i,
            Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
          )
        }
      }
    }
  }

  /**
   * Build content from pre-formatted plain text (legacy mode)
   */
  private fun buildPlainTextContent() {
    // Use prose style from styleSpec if available, otherwise defaults
    val style = getStyle("prose")
    val verseNumColor = getVerseNumberColor()

    val textColor = if (style != null) parseColor(style) else defaultTextColor
    val fontSize = if (style != null) parseFontSize(style) else defaultFontSize
    val lineHeight = if (style != null) parseLineHeight(style) else defaultLineHeight
    val fontFamily = if (style != null) style["fontFamily"] as? String else null

    // Build spannable with verse number coloring
    val spannable = SpannableStringBuilder(plainText)
    var i = 0
    while (i < plainText.length) {
      if (plainText[i] in superscriptChars) {
        val start = i
        while (i < plainText.length && plainText[i] in superscriptChars) i++
        spannable.setSpan(
          ForegroundColorSpan(verseNumColor),
          start,
          i,
          Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
        )
      } else {
        i++
      }
    }

    textView.text = spannable
    textView.setTextSize(TypedValue.COMPLEX_UNIT_SP, fontSize)
    textView.setTextColor(textColor)
    textView.setLineSpacing(0f, lineHeight)
    textView.typeface = getTypefaceForFamily(fontFamily)
  }

  /**
   * Map font family names to Android Typefaces
   * Custom fonts like Literata need to be loaded from assets;
   * fallback to built-in serif for Bible reading experience
   */
  private fun getTypefaceForFamily(fontFamily: String?): Typeface {
    if (fontFamily == null) return Typeface.SERIF // Default to serif for Bible reading

    return when {
      // System/sans-serif fonts
      fontFamily == "System" || fontFamily.contains("Inter") -> Typeface.DEFAULT

      // Serif fonts - use Android's built-in serif
      // Georgia, Literata, or any serif request maps to Android serif
      fontFamily == "Georgia" ||
      fontFamily.contains("Literata") ||
      fontFamily == "serif" -> Typeface.SERIF

      // Monospace
      fontFamily == "monospace" || fontFamily.contains("Mono") -> Typeface.MONOSPACE

      // Try to load custom font from assets, fallback to serif for reading
      else -> {
        try {
          // Try loading from assets/fonts folder
          val assetPath = "fonts/$fontFamily.ttf"
          Typeface.createFromAsset(context.assets, assetPath)
        } catch (_: Exception) {
          // Fallback to serif for better reading experience
          Typeface.SERIF
        }
      }
    }
  }

  private fun spToPx(sp: Float): Int {
    return TypedValue.applyDimension(
      TypedValue.COMPLEX_UNIT_SP,
      sp,
      context.resources.displayMetrics
    ).toInt()
  }

  /**
   * Decode superscript digits to integer verse number
   */
  private fun decodeSuperscript(str: String): Int {
    val superscriptMap = mapOf(
      '\u2070' to 0, // ⁰
      '\u00B9' to 1, // ¹
      '\u00B2' to 2, // ²
      '\u00B3' to 3, // ³
      '\u2074' to 4, // ⁴
      '\u2075' to 5, // ⁵
      '\u2076' to 6, // ⁶
      '\u2077' to 7, // ⁷
      '\u2078' to 8, // ⁸
      '\u2079' to 9  // ⁹
    )

    var result = 0
    for (char in str) {
      superscriptMap[char]?.let { digit ->
        result = result * 10 + digit
      }
    }
    return result
  }

  /**
   * Parse hex color string to Android Color int
   */
  private fun parseHexColor(hex: String): Int? {
    return try {
      val sanitized = hex.trimStart('#')
      when (sanitized.length) {
        6 -> Color.parseColor("#$sanitized")
        8 -> {
          // ARGB format: #RRGGBBAA -> Android needs #AARRGGBB
          val r = sanitized.substring(0, 2)
          val g = sanitized.substring(2, 4)
          val b = sanitized.substring(4, 6)
          val a = sanitized.substring(6, 8)
          Color.parseColor("#$a$r$g$b")
        }
        else -> null
      }
    } catch (_: Exception) {
      null
    }
  }
}
