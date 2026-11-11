import Foundation

// What Win Zero Plus writes for its widgets (src/plus/widget/snapshot.ts): every word worked out
// ahead, in frames. The widgets only pick the frame for the time and lay it out.

struct WidgetSnapshot: Decodable {
  let v: Int
  let writtenAt: Double
  let frames: [WidgetFrame]
  let empty: WidgetEmpty
}

struct WidgetFrame: Decodable {
  /** When it starts, in epoch ms. */
  let at: Double
  let goals: [WidgetGoal]
}

struct WidgetGoal: Decodable, Hashable {
  let id: String
  let label: String
  /** open, ready, waiting or break. */
  let state: String
  let zeros: Int
  let headline: String
  let detail: String
  let inline: String
  let a11y: String
  let url: String
  let yes: String?

  var isOpen: Bool { state == "open" }
  /** Where a tap on the goal goes: its Yes while its check-in is open, else its own link. */
  var tapURL: URL? { URL(string: yes ?? url) }
}

struct WidgetEmpty: Decodable, Hashable {
  let headline: String
  let detail: String
  let url: String
}

enum SnapshotStore {
  static let fileName = "winzeroplus-widget.json"
  /** Before the app has written anything: open it. */
  static let fallback = WidgetEmpty(headline: "Win Zero Plus", detail: "Open the app to check in.", url: "winzeroplus://")

  /** The snapshot in the folder the app shares with this extension (its App Group, from Info.plist). */
  static func load() -> WidgetSnapshot? {
    guard
      let group = Bundle.main.object(forInfoDictionaryKey: "WinZeroAppGroup") as? String,
      let folder = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group),
      let data = try? Data(contentsOf: folder.appendingPathComponent(fileName))
    else { return nil }
    return try? JSONDecoder().decode(WidgetSnapshot.self, from: data)
  }
}
