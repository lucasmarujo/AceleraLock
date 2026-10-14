import Foundation

enum BlockOutcome {
    case block
    case allow
}

enum AllowReason {
    case notATarget
    case criticalApp
    case activeGrant
    case scheduledException
}

struct BlockVerdict {
    let outcome: BlockOutcome
    let allowReason: AllowReason?
    let blockedHost: String?

    var shouldDrawOverlay: Bool { outcome == .block }

    init(_ outcome: BlockOutcome, _ allowReason: AllowReason? = nil, blockedHost: String? = nil) {
        self.outcome = outcome
        self.allowReason = allowReason
        self.blockedHost = blockedHost
    }
}

struct BrowserAddress {
    let packageName: String
    let text: String
}

struct BlockDecider {
    func decide(
        packageName: String,
        policy: BlockPolicy,
        criticalPackages: Set<String>,
        activeGrant: String?,
        browserAddress: BrowserAddress? = nil,
        clock: LocalClockReading? = nil
    ) -> BlockVerdict {
        if criticalPackages.contains(packageName) {
            return BlockVerdict(.allow, .criticalApp)
        }
        if let address = browserAddress, address.packageName == packageName,
           let host = SiteMatcher.hostOf(address.text),
           SiteMatcher.blocks(host, policy.blockedDomains) {
            return BlockVerdict(.block, blockedHost: host)
        }
        if !policy.blockedPackages.contains(packageName) {
            return BlockVerdict(.allow, .notATarget)
        }
        if ScheduleExceptions.isExempt(packageName, policy: policy, clock: clock) {
            return BlockVerdict(.allow, .scheduledException)
        }
        if packageName == activeGrant {
            return BlockVerdict(.allow, .activeGrant)
        }
        return BlockVerdict(.block)
    }
}
