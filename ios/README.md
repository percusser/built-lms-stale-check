# iPhone app

SwiftUI app with a share extension. People share a Slack message, an email or a screenshot to the app, and it checks the text against the organization's lesson facts on the device with Apple Foundation Models through Firebase AI Logic. Requires Firebase iOS SDK 12.13 or later and App Attest. Because share extensions cannot use App Attest, the share extension only saves the item to the app group, and the app runs the check when it opens.
