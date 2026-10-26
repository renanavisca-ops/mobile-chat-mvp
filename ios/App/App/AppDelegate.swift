import UIKit
import Capacitor
import FirebaseCore

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Initialize Firebase for push (FCM delivers to iOS via APNs). Guarded on
        // the presence of GoogleService-Info.plist so a build without it doesn't
        // crash on launch — add that file (from the Firebase console, iOS app for
        // bundle id app.toky.chat) to enable push. See ios/FIREBASE_SETUP.md.
        if Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist") != nil {
            FirebaseApp.configure()
        }
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}

// MARK: - Native printing (TokyPrint)
//
// Opens the real iOS print sheet (UIPrintInteractionController) with AirPrint
// printer selection and "Save to Files" as PDF — the WKWebView can't print on
// its own. Defined in this already-compiled file so no Xcode project edit is
// needed; Capacitor discovers the plugin at runtime via the Objective-C runtime.
//   - printHtml({html}): rendered content (image wrapped in HTML, or a parsed
//     spreadsheet / Word document) via a markup print formatter.
//   - printPdf({base64}): a PDF printed as-is.
@objc(PrintPlugin)
public class PrintPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PrintPlugin"
    public let jsName = "TokyPrint"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "printHtml", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "printPdf", returnType: CAPPluginReturnPromise)
    ]

    private func present(_ controller: UIPrintInteractionController, _ call: CAPPluginCall) {
        controller.present(animated: true) { (_, completed, error) in
            if let error = error {
                call.reject("print failed: \(error.localizedDescription)")
            } else {
                call.resolve()
            }
        }
    }

    private func printInfo(_ name: String) -> UIPrintInfo {
        let info = UIPrintInfo(dictionary: nil)
        info.outputType = .general
        info.jobName = name
        return info
    }

    @objc func printHtml(_ call: CAPPluginCall) {
        guard let html = call.getString("html") else {
            call.reject("Missing html")
            return
        }
        let name = call.getString("name") ?? "Documento"
        DispatchQueue.main.async {
            let pic = UIPrintInteractionController.shared
            pic.printInfo = self.printInfo(name)
            pic.printFormatter = UIMarkupTextPrintFormatter(markupText: html)
            self.present(pic, call)
        }
    }

    @objc func printPdf(_ call: CAPPluginCall) {
        guard let base64 = call.getString("base64"), let data = Data(base64Encoded: base64) else {
            call.reject("Missing base64")
            return
        }
        let name = call.getString("name") ?? "Documento"
        DispatchQueue.main.async {
            let pic = UIPrintInteractionController.shared
            pic.printInfo = self.printInfo(name)
            pic.printingItem = data
            self.present(pic, call)
        }
    }
}
