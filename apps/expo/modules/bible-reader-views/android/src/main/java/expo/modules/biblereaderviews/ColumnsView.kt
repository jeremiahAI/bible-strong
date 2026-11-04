package expo.modules.biblereaderviews

import android.content.Context
import android.graphics.Canvas
import android.view.GestureDetector
import android.view.MotionEvent
import android.view.View

interface ReaderHost {
  fun emit(type: String, fields: Map<String, Any?> = emptyMap())

  fun onRowDrawn(rowId: String, hasText: Boolean)
}

private fun WordRef.toMap() = mapOf("verseKey" to verseKey, "wordIndex" to wordIndex)

/** A paragraph (one column) or a parallel verse row (several columns side by side). */
class ColumnsView(context: Context, private val host: ReaderHost) : View(context) {
  private var row: ColumnsRow? = null

  private enum class Drag {
    NONE,
    EXTEND,
    HANDLE,
  }

  private var drag = Drag.NONE
  private var dragColumn = -1
  private var anchorRun = -1

  private val gestures =
    GestureDetector(
      context,
      object : GestureDetector.SimpleOnGestureListener() {
        override fun onDown(e: MotionEvent) = true

        override fun onSingleTapUp(e: MotionEvent): Boolean {
          handleTap(e.x, e.y)
          return true
        }

        override fun onLongPress(e: MotionEvent) = startSelection(e.x, e.y)
      },
    )

  fun bind(next: ColumnsRow) {
    row = next
    drag = Drag.NONE
    contentDescription = next.plainText
    importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_YES
    requestLayout()
    invalidate()
  }

  fun redraw() = invalidate()

  override fun onMeasure(widthSpec: Int, heightSpec: Int) {
    val w = MeasureSpec.getSize(widthSpec)
    val r = row
    setMeasuredDimension(w, if (r == null) 0 else r.heightFor(w))
  }

  override fun onDraw(canvas: Canvas) {
    val r = row ?: return
    val w = width
    val cw = r.columnWidth(w)
    r.columns.forEachIndexed { i, col ->
      col.layoutFor(cw)
      canvas.save()
      canvas.translate(r.columnX(i, w).toFloat(), 0f)
      col.draw(canvas, cw)
      canvas.restore()
    }
    host.onRowDrawn(r.id, r.columns.any { it.text.isNotEmpty() })
  }

  private fun columnAt(x: Float): Int {
    val r = row ?: return -1
    val w = width
    var best = 0
    for (i in r.columns.indices) if (x >= r.columnX(i, w)) best = i
    return best
  }

  private fun local(col: Int, x: Float): Float = x - row!!.columnX(col, width)

  private fun handleTap(x: Float, y: Float) {
    val r = row ?: return
    val ci = columnAt(x)
    if (ci < 0) return
    val col = r.columns[ci]
    if (r.columns.any { it.hasSelection }) {
      r.columns.forEach { it.clearSelection() }
      invalidate()
    }
    val ri = col.runAt(local(ci, x), y, r.columnWidth(width))
    if (ri < 0) return
    val run = col.runs[ri]
    if (run.isWord) host.emit("wordTap", col.wordRef(ri).toMap())
    run.verseKey?.let { host.emit("verseTap", mapOf("verseKey" to it)) }
  }

  private fun startSelection(x: Float, y: Float) {
    val r = row ?: return
    val ci = columnAt(x)
    val cw = r.columnWidth(width)
    val col = r.columns[ci]
    val lx = local(ci, x)
    var run = col.runAt(lx, y, cw)
    if (run < 0 || !col.runs[run].isWord) run = col.nearestWord(lx, y, cw)
    if (run < 0) return
    r.columns.forEach { it.clearSelection() }
    col.setSelection(run, run)
    drag = Drag.EXTEND
    dragColumn = ci
    anchorRun = run
    parent?.requestDisallowInterceptTouchEvent(true)
    invalidate()
    emitSelection(col)
  }

  private fun emitSelection(col: TextColumn) {
    host.emit(
      "selectionChanged",
      mapOf("start" to col.wordRef(col.selA).toMap(), "end" to col.wordRef(col.selB).toMap()),
    )
  }

  private fun updateDrag(x: Float, y: Float) {
    val r = row ?: return
    val col = r.columns[dragColumn]
    val run = col.nearestWord(local(dragColumn, x), y, r.columnWidth(width))
    if (run < 0) return
    val beforeA = col.selA
    val beforeB = col.selB
    col.setSelection(anchorRun, run)
    if (col.selA != beforeA || col.selB != beforeB) {
      invalidate()
      emitSelection(col)
    }
  }

  override fun onTouchEvent(e: MotionEvent): Boolean {
    val r = row ?: return false
    when (e.actionMasked) {
      MotionEvent.ACTION_DOWN -> {
        drag = Drag.NONE
        for (i in r.columns.indices) {
          val h = r.columns[i].handleAt(local(i, e.x), e.y, r.columnWidth(width))
          if (h >= 0) {
            val col = r.columns[i]
            drag = Drag.HANDLE
            dragColumn = i
            anchorRun = if (h == 0) col.selB else col.selA
            parent?.requestDisallowInterceptTouchEvent(true)
            return true
          }
        }
      }
      MotionEvent.ACTION_MOVE ->
        if (drag != Drag.NONE) {
          parent?.requestDisallowInterceptTouchEvent(true)
          updateDrag(e.x, e.y)
          return true
        }
      MotionEvent.ACTION_UP,
      MotionEvent.ACTION_CANCEL ->
        if (drag != Drag.NONE) {
          drag = Drag.NONE
          return true
        }
    }
    gestures.onTouchEvent(e)
    return true
  }
}
