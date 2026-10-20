package expo.modules.appicons

import android.content.Context
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class AppIconsModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("AppIcons")

    AsyncFunction("isSupportedAsync") {
      AppIcons.enabled(context)
    }

    AsyncFunction("getIconAsync") {
      AppIcons.current(context)
    }

    AsyncFunction("setIconAsync") { name: String? ->
      AppIcons.switchTo(context, name)
    }
  }
}
