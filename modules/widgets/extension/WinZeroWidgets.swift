import SwiftUI
import WidgetKit

// Win Zero Plus's widgets (SPEC 9): on the home screen, the most urgent goal (small) or all of them
// (medium); on the lock screen, its zeros and one line. They change at the moments the app worked
// out ahead, and a tap opens the app, answering Yes where the goal's check-in is open.

struct WinZeroEntry: TimelineEntry {
  let date: Date
  let goals: [WidgetGoal]
  let empty: WidgetEmpty

  static let sample = WinZeroEntry(
    date: Date(),
    goals: [
      WidgetGoal(
        id: "sample", label: "Your goal", state: "open", zeros: 30, headline: "Check in", detail: "Yes makes 31",
        inline: "Check in · 30 zeros", a11y: "Your goal: check-in open, 30 zeros.", url: "winzeroplus://", yes: nil)
    ],
    empty: SnapshotStore.fallback)
}

struct WinZeroProvider: TimelineProvider {
  func placeholder(in context: Context) -> WinZeroEntry { .sample }

  func getSnapshot(in context: Context, completion: @escaping (WinZeroEntry) -> Void) {
    completion(context.isPreview ? .sample : entries(now: Date())[0])
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<WinZeroEntry>) -> Void) {
    // After its last frame, it asks again: the app writes a new snapshot whenever it's opened.
    completion(Timeline(entries: entries(now: Date()), policy: .atEnd))
  }

  /** The frame showing now, then each one after it. */
  private func entries(now: Date) -> [WinZeroEntry] {
    guard let snapshot = SnapshotStore.load(), let first = snapshot.frames.first else {
      return [WinZeroEntry(date: now, goals: [], empty: SnapshotStore.load()?.empty ?? SnapshotStore.fallback)]
    }
    let t = now.timeIntervalSince1970 * 1000
    let current = snapshot.frames.last(where: { $0.at <= t }) ?? first
    var out = [WinZeroEntry(date: now, goals: current.goals, empty: snapshot.empty)]
    for frame in snapshot.frames where frame.at > t {
      out.append(WinZeroEntry(date: Date(timeIntervalSince1970: frame.at / 1000), goals: frame.goals, empty: snapshot.empty))
    }
    return out
  }
}

@main
struct WinZeroWidgets: WidgetBundle {
  var body: some Widget {
    WinZeroHomeWidget()
    WinZeroLockWidget()
  }
}

struct WinZeroHomeWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "WinZeroHome", provider: WinZeroProvider()) { entry in
      HomeWidgetView(entry: entry)
    }
    .configurationDisplayName("Win Zero Plus")
    .description("Your zeros and check-ins, with Yes for one that's open.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}

struct WinZeroLockWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "WinZeroLock", provider: WinZeroProvider()) { entry in
      LockWidgetView(entry: entry)
    }
    .configurationDisplayName("Win Zero Plus")
    .description("Your zeros, and whether a check-in is open.")
    .supportedFamilies([.accessoryCircular, .accessoryRectangular, .accessoryInline])
  }
}
