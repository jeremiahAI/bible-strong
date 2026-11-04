package expo.modules.biblereaderviews

// SPIKE: row models held by the RecyclerView adapter. Stable id per block; `key` changes only when
// the block JSON or the settings change, so DiffUtil leaves untouched rows (and their cached
// StaticLayouts) alone.
sealed class Row(val id: String, val key: Int) {
  val stableId: Long = id.hashCode().toLong()
}

class TitleRow(id: String, key: Int, val text: String, val level: Int, val settings: Settings) :
  Row(id, key)

class ColumnsRow(
  id: String,
  key: Int,
  val columns: List<TextColumn>,
  val settings: Settings,
  val density: Float,
) : Row(id, key) {
  val horizontalPaddingPx = (settings.horizontalPaddingDp * density).toInt()
  val gapPx = (16 * density).toInt()
  val spacingPx = (settings.paragraphSpacingDp * density).toInt()

  fun columnWidth(totalWidth: Int): Int =
    ((totalWidth - 2 * horizontalPaddingPx - gapPx * (columns.size - 1)) / columns.size)
      .coerceAtLeast(1)

  fun columnX(index: Int, totalWidth: Int): Int =
    horizontalPaddingPx + index * (columnWidth(totalWidth) + gapPx)

  fun heightFor(totalWidth: Int): Int {
    val w = columnWidth(totalWidth)
    return columns.maxOf { it.layoutFor(w).height } + spacingPx
  }

  val plainText: String get() = columns.joinToString("\n") { it.text }
}

class InterlinearRow(
  id: String,
  key: Int,
  val data: InterlinearData,
  val settings: Settings,
) : Row(id, key)
