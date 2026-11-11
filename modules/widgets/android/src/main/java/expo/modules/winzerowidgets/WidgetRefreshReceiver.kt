package expo.modules.winzerowidgets

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** The next frame's alarm: every widget draws again, and sets the alarm after it. */
class WidgetRefreshReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    WinZeroWidgets.updateAll(context)
  }
}
