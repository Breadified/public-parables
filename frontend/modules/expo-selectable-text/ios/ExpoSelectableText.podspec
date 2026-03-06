require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'ExpoSelectableText'
  s.version        = package['version']
  s.summary        = 'Native selectable text view with custom context menu for Expo'
  s.description    = 'A native module that provides text selection with custom context menu actions (Copy, Share, Note, Highlight, Bookmark)'
  s.license        = { :type => 'MIT' }
  s.authors        = 'Parables'
  s.homepage       = 'https://parables.app'
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.4'
  s.source         = { :path => '.' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
