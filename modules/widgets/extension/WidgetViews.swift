import SwiftUI
import WidgetKit

// How the widgets look: section 7's palette on ink, the zeros big in amber, and a YES pill while a
// check-in is open. Every word comes from the snapshot.

enum Palette {
  static let ink = Color(red: 0x0D / 255, green: 0x11 / 255, blue: 0x30 / 255)
  static let amber = Color(red: 0xFF / 255, green: 0xB5 / 255, blue: 0x2E / 255)
  static let fg = Color(red: 0xF5 / 255, green: 0xF0 / 255, blue: 0xE6 / 255)
  static let muted = Color(red: 0xAA / 255, green: 0xB0 / 255, blue: 0xD8 / 255)
}

extension View {
  /** iOS 17 asks a widget for its background this way; before that, it's an ordinary background. */
  @ViewBuilder func widgetBackground(_ color: Color) -> some View {
    if #available(iOS 17.0, *) {
      containerBackground(color, for: .widget)
    } else {
      background(color)
    }
  }
}

struct YesPill: View {
  var body: some View {
    Text("YES")
      .font(.system(size: 13, weight: .heavy, design: .rounded))
      .foregroundColor(Palette.ink)
      .padding(.horizontal, 12)
      .padding(.vertical, 5)
      .background(Capsule().fill(Palette.amber))
  }
}

struct ZerosText: View {
  let zeros: Int
  let size: CGFloat
  var body: some View {
    Text("\(zeros)")
      .font(.system(size: size, weight: .black, design: .rounded))
      .foregroundColor(Palette.amber)
      .minimumScaleFactor(0.5)
      .lineLimit(1)
  }
}

struct EmptyGoalView: View {
  let empty: WidgetEmpty
  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      Text(empty.headline).font(.system(size: 15, weight: .bold)).foregroundColor(Palette.fg)
      Text(empty.detail).font(.system(size: 12)).foregroundColor(Palette.muted)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
  }
}

struct SmallGoalView: View {
  let goal: WidgetGoal
  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      Text(goal.label).font(.system(size: 12, weight: .semibold)).foregroundColor(Palette.muted).lineLimit(1)
      ZerosText(zeros: goal.zeros, size: 40)
      Spacer(minLength: 0)
      Text(goal.headline).font(.system(size: 14, weight: .bold)).foregroundColor(Palette.fg).lineLimit(2)
      if goal.isOpen {
        HStack {
          Text(goal.detail).font(.system(size: 11)).foregroundColor(Palette.muted).lineLimit(1)
          Spacer(minLength: 4)
          YesPill()
        }
      } else {
        Text(goal.detail).font(.system(size: 12)).foregroundColor(Palette.muted).lineLimit(2)
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(goal.a11y)
  }
}

struct GoalRow: View {
  let goal: WidgetGoal
  var body: some View {
    HStack(spacing: 10) {
      ZerosText(zeros: goal.zeros, size: 26).frame(width: 56, alignment: .leading)
      VStack(alignment: .leading, spacing: 1) {
        Text(goal.label).font(.system(size: 11, weight: .semibold)).foregroundColor(Palette.muted).lineLimit(1)
        Text("\(goal.headline) · \(goal.detail)").font(.system(size: 13, weight: .semibold)).foregroundColor(Palette.fg).lineLimit(1)
      }
      Spacer(minLength: 4)
      if goal.isOpen, let yes = goal.tapURL {
        Link(destination: yes) { YesPill() }
      }
    }
    .accessibilityElement(children: .combine)
    .accessibilityLabel(goal.a11y)
  }
}

struct HomeWidgetView: View {
  @Environment(\.widgetFamily) private var family
  let entry: WinZeroEntry

  var body: some View {
    content
      .padding(family == .systemMedium ? 0 : 2)
      .widgetBackground(Palette.ink)
  }

  @ViewBuilder private var content: some View {
    if let first = entry.goals.first {
      if family == .systemMedium {
        VStack(alignment: .leading, spacing: 8) {
          ForEach(Array(entry.goals.prefix(3)), id: \.id) { goal in
            if goal.isOpen {
              GoalRow(goal: goal)
            } else if let url = URL(string: goal.url) {
              Link(destination: url) { GoalRow(goal: goal) }
            }
          }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .widgetURL(URL(string: entry.empty.url))
      } else {
        SmallGoalView(goal: first).widgetURL(first.tapURL)
      }
    } else {
      EmptyGoalView(empty: entry.empty).widgetURL(URL(string: entry.empty.url))
    }
  }
}

struct LockWidgetView: View {
  @Environment(\.widgetFamily) private var family
  let entry: WinZeroEntry

  var body: some View {
    content.widgetBackground(.clear)
  }

  @ViewBuilder private var content: some View {
    let goal = entry.goals.first
    switch family {
    case .accessoryCircular:
      ZStack {
        AccessoryWidgetBackground()
        VStack(spacing: 0) {
          Text("\(goal?.zeros ?? 0)").font(.system(size: 22, weight: .heavy, design: .rounded)).minimumScaleFactor(0.5).lineLimit(1)
          Text(goal?.isOpen == true ? "CHECK IN" : "ZEROS").font(.system(size: 7, weight: .bold))
        }
        .widgetAccentable()
      }
      .accessibilityElement(children: .ignore)
      .accessibilityLabel(goal?.a11y ?? entry.empty.headline)
      .widgetURL(URL(string: goal?.url ?? entry.empty.url))
    case .accessoryInline:
      Text(goal?.inline ?? entry.empty.headline).widgetURL(URL(string: goal?.url ?? entry.empty.url))
    default:
      // The rectangle answers Yes while a check-in is open; iOS asks for Face ID first.
      VStack(alignment: .leading, spacing: 1) {
        Text(goal?.label ?? entry.empty.headline).font(.headline).lineLimit(1).privacySensitive()
        Text(goal.map { "\($0.zeros) · \($0.headline)" } ?? entry.empty.detail).font(.caption).lineLimit(1)
        if let goal { Text(goal.detail).font(.caption2).foregroundColor(.secondary).lineLimit(1) }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .accessibilityElement(children: .ignore)
      .accessibilityLabel(goal?.a11y ?? entry.empty.detail)
      .widgetURL(goal?.tapURL ?? URL(string: entry.empty.url))
    }
  }
}
