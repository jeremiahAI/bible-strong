package expo.modules.biblereaderviews

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.Typeface
import android.text.SpannableStringBuilder
import android.text.Spanned
import android.text.StaticLayout
import android.text.TextDirectionHeuristics
import android.text.TextPaint
import android.text.style.LineHeightSpan
import android.text.style.MetricAffectingSpan

class WordRef(val verseKey: String, val wordIndex: Int)

// One styled run (or several merged runs with identical style) of a column's text.
private class RunSpan(
  val color: Int,
  val typeface: Typeface,
  val scale: Float,
  val superscript: Boolean,
) : MetricAffectingSpan() {
  override fun updateDrawState(ds: TextPaint) {
    apply(ds)
    ds.color = color
  }

  override fun updateMeasureState(ds: TextPaint) = apply(ds)

  private fun apply(ds: TextPaint) {
    val base = ds.textSize
    ds.typeface = typeface
    ds.textSize = base * scale
    if (superscript) ds.baselineShift -= (base * 0.38f).toInt()
  }
}

// CSS-style line height: the glyph box is centred in a fixed-height line.
private class FixedLineHeight(val ascent: Int, val descent: Int) : LineHeightSpan {
  override fun chooseHeight(
    text: CharSequence,
    start: Int,
    end: Int,
    spanstartv: Int,
    lineHeight: Int,
    fm: Paint.FontMetricsInt,
  ) {
    fm.ascent = ascent
    fm.top = ascent
    fm.descent = descent
    fm.bottom = descent
  }
}

private class Geometry(
  val fills: List<Pair<Decoration, List<RectF>>>,
  val strokes: List<Pair<Decoration, List<RectF>>>,
)

private class Laid(val layout: StaticLayout) {
  var geometry: Geometry? = null
  var selectionRects: List<RectF>? = null
}

/** Text of one paragraph or one parallel column: spans, cached layouts, decorations, selection. */
class TextColumn(context: Context, data: ColumnData, val settings: Settings, val density: Float) {
  val runs: List<Run> = data.runs
  val rtl = data.dir == "rtl"
  var decorations: List<Decoration> = data.decorations
    private set

  val runStarts = IntArray(runs.size + 1)
  val text: String
  private val wordRuns: IntArray

  private val baseTypeface = ReaderFonts.base(context, settings.fontFamily)
  private val paint =
    TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
      typeface = baseTypeface
      textSize = settings.fontSizeDp * this@TextColumn.density
      color = settings.color("text")
    }
  private val ascent: Int
  private val descent: Int
  val lineHeightPx: Int
  val glyphBoxTrim: Float

  private val laids = HashMap<Int, Laid>()
  private var current: Laid? = null

  private val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG)
  private val strokePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE }
  private val handlePaint = Paint(Paint.ANTI_ALIAS_FLAG)
  private val scratchPath = Path()
  private val scratchRect = RectF()

  var selA = -1
    private set
  var selB = -1
    private set
  val hasSelection get() = selA >= 0

  init {
    val sb = StringBuilder()
    val words = ArrayList<Int>()
    runs.forEachIndexed { i, r ->
      runStarts[i] = sb.length
      sb.append(r.text)
      if (r.isWord) words.add(i)
    }
    runStarts[runs.size] = sb.length
    text = sb.toString()
    wordRuns = words.toIntArray()
    val fm = paint.fontMetricsInt
    val have = fm.descent - fm.ascent
    lineHeightPx = Math.round(settings.lineHeight * settings.fontSizeDp * density)
    val extra = lineHeightPx - have
    ascent = fm.ascent - extra / 2
    descent = ascent + lineHeightPx
    glyphBoxTrim = ((lineHeightPx - have) / 2f).coerceAtLeast(0f)
  }

  private val spannable: SpannableStringBuilder by lazy {
    val sb = SpannableStringBuilder(text)
    var i = 0
    while (i < runs.size) {
      var j = i + 1
      while (j < runs.size && runs[j].styleKey == runs[i].styleKey) j++
      val r = runs[i]
      if (runStarts[j] > runStarts[i]) {
        val tf =
          if (r.weight == 400 && !r.italic) baseTypeface
          else ReaderFonts.styled(baseTypeface, settings.fontFamily, r.weight, r.italic)
        sb.setSpan(
          RunSpan(settings.color(r.color), tf, r.sizeScale, r.superscript),
          runStarts[i],
          runStarts[j],
          Spanned.SPAN_EXCLUSIVE_EXCLUSIVE,
        )
      }
      i = j
    }
    sb.setSpan(FixedLineHeight(ascent, descent), 0, text.length, Spanned.SPAN_INCLUSIVE_INCLUSIVE)
    sb
  }

  fun layoutFor(width: Int): StaticLayout {
    val w = width.coerceAtLeast(1)
    laids[w]?.let {
      current = it
      return it.layout
    }
    val t0 = System.nanoTime()
    val l =
      StaticLayout.Builder.obtain(spannable, 0, text.length, paint, w)
        .setAlignment(android.text.Layout.Alignment.ALIGN_NORMAL)
        .setTextDirection(if (rtl) TextDirectionHeuristics.RTL else TextDirectionHeuristics.LTR)
        .setIncludePad(false)
        .setBreakStrategy(android.text.Layout.BREAK_STRATEGY_SIMPLE)
        .setHyphenationFrequency(android.text.Layout.HYPHENATION_FREQUENCY_NONE)
        .build()
    LayoutStats.record((System.nanoTime() - t0) / 1e6, "chars=${text.length} w=$w size=${paint.textSize} density=$density lh=$lineHeightPx")
    val laid = Laid(l)
    laids[w] = laid
    current = laid
    return l
  }

  fun setDecorations(next: List<Decoration>) {
    decorations = next
    laids.values.forEach { it.geometry = null }
  }

  fun verseOffset(verseKey: String): Int {
    val i = runs.indexOfFirst { it.verseKey == verseKey }
    return if (i < 0) -1 else runStarts[i]
  }

  fun verseTop(verseKey: String, width: Int): Int {
    val off = verseOffset(verseKey)
    if (off < 0) return 0
    val l = layoutFor(width)
    return l.getLineTop(l.getLineForOffset(off))
  }

  fun runIndexAt(offset: Int): Int {
    if (runs.isEmpty()) return -1
    var lo = 0
    var hi = runs.size - 1
    val o = offset.coerceIn(0, (text.length - 1).coerceAtLeast(0))
    while (lo < hi) {
      val mid = (lo + hi + 1) ushr 1
      if (runStarts[mid] <= o) lo = mid else hi = mid - 1
    }
    return lo
  }

  /** Tight glyph-box rectangles of [start, end), one per line, via Layout.getSelectionPath. */
  private fun lineRects(l: StaticLayout, start: Int, end: Int): List<RectF> {
    if (end <= start) return emptyList()
    val out = ArrayList<RectF>()
    val first = l.getLineForOffset(start)
    val last = l.getLineForOffset(end - 1)
    for (line in first..last) {
      val s = maxOf(start, l.getLineStart(line))
      var e = minOf(end, l.getLineEnd(line))
      while (e > s && text[e - 1].isWhitespace()) e--
      if (e <= s) continue
      scratchPath.reset()
      l.getSelectionPath(s, e, scratchPath)
      scratchPath.computeBounds(scratchRect, true)
      val baseline = l.getLineBaseline(line)
      out.add(
        RectF(
          scratchRect.left,
          (baseline + paint.fontMetrics.ascent),
          scratchRect.right,
          (baseline + paint.fontMetrics.descent),
        )
      )
    }
    return out
  }

  private fun geometry(laid: Laid): Geometry {
    laid.geometry?.let {
      return it
    }
    val fills = ArrayList<Pair<Decoration, List<RectF>>>()
    val strokes = ArrayList<Pair<Decoration, List<RectF>>>()
    for (d in decorations) {
      val start = d.start.coerceIn(0, text.length)
      val end = d.end.coerceIn(0, text.length)
      val rects = lineRects(laid.layout, start, end)
      if (d.kind == "underline" || d.kind == "circle") strokes.add(d to rects)
      else fills.add(d to rects)
    }
    return Geometry(fills, strokes).also { laid.geometry = it }
  }

  private fun selectionRects(laid: Laid): List<RectF> {
    laid.selectionRects?.let {
      return it
    }
    val rects =
      if (selA < 0) emptyList() else lineRects(laid.layout, runStarts[selA], runStarts[selB + 1])
    laid.selectionRects = rects
    return rects
  }

  fun draw(canvas: Canvas, width: Int) {
    val laid = laids[width] ?: return
    val l = laid.layout
    val geo = geometry(laid)
    val clip = canvas.clipBounds
    val corner = 3f * density
    for ((d, rects) in geo.fills) {
      fillPaint.color = d.color
      for (r in rects) {
        if (r.bottom < clip.top || r.top > clip.bottom) continue
        canvas.drawRoundRect(r, corner, corner, fillPaint)
      }
    }
    if (selA >= 0) {
      fillPaint.color = settings.color("selection")
      for (r in selectionRects(laid)) canvas.drawRoundRect(r, corner, corner, fillPaint)
    }
    l.draw(canvas)
    strokePaint.strokeCap = Paint.Cap.ROUND
    for ((d, rects) in geo.strokes) {
      strokePaint.color = d.color
      for (r in rects) {
        if (r.bottom + 8 * density < clip.top || r.top - 8 * density > clip.bottom) continue
        if (d.kind == "underline") {
          strokePaint.strokeWidth = 2f * density
          val y = r.bottom + 1.5f * density
          canvas.drawLine(r.left, y, r.right, y, strokePaint)
        } else {
          strokePaint.strokeWidth = 1.6f * density
          val pad = 3f * density
          val rr = RectF(r.left - pad, r.top - pad / 2, r.right + pad, r.bottom + pad / 2)
          canvas.drawRoundRect(rr, rr.height() / 2, rr.height() / 2, strokePaint)
        }
      }
    }
    if (selA >= 0) {
      handlePaint.color = settings.color("accent")
      strokePaint.color = settings.color("accent")
      strokePaint.strokeWidth = 2f * density
      val (sx, sy) = handleStart(laid)
      val (ex, ey) = handleEnd(laid)
      val radius = 7f * density
      canvas.drawLine(sx, sy, sx, sy + radius, strokePaint)
      canvas.drawCircle(sx, sy + radius * 1.6f, radius, handlePaint)
      canvas.drawLine(ex, ey, ex, ey + radius, strokePaint)
      canvas.drawCircle(ex, ey + radius * 1.6f, radius, handlePaint)
    }
  }

  private fun handleStart(laid: Laid): Pair<Float, Float> {
    val l = laid.layout
    val off = runStarts[selA]
    val line = l.getLineForOffset(off)
    return l.getPrimaryHorizontal(off) to (l.getLineBaseline(line) + paint.fontMetrics.descent)
  }

  private fun handleEnd(laid: Laid): Pair<Float, Float> {
    val l = laid.layout
    val off = runStarts[selB + 1]
    val line = l.getLineForOffset(off - 1)
    return l.getPrimaryHorizontal(off) to (l.getLineBaseline(line) + paint.fontMetrics.descent)
  }

  /** 0 = start handle, 1 = end handle, -1 = neither, for a touch at column-local (x, y). */
  fun handleAt(x: Float, y: Float, width: Int): Int {
    if (selA < 0) return -1
    val laid = laids[width] ?: return -1
    val reach = 26f * density
    val r = 7f * density * 1.6f
    val (sx, sy) = handleStart(laid)
    val (ex, ey) = handleEnd(laid)
    val ds = Math.hypot((x - sx).toDouble(), (y - (sy + r)).toDouble())
    val de = Math.hypot((x - ex).toDouble(), (y - (ey + r)).toDouble())
    return when {
      ds < reach && ds <= de -> 0
      de < reach -> 1
      else -> -1
    }
  }

  /** Run whose glyph box contains the column-local point, or -1. */
  fun runAt(x: Float, y: Float, width: Int): Int {
    if (runs.isEmpty()) return -1
    val l = layoutFor(width)
    if (y < 0 || y > l.height) return -1
    val line = l.getLineForVertical(y.toInt())
    val off = l.getOffsetForHorizontal(line, x)
    for (cand in intArrayOf(runIndexAt(off), runIndexAt(off - 1))) {
      if (cand < 0) continue
      val rects = lineRects(l, runStarts[cand], runStarts[cand + 1])
      if (rects.any { x >= it.left && x <= it.right && y >= it.top - glyphBoxTrim && y <= it.bottom + glyphBoxTrim }) {
        return cand
      }
    }
    return -1
  }

  /** Word run closest to the point; used while dragging a selection. */
  fun nearestWord(x: Float, y: Float, width: Int): Int {
    if (wordRuns.isEmpty()) return -1
    val l = layoutFor(width)
    val line = l.getLineForVertical(y.toInt().coerceIn(0, (l.height - 1).coerceAtLeast(0)))
    val off = l.getOffsetForHorizontal(line, x)
    val ri = runIndexAt(off)
    if (runs[ri].isWord) return ri
    var d = 1
    while (true) {
      val lo = ri - d
      val hi = ri + d
      if (lo >= 0 && runs[lo].isWord) return lo
      if (hi < runs.size && runs[hi].isWord) return hi
      if (lo < 0 && hi >= runs.size) return -1
      d++
    }
  }

  fun setSelection(a: Int, b: Int) {
    selA = minOf(a, b)
    selB = maxOf(a, b)
    laids.values.forEach { it.selectionRects = null }
  }

  fun clearSelection() {
    selA = -1
    selB = -1
    laids.values.forEach { it.selectionRects = null }
  }

  fun wordRef(runIndex: Int) = WordRef(runs[runIndex].verseKey!!, runs[runIndex].wordIndex)
}
