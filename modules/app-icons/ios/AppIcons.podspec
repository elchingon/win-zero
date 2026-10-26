Pod::Spec.new do |s|
  s.name           = 'AppIcons'
  s.version        = '1.0.0'
  s.summary        = "Switches Win Zero Plus's home-screen icon"
  s.description    = "Switches Win Zero Plus's home-screen icon among the alternate icons its config plugin adds"
  s.license        = 'UNLICENSED'
  s.author         = 'E7 Systems'
  s.homepage       = 'https://winzero.app'
  s.platforms      = {
    :ios => '16.4'
  }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
