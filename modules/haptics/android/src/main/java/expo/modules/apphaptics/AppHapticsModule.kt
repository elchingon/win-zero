package expo.modules.apphaptics

import android.content.Context
import android.media.AudioAttributes
import android.os.Build
import android.os.VibrationAttributes
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Plays a waveform with its usage spelled out. Android files a short vibration that names no usage
 * as touch feedback, and drops it while the phone's Touch feedback setting is off; the round's
 * buzzes are media, so they follow the Media vibration setting instead.
 */
class AppHapticsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("AppHaptics")

    Function("play") { timings: List<Double>, amplitudes: List<Double>, usage: String ->
      play(timings, amplitudes, usage == "touch")
    }
  }

  private fun vibrator(): Vibrator? {
    val context = appContext.reactContext ?: return null
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      (context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager)?.defaultVibrator
    } else {
      @Suppress("DEPRECATION")
      context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
    }
  }

  private fun play(timings: List<Double>, amplitudes: List<Double>, touch: Boolean) {
    val vibrator = vibrator() ?: return
    if (!vibrator.hasVibrator() || timings.isEmpty() || timings.size != amplitudes.size) return
    val steps = LongArray(timings.size) { timings[it].toLong().coerceAtLeast(0) }
    val strengths = IntArray(amplitudes.size) { amplitudes[it].toInt().coerceIn(0, 255) }
    val audio = AudioAttributes.Builder()
      .setUsage(if (touch) AudioAttributes.USAGE_ASSISTANCE_SONIFICATION else AudioAttributes.USAGE_GAME)
      .build()
    try {
      when {
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU -> vibrator.vibrate(
          VibrationEffect.createWaveform(steps, strengths, -1),
          VibrationAttributes.createForUsage(
            if (touch) VibrationAttributes.USAGE_TOUCH else VibrationAttributes.USAGE_MEDIA,
          ),
        )
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.O ->
          @Suppress("DEPRECATION")
          vibrator.vibrate(VibrationEffect.createWaveform(steps, strengths, -1), audio)
        else ->
          // No strengths before Android 8: the steps alternate off and on.
          @Suppress("DEPRECATION")
          vibrator.vibrate(steps, -1, audio)
      }
    } catch (_: RuntimeException) {
      // A phone that refuses the vibration (no permission, a busy service) just stays still.
    }
  }
}
