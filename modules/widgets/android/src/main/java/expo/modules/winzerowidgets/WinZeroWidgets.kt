package expo.modules.winzerowidgets

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.view.View
import android.widget.RemoteViews

/**
 * Win Zero Plus's home-screen widgets (SPEC 9): the small one shows the most urgent goal, the wide
 * one up to three. Each draws the frame for now from the snapshot, and sets an alarm for the next
 * frame, so it changes as check-ins open and close without the app running. A tap opens the app
 * on a link: Yes for an open check-in, else the goal's round or Home.
 */
abstract class WinZeroWidgetProvider : AppWidgetProvider() {
  abstract fun render(context: Context, id: Int, snapshot: WidgetSnapshot?, now: Long): RemoteViews

  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    val snapshot = WidgetStore.read(context)
    val now = System.currentTimeMillis()
    for (id in ids) manager.updateAppWidget(id, render(context, id, snapshot, now))
    WinZeroWidgets.scheduleNext(context, snapshot, now)
  }

  override fun onReceive(context: Context, intent: Intent) {
    super.onReceive(context, intent)
    // The clock or its time zone changed under the frames: draw the right one.
    if (intent.action == Intent.ACTION_TIME_CHANGED || intent.action == Intent.ACTION_TIMEZONE_CHANGED) {
      WinZeroWidgets.updateAll(context)
    }
  }
}

class SmallWidgetProvider : WinZeroWidgetProvider() {
  override fun render(context: Context, id: Int, snapshot: WidgetSnapshot?, now: Long): RemoteViews {
    val views = RemoteViews(context.packageName, R.layout.winzero_widget_small)
    val goal = snapshot?.frameAt(now)?.goals?.firstOrNull()
    if (goal == null) {
      WinZeroWidgets.showEmpty(context, views, snapshot, id)
      return views
    }
    views.setViewVisibility(R.id.winzero_zeros, View.VISIBLE)
    views.setTextViewText(R.id.winzero_label, goal.label)
    views.setTextViewText(R.id.winzero_zeros, goal.zeros.toString())
    views.setTextViewText(R.id.winzero_headline, goal.headline)
    views.setTextViewText(R.id.winzero_detail, goal.detail)
    views.setContentDescription(R.id.winzero_root, goal.a11y)
    views.setOnClickPendingIntent(R.id.winzero_root, WinZeroWidgets.open(context, goal.url, id, 0))
    if (goal.yes != null) {
      views.setViewVisibility(R.id.winzero_yes, View.VISIBLE)
      views.setOnClickPendingIntent(R.id.winzero_yes, WinZeroWidgets.open(context, goal.yes, id, 1))
    } else {
      views.setViewVisibility(R.id.winzero_yes, View.GONE)
    }
    return views
  }
}

class WideWidgetProvider : WinZeroWidgetProvider() {
  private val rows = listOf(
    Row(R.id.winzero_row1, R.id.winzero_row1_zeros, R.id.winzero_row1_label, R.id.winzero_row1_text, R.id.winzero_row1_yes),
    Row(R.id.winzero_row2, R.id.winzero_row2_zeros, R.id.winzero_row2_label, R.id.winzero_row2_text, R.id.winzero_row2_yes),
    Row(R.id.winzero_row3, R.id.winzero_row3_zeros, R.id.winzero_row3_label, R.id.winzero_row3_text, R.id.winzero_row3_yes),
  )

  private data class Row(val root: Int, val zeros: Int, val label: Int, val text: Int, val yes: Int)

  override fun render(context: Context, id: Int, snapshot: WidgetSnapshot?, now: Long): RemoteViews {
    val views = RemoteViews(context.packageName, R.layout.winzero_widget_wide)
    val goals = snapshot?.frameAt(now)?.goals.orEmpty()
    views.setViewVisibility(R.id.winzero_empty, if (goals.isEmpty()) View.VISIBLE else View.GONE)
    if (goals.isEmpty()) {
      views.setTextViewText(R.id.winzero_empty, snapshot?.emptyHeadline ?: context.getString(R.string.winzero_widget_name))
      views.setOnClickPendingIntent(R.id.winzero_root, WinZeroWidgets.open(context, snapshot?.emptyUrl, id, 0))
    } else {
      views.setOnClickPendingIntent(R.id.winzero_root, WinZeroWidgets.open(context, null, id, 0))
    }
    rows.forEachIndexed { i, row ->
      val goal = goals.getOrNull(i)
      if (goal == null) {
        views.setViewVisibility(row.root, View.GONE)
        return@forEachIndexed
      }
      views.setViewVisibility(row.root, View.VISIBLE)
      views.setTextViewText(row.zeros, goal.zeros.toString())
      views.setTextViewText(row.label, goal.label)
      views.setTextViewText(row.text, "${goal.headline} · ${goal.detail}")
      views.setContentDescription(row.root, goal.a11y)
      views.setOnClickPendingIntent(row.root, WinZeroWidgets.open(context, goal.url, id, 1 + i * 2))
      if (goal.yes != null) {
        views.setViewVisibility(row.yes, View.VISIBLE)
        views.setOnClickPendingIntent(row.yes, WinZeroWidgets.open(context, goal.yes, id, 2 + i * 2))
      } else {
        views.setViewVisibility(row.yes, View.GONE)
      }
    }
    return views
  }
}

object WinZeroWidgets {
  private val providers = listOf(SmallWidgetProvider::class.java, WideWidgetProvider::class.java)

  /** Every widget of ours on the home screen, drawn again. */
  fun updateAll(context: Context) {
    val manager = AppWidgetManager.getInstance(context)
    for (provider in providers) {
      val ids = manager.getAppWidgetIds(ComponentName(context, provider))
      if (ids.isEmpty()) continue
      context.sendBroadcast(
        Intent(context, provider).setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE).putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids),
      )
    }
  }

  /** An alarm for the next frame. Inexact, so Android can batch it: a widget may change a few minutes late. */
  fun scheduleNext(context: Context, snapshot: WidgetSnapshot?, now: Long) {
    val at = snapshot?.nextAfter(now) ?: return
    val alarms = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
    val intent = PendingIntent.getBroadcast(
      context,
      0,
      Intent(context, WidgetRefreshReceiver::class.java),
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )
    alarms.setAndAllowWhileIdle(AlarmManager.RTC, at, intent)
  }

  /** Open the app on `url` (Home when null), as only this app can answer. */
  fun open(context: Context, url: String?, id: Int, slot: Int): PendingIntent {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url ?: "winzeroplus://"))
      .setPackage(context.packageName)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    return PendingIntent.getActivity(context, id * 16 + slot, intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
  }

  fun showEmpty(context: Context, views: RemoteViews, snapshot: WidgetSnapshot?, id: Int) {
    views.setTextViewText(R.id.winzero_label, "")
    views.setViewVisibility(R.id.winzero_zeros, View.GONE)
    views.setViewVisibility(R.id.winzero_yes, View.GONE)
    views.setTextViewText(R.id.winzero_headline, snapshot?.emptyHeadline ?: context.getString(R.string.winzero_widget_name))
    views.setTextViewText(R.id.winzero_detail, snapshot?.emptyDetail ?: "")
    views.setOnClickPendingIntent(R.id.winzero_root, open(context, snapshot?.emptyUrl, id, 0))
  }
}
