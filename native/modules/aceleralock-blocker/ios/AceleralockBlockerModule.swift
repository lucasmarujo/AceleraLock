import ExpoModulesCore
import FamilyControls
import ManagedSettings
import DeviceActivity
import UserNotifications

private let appGroupSuite = "group.com.aceleralock.app"

public class AceleralockBlockerModule: Module {
    private lazy var kvStore: KeyValueStore = UserDefaultsStore(suiteName: appGroupSuite)
    private lazy var clock: MonotonicClock = SystemMonotonicClock()

    private func waiting() -> WaitingPeriod {
        WaitingPeriod(store: kvStore, monotonic: clock)
    }

    private func protectionLog() -> ProtectionLog {
        ProtectionLog(store: kvStore, monotonic: clock)
    }

    public func definition() -> ModuleDefinition {
        Name("AceleralockBlocker")

        Function("probePermissions") { () -> [String: Any] in
            let familyControlsAuthorized = AuthorizationCenter.shared.authorizationStatus == .approved
            return [
                "usageAccess": familyControlsAuthorized,
                "overlay": true,
                "batteryExempt": true,
                "notifications": true,
                "accessibility": familyControlsAuthorized,
                "coreGranted": familyControlsAuthorized
            ]
        }

        Function("criticalPackages") { () -> [String] in
            []
        }

        AsyncFunction("installedApps") { () -> [[String: Any?]] in
            []
        }

        AsyncFunction("screenTimeSummary") { () -> [String: Any] in
            let defaults = UserDefaults(suiteName: appGroupSuite)
            let todaySeconds = defaults?.integer(forKey: "report.todaySeconds") ?? 0
            let byPackageData = defaults?.data(forKey: "report.byPackage")
            let daysData = defaults?.data(forKey: "report.days")

            var byPackage: [[String: Any?]] = []
            if let data = byPackageData,
               let decoded = try? JSONDecoder().decode([[String: String]].self, from: data) {
                byPackage = decoded.map { item in
                    [
                        "packageName": item["packageName"] as Any?,
                        "label": item["label"] as Any?,
                        "iconUri": nil as Any?,
                        "seconds": Int(item["seconds"] ?? "0") as Any?
                    ]
                }
            }

            var days: [[String: Any]] = []
            if let data = daysData,
               let decoded = try? JSONDecoder().decode([[String: String]].self, from: data) {
                days = decoded.map { item in
                    [
                        "date": item["date"] ?? "",
                        "seconds": Int(item["seconds"] ?? "0") ?? 0
                    ]
                }
            }

            return [
                "todaySeconds": todaySeconds,
                "byPackage": byPackage,
                "days": days
            ]
        }

        Function("blockedPackages") { () -> [String] in
            ManagedSettingsManager.shared.blockedTokenIdentifiers()
        }

        Function("setBlockedPackages") { (packages: [String]) in
            // No iOS, a seleção real é feita pelo FamilyActivityPicker.
            // Esta função reaplica os shields a partir da seleção salva.
            if let selection = ManagedSettingsManager.shared.currentSelection() {
                ManagedSettingsManager.shared.applyShields(selection)
            }
        }

        // Horario livre ainda nao existe no iOS: aqui o bloqueio e um shield do
        // Family Controls por token opaco, e liberar por horario exige uma extensao
        // DeviceActivityMonitor que ainda nao foi escrita. A UI esconde a opcao no
        // iPhone; estas funcoes existem so para o contrato ter o mesmo formato.
        Function("appExceptions") { () -> [[String: Any]] in
            []
        }

        Function("setAppExceptions") { (packageName: String, windows: [[String: Any]]) in
            throw NSError(
                domain: "AceleralockBlocker",
                code: 1,
                userInfo: [NSLocalizedDescriptionKey: "horario livre ainda nao existe no iOS"]
            )
        }

        Function("automaticClock") { () -> [String: Bool] in
            ["automaticTime": false, "automaticZone": false]
        }

        Function("blockedDomains") { () -> [String] in
            ManagedSettingsManager.shared.blockedWebDomains()
        }

        Function("setBlockedDomains") { (domains: [String]) in
            let normalizados = Set(domains.compactMap { SiteMatcher.hostOf($0) })
            ManagedSettingsManager.shared.applyWebDomains(normalizados.sorted())
        }

        Function("configureInitialDurations") { (waitMinutes: Int, grantMinutes: Int) -> Bool in
            self.waiting().configureInitial(
                wait: TimeInterval(waitMinutes * 60),
                grant: TimeInterval(grantMinutes * 60)
            )
        }

        Function("requestUnlock") { (packageName: String) -> Bool in
            self.request(.unlockApp(packageName: packageName))
        }

        Function("requestStopProtection") { () -> Bool in
            self.request(.stopProtection)
        }

        Function("requestDurationChange") { (waitMinutes: Int, grantMinutes: Int) -> Bool in
            self.request(.changeDurations(
                newWait: TimeInterval(waitMinutes * 60),
                newGrant: TimeInterval(grantMinutes * 60)
            ))
        }

        Function("cancelRequest") {
            self.waiting().cancel()
        }

        Function("protectionState") { () -> [String: Any?] in
            let period = self.waiting()
            let pending = period.pending()
            let log = self.protectionLog()
            let lastInterruption = log.lastInterruption()
            return [
                "protectionActive": log.isActive(),
                "downtimeTotalSeconds": Int(log.totalMeasuredDowntime()),
                "downtimeLastSeconds": lastInterruption?.duration.map { Int($0) },
                "downtimeUnknownCount": log.unknownInterruptions(),
                "configured": period.isConfigured(),
                "waitMinutes": Int(period.waitDuration() / 60),
                "grantMinutes": Int(period.grantDuration() / 60),
                "pendingTarget": pending.map { self.describeTarget($0) },
                "pendingRemainingSeconds": pending.map { Int($0.remaining) },
                "pendingReady": pending?.isReady ?? false
            ]
        }

        Function("start") {
            Task {
                do {
                    try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
                } catch {
                    return
                }
                let log = self.protectionLog()
                log.markActive()
                if let selection = ManagedSettingsManager.shared.currentSelection() {
                    ManagedSettingsManager.shared.applyShields(selection)
                }
                let manager = ManagedSettingsManager.shared
                manager.applyWebDomains(manager.blockedWebDomains())
                self.startMonitoring()
            }
        }

        Function("stop") { () -> Never in
            fatalError("desligar a protecao exige requestStopProtection e a espera cumprida")
        }

        View(FamilyActivityPickerExpoView.self)
    }

    private func request(_ target: WaitTarget) -> Bool {
        let period = waiting()
        let accepted = period.request(target)
        if accepted {
            startMonitoring()
        }
        return accepted
    }

    private func describeTarget(_ pending: PendingWait) -> String {
        switch pending.target {
        case .unlockApp: "UNLOCK_APP"
        case .stopProtection: "STOP_PROTECTION"
        case .changeDurations: "CHANGE_DURATIONS"
        }
    }

    private func startMonitoring() {
        let center = DeviceActivityCenter()
        let schedule = DeviceActivitySchedule(
            intervalStart: DateComponents(hour: 0, minute: 0),
            intervalEnd: DateComponents(hour: 23, minute: 59),
            repeats: true
        )
        do {
            try center.startMonitoring(.init("aceleralock.protection"), during: schedule)
        } catch {
            // Monitoring may fail if FamilyControls not authorized
        }
    }

    private func checkNotifications() async -> Bool {
        await withCheckedContinuation { continuation in
            UNUserNotificationCenter.current().getNotificationSettings { settings in
                continuation.resume(returning: settings.authorizationStatus == .authorized)
            }
        }
    }
}
