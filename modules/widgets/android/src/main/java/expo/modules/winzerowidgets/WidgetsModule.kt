package expo.modules.winzerowidgets

import android.content.Context
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class WidgetsModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("WinZeroWidgets")

    // Android keeps the snapshot in the app's own files (the App Group is iPhone's), and every
    // widget on the home screen draws it again.
    AsyncFunction("setSnapshotAsync") { json: String, _: String ->
      WidgetStore.write(context, json)
      WinZeroWidgets.updateAll(context)
    }
  }
}
