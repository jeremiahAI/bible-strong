package expo.modules.biblereaderviews

import android.graphics.Color
import org.json.JSONArray
import org.json.JSONObject

// SPIKE: parsed RenderDocument (see src/features/readerSpike/contract.ts).

class Settings(
  val theme: Map<String, Int>,
  val fontFamily: String,
  val fontSizeDp: Float,
  val lineHeight: Float,
  val paragraphSpacingDp: Float,
  val horizontalPaddingDp: Float,
  val hash: Int,
) {
  fun color(key: String?): Int = theme[key ?: "text"] ?: theme.getValue("text")
}

class Run(
  val text: String,
  val color: String?,
  val weight: Int,
  val italic: Boolean,
  val sizeScale: Float,
  val superscript: Boolean,
  val role: String,
  val verseKey: String?,
  val wordIndex: Int,
) {
  val styleKey: String get() = "$color|$weight|$italic|$sizeScale|$superscript"
  val isWord get() = role == "word" && wordIndex >= 0 && verseKey != null
}

class Decoration(val kind: String, val start: Int, val end: Int, val color: Int)

class InterlinearWord(
  val wordIndex: Int,
  val original: String,
  val transliteration: String?,
  val gloss: String?,
  val strong: String?,
)

class ColumnData(val dir: String, val runs: List<Run>, val decorations: List<Decoration>)

sealed class BlockData(val id: String, val hash: Int)
class TitleData(id: String, hash: Int, val text: String, val level: Int) : BlockData(id, hash)
class ParagraphData(id: String, hash: Int, val column: ColumnData) : BlockData(id, hash)
class InterlinearData(
  id: String,
  hash: Int,
  val verseKey: String,
  val dir: String,
  val words: List<InterlinearWord>,
) : BlockData(id, hash)
class ParallelData(id: String, hash: Int, val verseKey: String, val columns: List<ColumnData>) :
  BlockData(id, hash)

class DocumentData(val fixture: String, val settings: Settings, val blocks: List<BlockData>)

private fun JSONObject.optStringOrNull(key: String): String? =
  if (has(key) && !isNull(key)) getString(key) else null

fun parseDecorations(array: JSONArray?): List<Decoration> {
  if (array == null) return emptyList()
  return List(array.length()) { i ->
    val o = array.getJSONObject(i)
    val opacity = o.optDouble("opacity", 1.0)
    val rgb = Color.parseColor(o.getString("color"))
    val alpha = (opacity.coerceIn(0.0, 1.0) * 255).toInt()
    Decoration(
      o.getString("kind"),
      o.getInt("start"),
      o.getInt("end"),
      (rgb and 0x00FFFFFF) or (alpha shl 24),
    )
  }
}

private fun parseRuns(array: JSONArray): List<Run> =
  List(array.length()) { i ->
    val o = array.getJSONObject(i)
    val s = o.optJSONObject("style")
    Run(
      text = o.getString("text"),
      color = s?.optStringOrNull("color"),
      weight = s?.optInt("weight", 400) ?: 400,
      italic = s?.optBoolean("italic", false) ?: false,
      sizeScale = (s?.optDouble("sizeScale", 1.0) ?: 1.0).toFloat(),
      superscript = s?.optBoolean("superscript", false) ?: false,
      role = o.getString("role"),
      verseKey = o.optStringOrNull("verseKey"),
      wordIndex = if (o.has("wordIndex")) o.getInt("wordIndex") else -1,
    )
  }

private fun parseColumn(o: JSONObject) =
  ColumnData(
    o.getString("dir"),
    parseRuns(o.getJSONArray("runs")),
    parseDecorations(o.optJSONArray("decorations")),
  )

fun parseDocument(json: String): DocumentData {
  val root = JSONObject(json)
  val s = root.getJSONObject("settings")
  val themeJson = s.getJSONObject("theme")
  val theme = HashMap<String, Int>()
  for (key in themeJson.keys()) theme[key] = Color.parseColor(themeJson.getString(key))
  val settings =
    Settings(
      theme,
      s.getString("fontFamily"),
      s.getDouble("fontSizePx").toFloat(),
      s.getDouble("lineHeight").toFloat(),
      s.getDouble("paragraphSpacingPx").toFloat(),
      s.getDouble("horizontalPaddingPx").toFloat(),
      s.toString().hashCode(),
    )
  val blocksJson = root.getJSONArray("blocks")
  val blocks =
    List(blocksJson.length()) { i ->
      val b = blocksJson.getJSONObject(i)
      val id = b.getString("id")
      val hash = b.toString().hashCode()
      when (b.getString("kind")) {
        "title" -> TitleData(id, hash, b.getString("text"), b.optInt("level", 2))
        "paragraph" -> ParagraphData(id, hash, parseColumn(b))
        "interlinear" -> {
          val w = b.getJSONArray("words")
          InterlinearData(
            id,
            hash,
            b.getString("verseKey"),
            b.getString("dir"),
            List(w.length()) { j ->
              val o = w.getJSONObject(j)
              InterlinearWord(
                o.getInt("wordIndex"),
                o.getString("original"),
                o.optStringOrNull("transliteration"),
                o.optStringOrNull("gloss"),
                o.optStringOrNull("strong"),
              )
            },
          )
        }
        "parallel" -> {
          val c = b.getJSONArray("columns")
          ParallelData(
            id,
            hash,
            b.getString("verseKey"),
            List(c.length()) { j -> parseColumn(c.getJSONObject(j)) },
          )
        }
        else -> error("unknown block kind ${b.getString("kind")}")
      }
    }
  return DocumentData(root.getString("fixture"), settings, blocks)
}
