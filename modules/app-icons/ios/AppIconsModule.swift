import ExpoModulesCore
import UIKit

/// The home-screen icon on iPhone: one of the alternate icons the config plugin puts in the asset
/// catalog as AppIcon-<name>, or the app's own. iOS always tells the user when it changes.
public class AppIconsModule: Module {
  private static let prefix = "AppIcon-"

  public func definition() -> ModuleDefinition {
    Name("AppIcons")

    AsyncFunction("isSupportedAsync") { () -> Bool in
      UIApplication.shared.supportsAlternateIcons
    }
    .runOnQueue(.main)

    AsyncFunction("getIconAsync") { () -> String? in
      guard let name = UIApplication.shared.alternateIconName, name.hasPrefix(Self.prefix) else {
        return nil
      }
      return String(name.dropFirst(Self.prefix.count))
    }
    .runOnQueue(.main)

    AsyncFunction("setIconAsync") { (name: String?, promise: Promise) in
      UIApplication.shared.setAlternateIconName(name.map { Self.prefix + $0 }) { error in
        if let error {
          promise.reject(SetIconException(error.localizedDescription))
        } else {
          promise.resolve(name)
        }
      }
    }
    .runOnQueue(.main)
  }
}

internal final class SetIconException: GenericException<String> {
  override var reason: String {
    "Couldn't change the app icon: \(param)"
  }
}
