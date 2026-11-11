package expo.modules.shareimage

import android.content.ClipData
import android.content.Intent
import android.net.Uri
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ShareImageModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ShareImage")

    // The chooser for one file, with read access granted to whichever app is picked. The clip data
    // carries the grant on Android 10 and later, the flag before that.
    AsyncFunction("shareAsync") { uri: String, mimeType: String, title: String ->
      val activity = appContext.currentActivity ?: throw Exceptions.MissingActivity()
      val content = Uri.parse(uri)
      val send = Intent(Intent.ACTION_SEND).apply {
        type = mimeType
        putExtra(Intent.EXTRA_STREAM, content)
        clipData = ClipData.newRawUri(null, content)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      }
      activity.startActivity(Intent.createChooser(send, title))
    }.runOnQueue(Queues.MAIN)
  }
}
