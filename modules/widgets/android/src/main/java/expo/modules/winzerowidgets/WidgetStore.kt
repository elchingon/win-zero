package expo.modules.winzerowidgets

import android.content.Context
import java.io.File
import org.json.JSONObject

/** One goal as a widget shows it (src/plus/widget/snapshot.ts). */
data class WidgetGoal(
  val label: String,
  val state: String,
  val zeros: Int,
  val headline: String,
  val detail: String,
  val a11y: String,
  val url: String,
  val yes: String?,
)

data class WidgetFrame(val at: Long, val goals: List<WidgetGoal>)

data class WidgetSnapshot(val frames: List<WidgetFrame>, val emptyHeadline: String, val emptyDetail: String, val emptyUrl: String) {
  /** The frame for `now`, the first before any has started, or null with no goal. */
  fun frameAt(now: Long): WidgetFrame? = frames.lastOrNull { it.at <= now } ?: frames.firstOrNull()

  /** When the frame after `now` starts, or null after the last. */
  fun nextAfter(now: Long): Long? = frames.firstOrNull { it.at > now }?.at
}

/** The snapshot, kept whole in the app's files: written to a temporary file, then renamed over the last. */
object WidgetStore {
  private const val FILE = "winzeroplus-widget.json"

  fun write(context: Context, json: String) {
    val file = File(context.filesDir, FILE)
    val temp = File(context.filesDir, "$FILE.tmp")
    temp.writeText(json)
    if (!temp.renameTo(file)) {
      file.writeText(json)
      temp.delete()
    }
  }

  fun read(context: Context): WidgetSnapshot? =
    try {
      parse(File(context.filesDir, FILE).readText())
    } catch (e: Exception) {
      null
    }

  private fun parse(text: String): WidgetSnapshot {
    val root = JSONObject(text)
    val frames = root.getJSONArray("frames")
    val empty = root.getJSONObject("empty")
    return WidgetSnapshot(
      frames = List(frames.length()) { i ->
        val frame = frames.getJSONObject(i)
        val goals = frame.getJSONArray("goals")
        WidgetFrame(
          at = frame.getLong("at"),
          goals = List(goals.length()) { j ->
            val g = goals.getJSONObject(j)
            WidgetGoal(
              label = g.getString("label"),
              state = g.getString("state"),
              zeros = g.getInt("zeros"),
              headline = g.getString("headline"),
              detail = g.getString("detail"),
              a11y = g.getString("a11y"),
              url = g.getString("url"),
              yes = if (g.has("yes")) g.getString("yes") else null,
            )
          },
        )
      },
      emptyHeadline = empty.getString("headline"),
      emptyDetail = empty.getString("detail"),
      emptyUrl = empty.getString("url"),
    )
  }
}
