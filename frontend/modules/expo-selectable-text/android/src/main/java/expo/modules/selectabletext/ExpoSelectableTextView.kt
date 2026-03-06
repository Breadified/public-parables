package expo.modules.selectabletext

import android.content.Context
import android.graphics.Color
import android.graphics.Rect
import android.graphics.Typeface
import android.text.style.BackgroundColorSpan
import android.os.Build
import android.text.SpannableStringBuilder
import android.text.Spanned
import android.text.style.ForegroundColorSpan
import android.text.style.LeadingMarginSpan
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
 * ExpoSelectableTextView - Paragraph-level native text selection
 *
 * Style Spec Architecture:
 * - Styling can be defined in React Native via styleSpec prop
 * - Native module applies styles from spec (uses "prose" section)
 * - Legacy individual props still work as fallback
 */
class ExpoSelectableTextView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {

  /**
   * Custom TextView that prevents scroll-into-view behavior when gaining focus.
   * This fixes the auto-scroll issue in RecyclerView/FlashList when text is tapped.
   *
   * The root cause: setTextIsSelectable(true) makes TextView focusable, and ANY touch
   * (including single tap) can trigger focus. When focus is gained, TextView calls
   * requestRectangleOnScreen() on itself, which propagates to RecyclerView's LayoutManager,
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
  private var verseId: Int? = null
  private var currentText: String = ""
  private var lastReportedHeight: Int = 0
  private val onAction by EventDispatcher()
  private val onContentSizeChange by EventDispatcher()

  // Style specification from React Native
  private var styleSpec: Map<String, Any>? = null

  // Legacy style values (used as fallback)
  private var legacyFontSize: Float = 17f
  private var legacyFontFamily: String? = null
  private var legacyTextColor: Int = Color.parseColor("#1F2937")
  // Now stores absolute line height (in SP), not multiplier
  private var legacyLineHeight: Float = 31.5f  // Default: 18 * 1.75

  // Verse number color (computed from styleSpec or legacy)
  private var verseNumberColor: Int? = null

  // Character-range based highlights
  private var highlights: List<Map<String, Any>> = emptyList()

  // First-line indent for poetry (in pixels) - legacy single value
  private var indentPx: Int = 0

  // Per-line indents for flattened poetry
  private var lineIndents: List<Map<String, Any>> = emptyList()

  // Superscript unicode characters used for verse numbers
  private val superscriptChars = setOf('⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹')

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
    // ExpoView extends LinearLayout, and during rapid Fabric reconciliation,
    // LinearLayout's mBaselines[] array can become null causing NullPointerException
    setBaselineAligned(false)

    // Prevent clipping of selection handles that extend outside text bounds
    clipChildren = false
    clipToPadding = false
  }

  // Proper sizing for React Native layout system (Fabric compatible)
  // CRITICAL: Always measure actual content height and return it
  // Even if Yoga passes EXACTLY mode, we need to expand to fit content
  override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
    val specWidth = MeasureSpec.getSize(widthMeasureSpec)
    val specHeight = MeasureSpec.getSize(heightMeasureSpec)
    val heightMode = MeasureSpec.getMode(heightMeasureSpec)

    // Use spec width if provided, otherwise use screen width
    val width = if (specWidth > 0) {
      specWidth
    } else {
      context.resources.displayMetrics.widthPixels
    }

    // ALWAYS measure the actual content height first
    val childWidthSpec = MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY)
    val childHeightSpec = MeasureSpec.makeMeasureSpec(0, MeasureSpec.UNSPECIFIED)
    textView.measure(childWidthSpec, childHeightSpec)

    // Get actual content height (minimum 1 line to prevent 0)
    val minLineHeight = textView.lineHeight.coerceAtLeast(20)
    val contentHeight = textView.measuredHeight.coerceAtLeast(minLineHeight)

    // Use the LARGER of spec height and content height
    // This ensures content is never clipped, even if Yoga passes a small EXACTLY value
    val finalHeight = if (heightMode == MeasureSpec.EXACTLY && specHeight > 0) {
      maxOf(specHeight, contentHeight)
    } else {
      contentHeight
    }

    android.util.Log.d("SelectableText", "onMeasure: specWidth=$specWidth, specHeight=$specHeight, contentHeight=$contentHeight, finalHeight=$finalHeight, textLength=${textView.text?.length ?: 0}")
    setMeasuredDimension(width, finalHeight)

    // Report content size change to React if height changed significantly
    if (contentHeight != lastReportedHeight && contentHeight > 0) {
      lastReportedHeight = contentHeight
      // Convert pixels to dp for React Native (which expects dp values)
      val density = context.resources.displayMetrics.density
      val widthDp = width / density
      val heightDp = contentHeight / density
      // Post to avoid calling during measure
      post {
        onContentSizeChange(mapOf(
          "width" to widthDp,
          "height" to heightDp
        ))
      }
    }
  }

  override fun onLayout(changed: Boolean, l: Int, t: Int, r: Int, b: Int) {
    val width = r - l
    val height = b - t
    // Ensure child is measured before layout
    if (textView.measuredWidth != width || textView.measuredHeight != height) {
      val childWidthSpec = MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY)
      val childHeightSpec = MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY)
      textView.measure(childWidthSpec, childHeightSpec)
    }
    // Layout the TextView to fill the entire view
    textView.layout(0, 0, width, height)
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
    // Enable text selection first - this sets up the selection mechanism
    textView.setTextIsSelectable(true)
    textView.isFocusable = true
    textView.isFocusableInTouchMode = true

    // Use ActionMode.Callback2 for API 23+ to support floating toolbar
    val callback = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      object : ActionMode.Callback2() {
        override fun onCreateActionMode(mode: ActionMode?, menu: Menu?): Boolean {
          android.util.Log.d("SelectableText", "Callback2.onCreateActionMode - creating custom menu")
          textView.performHapticFeedback(HapticFeedbackConstants.LONG_PRESS)
          menu?.clear()
          // Explicitly remove system defaults
          menu?.removeItem(android.R.id.selectAll)
          menu?.removeItem(android.R.id.cut)
          menu?.removeItem(android.R.id.copy)
          menu?.removeItem(android.R.id.paste)
          // Add our custom items
          menu?.add(0, MENU_COPY, 0, "Copy")
          menu?.add(0, MENU_SHARE, 1, "Share")
          menu?.add(0, MENU_NOTE, 2, "Note")
          menu?.add(0, MENU_HIGHLIGHT, 3, "Highlight")
          menu?.add(0, MENU_BOOKMARK, 4, "Bookmark")
          android.util.Log.d("SelectableText", "Custom menu: Copy, Share, Note, Highlight, Bookmark added")
          return true
        }

        override fun onPrepareActionMode(mode: ActionMode?, menu: Menu?): Boolean = true

        override fun onActionItemClicked(mode: ActionMode?, item: MenuItem?): Boolean {
          textView.performHapticFeedback(HapticFeedbackConstants.CONTEXT_CLICK)
          return handleActionClick(item, mode)
        }

        override fun onDestroyActionMode(mode: ActionMode?) {}

        override fun onGetContentRect(mode: ActionMode?, view: View?, outRect: Rect?) {
          // Position the floating toolbar near the selection (covers full selection range)
          if (outRect != null && view != null) {
            val selStart = textView.selectionStart
            val selEnd = textView.selectionEnd
            if (selStart >= 0 && selEnd > selStart) {
              val layout = textView.layout
              if (layout != null) {
                val startLine = layout.getLineForOffset(selStart)
                val endLine = layout.getLineForOffset(selEnd)
                val top = layout.getLineTop(startLine)
                val bottom = layout.getLineBottom(endLine)
                outRect.set(0, top, view.width, bottom)
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
          // Explicitly remove system defaults
          menu?.removeItem(android.R.id.selectAll)
          menu?.removeItem(android.R.id.cut)
          menu?.removeItem(android.R.id.copy)
          menu?.removeItem(android.R.id.paste)
          // Add our custom items
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

    // Set BOTH selection and insertion callbacks to prevent system menu fallback
    textView.customSelectionActionModeCallback = callback
    textView.customInsertionActionModeCallback = callback
    android.util.Log.d("SelectableText", "Custom callbacks set - both selection and insertion")
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

    sendAction(action, selectedText, start, end)
    mode?.finish()
    return true
  }

  fun setText(text: String) {
    android.util.Log.d("SelectableText", "setText called with length: ${text.length}, first 50 chars: ${text.take(50)}")
    currentText = text
    applyStyledText()
    // Request layout update for Fabric - synchronous to ensure measurement happens with text
    requestLayout()
    invalidate()
  }

  private fun applyStyledText() {
    // Build styled text with spannable for colors and highlights
    val spannable = SpannableStringBuilder(currentText)

    // Apply verse number colors if set
    val color = verseNumberColor
    if (color != null) {
      var i = 0
      while (i < currentText.length) {
        // Find runs of superscript characters (verse numbers)
        if (currentText[i] in superscriptChars) {
          val start = i
          while (i < currentText.length && currentText[i] in superscriptChars) {
            i++
          }
          // Apply verse number color to this span
          spannable.setSpan(
            ForegroundColorSpan(color),
            start,
            i,
            Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
          )
        } else {
          i++
        }
      }
    }

    // Apply background colors for highlight ranges
    applyHighlights(spannable)

    // Apply first-line indent for poetry (only first line indented, wrapped lines at left margin)
    // This is the legacy single-value indent
    if (indentPx > 0 && lineIndents.isEmpty()) {
      spannable.setSpan(
        LeadingMarginSpan.Standard(indentPx, 0),
        0,
        spannable.length,
        Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
      )
    }

    // Apply per-line indents for flattened poetry (overrides single indent if provided)
    if (lineIndents.isNotEmpty()) {
      applyLineIndents(spannable)
    }

    textView.text = spannable
  }

  /**
   * Apply per-line LeadingMarginSpans for flattened poetry
   * Each line gets its own indent based on the lineIndents array
   */
  private fun applyLineIndents(spannable: SpannableStringBuilder) {
    for (indentInfo in lineIndents) {
      val startIndex = (indentInfo["startIndex"] as? Number)?.toInt() ?: continue
      val endIndex = (indentInfo["endIndex"] as? Number)?.toInt() ?: continue
      val indentDp = (indentInfo["indent"] as? Number)?.toFloat() ?: 0f

      // Convert dp to pixels
      val indentPxValue = if (indentDp > 0) {
        TypedValue.applyDimension(
          TypedValue.COMPLEX_UNIT_DIP,
          indentDp,
          context.resources.displayMetrics
        ).toInt()
      } else {
        0
      }

      // Validate and clamp range
      val length = spannable.length
      val clampedStart = maxOf(0, minOf(startIndex, length))
      val clampedEnd = maxOf(clampedStart, minOf(endIndex, length))

      if (clampedEnd > clampedStart) {
        spannable.setSpan(
          LeadingMarginSpan.Standard(indentPxValue, 0),
          clampedStart,
          clampedEnd,
          Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
        )
      }
    }
  }

  /**
   * Apply background colors for persisted verse highlights
   */
  private fun applyHighlights(spannable: SpannableStringBuilder) {
    for (highlight in highlights) {
      val startIndex = (highlight["startIndex"] as? Number)?.toInt() ?: continue
      val endIndex = (highlight["endIndex"] as? Number)?.toInt() ?: continue
      val colorHex = highlight["color"] as? String ?: continue

      val bgColor = try {
        Color.parseColor(colorHex)
      } catch (_: Exception) {
        continue
      }

      // Validate and clamp range
      val length = spannable.length
      val clampedStart = maxOf(0, minOf(startIndex, length))
      val clampedEnd = maxOf(clampedStart, minOf(endIndex, length))

      if (clampedEnd > clampedStart) {
        spannable.setSpan(
          BackgroundColorSpan(bgColor),
          clampedStart,
          clampedEnd,
          Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
        )
      }
    }
  }

  fun setVerseId(id: Int?) {
    this.verseId = id
  }

  fun setFontSize(size: Float) {
    legacyFontSize = size
    if (styleSpec == null) {
      textView.setTextSize(TypedValue.COMPLEX_UNIT_SP, size)
    }
  }

  fun setFontFamily(family: String?) {
    legacyFontFamily = family
    if (styleSpec != null) return
    textView.typeface = getTypefaceForFamily(family)
  }

  fun setTextColor(color: String?) {
    if (color == null) return
    try {
      legacyTextColor = Color.parseColor(color)
      if (styleSpec == null) {
        textView.setTextColor(legacyTextColor)
      }
    } catch (_: Exception) {}
  }

  fun setVerseNumberColor(color: String?) {
    if (color == null) {
      verseNumberColor = null
      return
    }
    try {
      val parsedColor = Color.parseColor(color)
      // Only apply if styleSpec doesn't provide verseNumberColor
      if (styleSpec == null || styleSpec?.get("verseNumberColor") == null) {
        verseNumberColor = parsedColor
        // Re-apply styled text if we already have text
        if (currentText.isNotEmpty()) {
          applyStyledText()
        }
      }
    } catch (_: Exception) {}
  }

  /**
   * Set character-range based highlights
   * Each highlight: { startIndex: Int, endIndex: Int, color: String (hex) }
   */
  fun setHighlights(newHighlights: List<Map<String, Any>>?) {
    highlights = newHighlights ?: emptyList()
    if (currentText.isNotEmpty()) {
      applyStyledText()
    }
  }

  /**
   * Set first-line indent for poetry (in dp) - legacy single value
   * Only the first line is indented; wrapped lines start at left margin
   */
  fun setIndent(indentDp: Float) {
    indentPx = if (indentDp > 0) {
      TypedValue.applyDimension(
        TypedValue.COMPLEX_UNIT_DIP,
        indentDp,
        context.resources.displayMetrics
      ).toInt()
    } else {
      0
    }
    if (currentText.isNotEmpty()) {
      applyStyledText()
    }
  }

  /**
   * Set per-line indents for flattened poetry
   * Each indent: { startIndex: Int, endIndex: Int, indent: Double (dp) }
   */
  fun setLineIndents(indents: List<Map<String, Any>>?) {
    lineIndents = indents ?: emptyList()
    if (currentText.isNotEmpty()) {
      applyStyledText()
    }
  }

  fun setLineHeight(absoluteLineHeight: Float) {
    legacyLineHeight = absoluteLineHeight
    if (styleSpec == null) {
      applyAbsoluteLineHeight(absoluteLineHeight)
    }
  }

  /**
   * Apply absolute line height (in SP) to match React Native's lineHeight behavior.
   * Android's setLineSpacing(extra, mult) works as: finalHeight = defaultHeight * mult + extra
   * React Native's lineHeight sets absolute height per line.
   * We calculate extra = desiredHeight - defaultHeight and use mult=1
   */
  private fun applyAbsoluteLineHeight(lineHeightSp: Float) {
    // Convert SP to pixels
    val lineHeightPx = TypedValue.applyDimension(
      TypedValue.COMPLEX_UNIT_SP,
      lineHeightSp,
      context.resources.displayMetrics
    )
    // Get font's default line height from font metrics
    val fontMetrics = textView.paint.fontMetrics
    val defaultLineHeight = fontMetrics.bottom - fontMetrics.top + fontMetrics.leading
    // Calculate extra spacing needed
    val extra = (lineHeightPx - defaultLineHeight).coerceAtLeast(0f)
    textView.setLineSpacing(extra, 1f)
  }

  // MARK: - StyleSpec Support

  fun setStyleSpec(spec: Map<String, Any>?) {
    styleSpec = spec
    applyStylesFromSpec()
  }

  private fun getProseStyle(): Map<String, Any>? {
    @Suppress("UNCHECKED_CAST")
    return styleSpec?.get("prose") as? Map<String, Any>
  }

  private fun getVerseNumberColorFromSpec(): Int? {
    val colorHex = styleSpec?.get("verseNumberColor") as? String ?: return null
    return try {
      Color.parseColor(colorHex)
    } catch (_: Exception) {
      null
    }
  }

  private fun getFontSizeFromSpec(): Float {
    val proseStyle = getProseStyle()
    return (proseStyle?.get("fontSize") as? Number)?.toFloat() ?: legacyFontSize
  }

  private fun getFontFamilyFromSpec(): String? {
    val proseStyle = getProseStyle()
    return proseStyle?.get("fontFamily") as? String ?: legacyFontFamily
  }

  private fun getTextColorFromSpec(): Int {
    val proseStyle = getProseStyle()
    val colorHex = proseStyle?.get("color") as? String
    return if (colorHex != null) {
      try {
        Color.parseColor(colorHex)
      } catch (_: Exception) {
        legacyTextColor
      }
    } else {
      legacyTextColor
    }
  }

  private fun getLineHeightFromSpec(): Float {
    val proseStyle = getProseStyle()
    return (proseStyle?.get("lineHeight") as? Number)?.toFloat() ?: legacyLineHeight
  }

  private fun applyStylesFromSpec() {
    // Apply font size
    val fontSize = getFontSizeFromSpec()
    textView.setTextSize(TypedValue.COMPLEX_UNIT_SP, fontSize)

    // Apply font family - map to Android typefaces
    val fontFamily = getFontFamilyFromSpec()
    textView.typeface = getTypefaceForFamily(fontFamily)

    // Apply text color
    val textColor = getTextColorFromSpec()
    textView.setTextColor(textColor)

    // Apply line height
    val lineHeight = getLineHeightFromSpec()
    textView.setLineSpacing(0f, lineHeight)

    // Update verse number color
    verseNumberColor = getVerseNumberColorFromSpec()

    // Re-apply styled text if we have content
    if (currentText.isNotEmpty()) {
      applyStyledText()
    }
  }

  /**
   * Map font family names to Android Typefaces
   * Custom fonts like Literata need to be loaded from assets;
   * fallback to built-in serif for Bible reading experience
   */
  private fun getTypefaceForFamily(fontFamily: String?): Typeface {
    if (fontFamily == null) return Typeface.DEFAULT

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

  private fun sendAction(action: String, selectedText: String, start: Int, end: Int) {
    val payload = mutableMapOf<String, Any>(
      "action" to action,
      "selectedText" to selectedText,
      "selectionStart" to start,
      "selectionEnd" to end
    )
    verseId?.let { payload["verseId"] = it }
    onAction(payload)
  }
}
