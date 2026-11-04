package expo.modules.biblereaderviews

import android.os.Handler
import android.os.Looper
import android.util.Log

const val BENCH_TAG = "READER_BENCH_VIEWS"

// Per-row StaticLayout build times, summarised to logcat shortly after the last build.
object LayoutStats {
  private val times = ArrayList<Double>()
  private val handler = Handler(Looper.getMainLooper())
  private val report = Runnable {
    if (times.isEmpty()) return@Runnable
    val min = times.min()
    val max = times.max()
    val avg = times.average()
    Log.i(
      BENCH_TAG,
      "layout rows=${times.size} minMs=%.2f avgMs=%.2f maxMs=%.2f".format(min, avg, max),
    )
  }

  fun record(ms: Double, label: String) {
    times.add(ms)
    Log.d(BENCH_TAG, "layout $label ms=%.2f".format(ms))
    handler.removeCallbacks(report)
    handler.postDelayed(report, 400)
  }

  fun reset() {
    times.clear()
  }
}
