package expo.modules.appicons

import android.content.ComponentName
import android.content.Context
import android.content.pm.ActivityInfo
import android.content.pm.PackageManager
import android.content.pm.PackageManager.ComponentEnabledSetting
import android.os.Build
import expo.modules.kotlin.exception.CodedException

/**
 * The home-screen icon on Android. Each icon is an activity-alias named AppIcon_<name> that opens
 * MainActivity (plugin/withAppIcons.js writes them), and the enabled one is the launcher entry.
 * MainActivity itself is never disabled: Win Zero hands a move to it by name, and links and the
 * dev client open it directly, so it has to stay reachable whatever the icon.
 */
object AppIcons {
  private const val PREFIX = "AppIcon_"
  /** The app's own icon. */
  const val DEFAULT = "default"

  /** Whether this app has icon aliases at all: Win Zero links this module but has none. */
  fun enabled(context: Context): Boolean = context.resources.getBoolean(R.bool.app_icons_enabled)

  /** The icon aliases, enabled or not. */
  fun aliases(context: Context): List<ActivityInfo> {
    val flags = PackageManager.GET_ACTIVITIES or PackageManager.MATCH_DISABLED_COMPONENTS
    val pm = context.packageManager
    val info = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      pm.getPackageInfo(context.packageName, PackageManager.PackageInfoFlags.of(flags.toLong()))
    } else {
      @Suppress("DEPRECATION")
      pm.getPackageInfo(context.packageName, flags)
    }
    return info.activities.orEmpty().filter { it.targetActivity != null && iconName(it) != null }
  }

  /** The icon showing now; null for the app's own icon, or when no alias is enabled. */
  fun current(context: Context): String? {
    val name = aliases(context).firstOrNull { isEnabled(context, it) }?.let(::iconName)
    return if (name == DEFAULT) null else name
  }

  /**
   * Shows `name`'s icon (null: the app's own). The new alias is enabled in the same step as the
   * others are disabled (or, before Android 13, first), so there is always a launcher entry:
   * notification taps look one up when they're tapped.
   */
  fun switchTo(context: Context, name: String?): String? {
    val all = aliases(context)
    val wanted = name ?: DEFAULT
    val target = all.firstOrNull { iconName(it) == wanted } ?: throw UnknownIconException(wanted)
    val states = listOf(target to PackageManager.COMPONENT_ENABLED_STATE_ENABLED) +
      all.filter { it !== target }.map { it to PackageManager.COMPONENT_ENABLED_STATE_DISABLED }
    set(context, states)
    return name
  }

  /**
   * At startup, in an app with icons: MainActivity is enabled (an older icon library disabled it
   * on a switch), and one launcher entry is.
   */
  fun heal(context: Context) {
    if (!enabled(context)) return
    val all = aliases(context)
    val pm = context.packageManager
    all.firstOrNull()?.targetActivity?.let { main ->
      val component = ComponentName(context.packageName, main)
      if (pm.getComponentEnabledSetting(component) == PackageManager.COMPONENT_ENABLED_STATE_DISABLED) {
        pm.setComponentEnabledSetting(component, PackageManager.COMPONENT_ENABLED_STATE_DEFAULT, PackageManager.DONT_KILL_APP)
      }
    }
    if (all.none { isEnabled(context, it) }) {
      all.firstOrNull { iconName(it) == DEFAULT }?.let { set(context, listOf(it to PackageManager.COMPONENT_ENABLED_STATE_ENABLED)) }
    }
  }

  private fun iconName(alias: ActivityInfo): String? =
    alias.name.substringAfterLast('.').takeIf { it.startsWith(PREFIX) }?.removePrefix(PREFIX)

  private fun isEnabled(context: Context, alias: ActivityInfo): Boolean =
    when (context.packageManager.getComponentEnabledSetting(ComponentName(context.packageName, alias.name))) {
      PackageManager.COMPONENT_ENABLED_STATE_ENABLED -> true
      PackageManager.COMPONENT_ENABLED_STATE_DEFAULT -> alias.enabled
      else -> false
    }

  private fun set(context: Context, states: List<Pair<ActivityInfo, Int>>) {
    val pm = context.packageManager
    val components = states.map { (alias, state) -> ComponentName(context.packageName, alias.name) to state }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      pm.setComponentEnabledSettings(components.map { (c, state) -> ComponentEnabledSetting(c, state, PackageManager.DONT_KILL_APP) })
    } else {
      for ((c, state) in components) pm.setComponentEnabledSetting(c, state, PackageManager.DONT_KILL_APP)
    }
  }
}

class UnknownIconException(name: String) :
  CodedException("ERR_APP_ICON_UNKNOWN", "This app has no icon named \"$name\".", null)
