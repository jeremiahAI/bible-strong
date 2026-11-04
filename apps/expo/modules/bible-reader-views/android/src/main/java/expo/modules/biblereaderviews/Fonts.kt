package expo.modules.biblereaderviews

import android.content.Context
import android.graphics.Typeface
import android.os.Build
import android.util.Log

// SPIKE: same faces the WebView uses. 'Literata Book' is the bundled LiterataBook-Regular.otf that
// expo-font copies into the app's assets/fonts/; every other family (the default 'Avenir')
// falls back to the system sans, as the WebView CSS stack does on Android.
object ReaderFonts {
  private val bases = HashMap<String, Typeface>()
  private val styled = HashMap<String, Typeface>()

  fun base(context: Context, family: String): Typeface =
    synchronized(bases) {
      bases.getOrPut(family) {
        if (family == "Literata Book") {
          try {
            Typeface.createFromAsset(context.assets, "fonts/LiterataBook-Regular.otf")
          } catch (e: Exception) {
            Log.w(BENCH_TAG, "Literata Book asset missing, using serif", e)
            Typeface.SERIF
          }
        } else {
          Typeface.DEFAULT
        }
      }
    }

  fun styled(base: Typeface, family: String, weight: Int, italic: Boolean): Typeface =
    synchronized(styled) {
      styled.getOrPut("$family|$weight|$italic") {
        if (Build.VERSION.SDK_INT >= 28) {
          Typeface.create(base, weight, italic)
        } else {
          val style =
            when {
              weight >= 600 && italic -> Typeface.BOLD_ITALIC
              weight >= 600 -> Typeface.BOLD
              italic -> Typeface.ITALIC
              else -> Typeface.NORMAL
            }
          Typeface.create(base, style)
        }
      }
    }
}
