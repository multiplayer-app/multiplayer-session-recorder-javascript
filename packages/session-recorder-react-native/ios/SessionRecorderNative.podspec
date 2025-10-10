require "json"

package = JSON.parse(File.read(File.join(__dir__, "..", "package.json")))

Pod::Spec.new do |s|
  s.name         = "SessionRecorderNative"
  s.version      = package["version"]
  s.summary      = "Native session recorder module for React Native"
  s.description  = "A native module that provides session recording with automatic masking of sensitive UI elements"
  s.homepage     = "https://github.com/multiplayer-app/multiplayer-session-recorder-javascript"
  s.license      = "MIT"
  s.authors      = { "Multiplayer Software, Inc." => "https://www.multiplayer.app" }
  s.platforms    = { :ios => "12.0" }
  s.source       = { :git => "https://github.com/multiplayer-app/multiplayer-session-recorder-javascript.git", :tag => "#{s.version}" }

  s.source_files = "ios/**/*.{h,m,mm,swift}"
  s.swift_version = "5.0"
  s.requires_arc = true

  s.dependency "React-Core"
  s.dependency "React"
end
