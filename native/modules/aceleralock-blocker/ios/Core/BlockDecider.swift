import Foundation

enum BlockOutcome {
    case block
    case allow
}

enum AllowReason {
    case notATarget
    case criticalApp
    case activeGrant
}

struct BlockVerdict {
    let outcome: BlockOutcome
    let allowReason: AllowReason?

    var shouldDrawOverlay: Bool { outcome == .block }

    init(_ outcome: BlockOutcome, _ allowReason: AllowReason? = nil) {
        self.outcome = outcome
        self.allowReason = allowReason
    }
}

struct BlockDecider {
    func decide(
        packageName: String,
        policy: BlockPolicy,
        criticalPackages: Set<String>,
        activeGrant: String?
    ) -> BlockVerdict {
        if criticalPackages.contains(packageName) {
            return BlockVerdict(.allow, .criticalApp)
        }
        if !policy.blockedPackages.contains(packageName) {
            return BlockVerdict(.allow, .notATarget)
        }
        if packageName == activeGrant {
            return BlockVerdict(.allow, .activeGrant)
        }
        return BlockVerdict(.block)
    }
}
