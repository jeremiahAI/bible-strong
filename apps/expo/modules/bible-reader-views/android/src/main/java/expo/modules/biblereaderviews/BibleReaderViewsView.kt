package expo.modules.biblereaderviews

import android.content.Context
import android.graphics.Color
import android.util.Log
import android.view.Choreographer
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import org.json.JSONArray
import org.json.JSONObject

private const val TYPE_TITLE = 0
private const val TYPE_COLUMNS = 1
private const val TYPE_INTERLINEAR = 2
private const val PAYLOAD_DECORATIONS = "decorations"

private class VerseSlot(val position: Int, val column: Int)

class BibleReaderViewsView(context: Context, appContext: AppContext) :
  ExpoView(context, appContext), ReaderHost {
  override val shouldUseAndroidLayout = true

  private val onReaderEvent by EventDispatcher<Map<String, Any?>>()
  private val density = resources.displayMetrics.density

  private var rows: List<Row> = emptyList()
  private var verseSlots = HashMap<String, VerseSlot>()
  private var fixture: String? = null
  private var firstTextPending = true
  private val pendingDecorations = HashSet<String>()
  private var pendingCommand: JSONObject? = null
  private var lastSeq = Long.MIN_VALUE

  private val layoutManager = LinearLayoutManager(context)
  private val adapter = Adapter()
  private val recycler =
    RecyclerView(context).apply {
      layoutManager = this@BibleReaderViewsView.layoutManager
      adapter = this@BibleReaderViewsView.adapter
      itemAnimator = null
      overScrollMode = OVER_SCROLL_NEVER
      setItemViewCacheSize(4)
    }

  init {
    addView(recycler, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
    recycler.addOnLayoutChangeListener { _, l, _, r, _, _, _, _, _ ->
      if (r - l > 0) tryFlushCommand()
    }
  }

  // --- ReaderHost -------------------------------------------------------------------------

  override fun emit(type: String, fields: Map<String, Any?>) {
    val payload = HashMap<String, Any?>(fields)
    payload["type"] = type
    payload["t"] = System.currentTimeMillis().toDouble()
    Log.i(BENCH_TAG, "event ${JSONObject(payload)}")
    onReaderEvent(payload)
  }

  override fun onRowDrawn(rowId: String, hasText: Boolean) {
    if (firstTextPending && hasText) {
      firstTextPending = false
      Choreographer.getInstance().postFrameCallback { emit("firstTextPainted") }
    }
    if (pendingDecorations.remove(rowId)) {
      Choreographer.getInstance().postFrameCallback {
        emit("decorationsPainted", mapOf("blockId" to rowId))
      }
    }
  }

  // --- props ------------------------------------------------------------------------------

  fun setDocumentJson(json: String) {
    val t0 = System.nanoTime()
    val doc = parseDocument(json)
    Log.i(
      BENCH_TAG,
      "parse fixture=${doc.fixture} bytes=${json.length} ms=%.2f".format((System.nanoTime() - t0) / 1e6),
    )
    if (doc.fixture != fixture) {
      fixture = doc.fixture
      firstTextPending = true
      LayoutStats.reset()
    }
    setBackgroundColor(doc.settings.theme["background"] ?: Color.WHITE)
    val previous = rows.associateBy { it.id }
    val next =
      doc.blocks.map { b ->
        val key = b.hash * 31 + doc.settings.hash
        val old = previous[b.id]
        if (old != null && old.key == key) old else buildRow(b, doc.settings, key)
      }
    val diff =
      DiffUtil.calculateDiff(
        object : DiffUtil.Callback() {
          override fun getOldListSize() = rows.size

          override fun getNewListSize() = next.size

          override fun areItemsTheSame(o: Int, n: Int) = rows[o].id == next[n].id

          override fun areContentsTheSame(o: Int, n: Int) = rows[o] === next[n]
        }
      )
    rows = next
    diff.dispatchUpdatesTo(adapter)
    indexVerses()
    recycler.post { tryFlushCommand() }
  }

  fun setCommandJson(json: String?) {
    if (json == null) return
    val cmd = JSONObject(json)
    val seq = cmd.optLong("seq", Long.MAX_VALUE)
    if (cmd.has("seq") && seq <= lastSeq) return
    if (cmd.has("seq")) lastSeq = seq
    pendingCommand = cmd
    tryFlushCommand()
  }

  // --- model ------------------------------------------------------------------------------

  private fun buildRow(b: BlockData, s: Settings, key: Int): Row =
    when (b) {
      is TitleData -> TitleRow(b.id, key, b.text, b.level, s)
      is ParagraphData ->
        ColumnsRow(b.id, key, listOf(TextColumn(context, b.column, s, density)), s, density)
      is ParallelData ->
        ColumnsRow(b.id, key, b.columns.map { TextColumn(context, it, s, density) }, s, density)
      is InterlinearData -> InterlinearRow(b.id, key, b, s)
    }

  private fun indexVerses() {
    val slots = HashMap<String, VerseSlot>()
    rows.forEachIndexed { pos, row ->
      when (row) {
        is ColumnsRow ->
          row.columns.forEachIndexed { ci, col ->
            for (run in col.runs) run.verseKey?.let { slots.putIfAbsent(it, VerseSlot(pos, ci)) }
          }
        is InterlinearRow -> slots.putIfAbsent(row.data.verseKey, VerseSlot(pos, 0))
        is TitleRow -> {}
      }
    }
    verseSlots = slots
  }

  // --- commands ---------------------------------------------------------------------------

  private fun tryFlushCommand() {
    val cmd = pendingCommand ?: return
    if (recycler.width == 0 || rows.isEmpty()) return
    pendingCommand = null
    when (cmd.getString("type")) {
      "scrollToVerse" -> scrollToVerse(cmd.getString("verseKey"))
      "setDecorations" ->
        setDecorations(cmd.getString("blockId"), parseDecorations(cmd.optJSONArray("decorations")))
    }
  }

  private fun scrollToVerse(verseKey: String) {
    val slot = verseSlots[verseKey]
    if (slot == null) {
      Log.w(BENCH_TAG, "scrollToVerse: unknown verse $verseKey")
      return
    }
    val row = rows[slot.position]
    val y =
      if (row is ColumnsRow) {
        row.columns[slot.column].verseTop(verseKey, row.columnWidth(recycler.width))
      } else 0
    layoutManager.scrollToPositionWithOffset(slot.position, -y)
    recycler.requestLayout()
    // The first callback runs before the traversal that lays out and draws the new position, the
    // second one after it.
    val choreographer = Choreographer.getInstance()
    choreographer.postFrameCallback {
      choreographer.postFrameCallback { emit("scrolledToVerse", mapOf("verseKey" to verseKey)) }
    }
  }

  private fun setDecorations(blockId: String, decorations: List<Decoration>) {
    val pos = rows.indexOfFirst { it.id == blockId }
    val row = rows.getOrNull(pos) as? ColumnsRow
    if (row == null) {
      Log.w(BENCH_TAG, "setDecorations: no text block $blockId")
      return
    }
    row.columns[0].setDecorations(decorations)
    pendingDecorations.add(blockId)
    adapter.notifyItemChanged(pos, PAYLOAD_DECORATIONS)
    // A row that is not on screen never draws; report it from the next frame anyway.
    postDelayed(
      {
        if (pendingDecorations.remove(blockId)) {
          Choreographer.getInstance().postFrameCallback {
            emit("decorationsPainted", mapOf("blockId" to blockId))
          }
        }
      },
      150,
    )
  }

  // --- adapter ----------------------------------------------------------------------------

  private class Holder(view: View) : RecyclerView.ViewHolder(view)

  private inner class Adapter : RecyclerView.Adapter<Holder>() {
    init {
      setHasStableIds(true)
    }

    override fun getItemCount() = rows.size

    override fun getItemId(position: Int) = rows[position].stableId

    override fun getItemViewType(position: Int) =
      when (rows[position]) {
        is TitleRow -> TYPE_TITLE
        is ColumnsRow -> TYPE_COLUMNS
        is InterlinearRow -> TYPE_INTERLINEAR
      }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): Holder {
      val view: View =
        when (viewType) {
          TYPE_TITLE -> TextView(context)
          TYPE_COLUMNS -> ColumnsView(context, this@BibleReaderViewsView)
          else -> InterlinearView(context, this@BibleReaderViewsView)
        }
      view.layoutParams =
        RecyclerView.LayoutParams(
          RecyclerView.LayoutParams.MATCH_PARENT,
          RecyclerView.LayoutParams.WRAP_CONTENT,
        )
      return Holder(view)
    }

    override fun onBindViewHolder(holder: Holder, position: Int) {
      when (val row = rows[position]) {
        is TitleRow -> bindTitle(holder.itemView as TextView, row)
        is ColumnsRow -> (holder.itemView as ColumnsView).bind(row)
        is InterlinearRow -> (holder.itemView as InterlinearView).bind(row)
      }
    }

    // Decoration changes redraw only the affected row; nothing is re-measured or re-laid-out.
    override fun onBindViewHolder(holder: Holder, position: Int, payloads: MutableList<Any>) {
      if (payloads.contains(PAYLOAD_DECORATIONS) && holder.itemView is ColumnsView) {
        (holder.itemView as ColumnsView).redraw()
      } else {
        onBindViewHolder(holder, position)
      }
    }
  }

  private fun bindTitle(view: TextView, row: TitleRow) {
    val s = row.settings
    val hp = (s.horizontalPaddingDp * density).toInt()
    view.text = row.text
    view.typeface = ReaderFonts.styled(ReaderFonts.base(context, s.fontFamily), s.fontFamily, 700, false)
    view.setTextSize(
      android.util.TypedValue.COMPLEX_UNIT_PX,
      s.fontSizeDp * density * (if (row.level == 1) 1.4f else 1.0f),
    )
    view.setTextColor(s.color("text"))
    view.setPadding(hp, (14 * density).toInt(), hp, (8 * density).toInt())
  }
}
