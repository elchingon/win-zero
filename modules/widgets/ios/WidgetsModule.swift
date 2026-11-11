import ExpoModulesCore
import WidgetKit

/// The file the widget extension reads (extension/WidgetSnapshot.swift reads the same name).
let snapshotFileName = "winzeroplus-widget.json"

internal final class NoAppGroupException: Exception {
  override var reason: String {
    "This build has no App Group folder for the widgets"
  }
}

public class WidgetsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("WinZeroWidgets")

    // The snapshot goes in the folder the app and its widget extension share, written whole, and
    // every widget is asked to read it again.
    AsyncFunction("setSnapshotAsync") { (json: String, group: String) in
      guard let folder = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group) else {
        throw NoAppGroupException()
      }
      try Data(json.utf8).write(to: folder.appendingPathComponent(snapshotFileName), options: .atomic)
      WidgetCenter.shared.reloadAllTimelines()
    }
  }
}
