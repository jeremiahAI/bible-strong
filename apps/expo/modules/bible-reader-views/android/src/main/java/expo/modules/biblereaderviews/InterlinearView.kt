package expo.modules.biblereaderviews

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import android.view.GestureDetector
import android.view.MotionEvent
import android.view.View

/** Word stacks (original / transliteration / gloss / Strong) flowed with wrapping, RTL aware. */
class InterlinearView(context: Context, private val host: ReaderHost) : View(context) {
  private var row: InterlinearRow? = null
  private val density = resources.displayMetrics.density

  private class Item(val word: InterlinearWord?, val label: String?, val rect: RectF)

  private var items: List<Item> = emptyList()
  private var laidWidth = -1
  private var contentHeight = 0
  private var slotHeights = FloatArray(4)

  private fun paintOf(size: Float, color: Int, face: Typeface, italic: Boolean = false) =
    Paint(Paint.ANTI_ALIAS_FLAG).apply {
      textSize = size
      this.color = color
      typeface = if (italic) Typeface.create(face, Typeface.ITALIC) else face
      textAlign = Paint.Align.CENTER
    }

  private lateinit var pOriginal: Paint
  private lateinit var pTranslit: Paint
  private lateinit var pGloss: Paint
  private lateinit var pStrong: Paint
  private lateinit var pVerse: Paint

  private val gestures =
    GestureDetector(
      context,
      object : GestureDetector.SimpleOnGestureListener() {
        override fun onDown(e: MotionEvent) = true

        override fun onSingleTapUp(e: MotionEvent): Boolean {
          val r = row ?: return true
          val hit = items.firstOrNull { it.word != null && it.rect.contains(e.x, e.y) } ?: return true
          host.emit(
            "wordTap",
            mapOf("verseKey" to r.data.verseKey, "wordIndex" to hit.word!!.wordIndex),
          )
          host.emit("verseTap", mapOf("verseKey" to r.data.verseKey))
          return true
        }
      },
    )

  fun bind(next: InterlinearRow) {
    row = next
    val s = next.settings
    val face = ReaderFonts.base(context, s.fontFamily)
    val f = s.fontSizeDp * density
    pOriginal = paintOf(f * 1.25f, s.color("text"), face)
    pTranslit = paintOf(f * 0.62f, s.color("secondaryText"), face, italic = true)
    pGloss = paintOf(f * 0.72f, s.color("text"), face)
    pStrong = paintOf(f * 0.6f, s.color("accent"), face)
    pVerse = paintOf(f * 0.74f, s.color("verseNumber"), face)
    val paints = arrayOf(pOriginal, pTranslit, pGloss, pStrong)
    slotHeights = FloatArray(4) { paints[it].fontMetrics.let { m -> m.descent - m.ascent } + 2 * density }
    contentDescription =
      next.data.words.joinToString(" ") { listOfNotNull(it.original, it.gloss).joinToString(" ") }
    importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_YES
    laidWidth = -1
    requestLayout()
    invalidate()
  }

  private fun layoutItems(width: Int) {
    val r = row ?: return
    if (width == laidWidth) return
    val hp = r.settings.horizontalPaddingDp * density
    val gap = 14 * density
    val avail = width - 2 * hp
    val stackH = slotHeights.sum()
    val rtl = r.data.dir == "rtl"
    val out = ArrayList<Item>()
    var cursor = 0f
    var top = 0f
    fun place(word: InterlinearWord?, label: String?, w: Float) {
      if (cursor > 0 && cursor + w > avail) {
        cursor = 0f
        top += stackH + 6 * density
      }
      val left = if (rtl) width - hp - cursor - w else hp + cursor
      out.add(Item(word, label, RectF(left, top, left + w, top + stackH)))
      cursor += w
    }
    place(null, r.data.verseKey.substringAfterLast('-'), pVerse.measureText(r.data.verseKey.substringAfterLast('-')) + gap / 2)
    for (w in r.data.words) {
      val widest =
        maxOf(
          pOriginal.measureText(w.original),
          w.transliteration?.let { pTranslit.measureText(it) } ?: 0f,
          w.gloss?.let { pGloss.measureText(it) } ?: 0f,
          w.strong?.let { pStrong.measureText(it) } ?: 0f,
        )
      place(w, null, widest + gap)
    }
    items = out
    contentHeight = (top + stackH + r.settings.paragraphSpacingDp * density).toInt()
    laidWidth = width
  }

  override fun onMeasure(widthSpec: Int, heightSpec: Int) {
    val w = MeasureSpec.getSize(widthSpec)
    val t0 = System.nanoTime()
    val before = laidWidth
    layoutItems(w)
    if (before != laidWidth) {
      LayoutStats.record((System.nanoTime() - t0) / 1e6, "interlinear words=${row?.data?.words?.size}")
    }
    setMeasuredDimension(w, contentHeight)
  }

  override fun onDraw(canvas: Canvas) {
    val r = row ?: return
    layoutItems(width)
    val paints = arrayOf(pOriginal, pTranslit, pGloss, pStrong)
    for (item in items) {
      val cx = item.rect.centerX()
      if (item.label != null) {
        canvas.drawText(item.label, cx, item.rect.top - pVerse.fontMetrics.ascent, pVerse)
        continue
      }
      val w = item.word ?: continue
      val texts = arrayOf(w.original, w.transliteration, w.gloss, w.strong)
      var y = item.rect.top
      for (i in 0 until 4) {
        texts[i]?.let { canvas.drawText(it, cx, y - paints[i].fontMetrics.ascent + density, paints[i]) }
        y += slotHeights[i]
      }
    }
    host.onRowDrawn(r.id, true)
  }

  override fun onTouchEvent(e: MotionEvent): Boolean {
    gestures.onTouchEvent(e)
    return true
  }
}
