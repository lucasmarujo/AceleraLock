import Foundation

enum WaitTarget {
    case unlockApp(packageName: String)
    case stopProtection
    case changeDurations(newWait: TimeInterval, newGrant: TimeInterval)
}

struct PendingWait {
    let target: WaitTarget
    let accumulated: TimeInterval
    let required: TimeInterval

    var isReady: Bool { accumulated >= required }
    var remaining: TimeInterval { isReady ? 0 : required - accumulated }
}

final class WaitingPeriod {
    private let store: KeyValueStore
    private let monotonic: MonotonicClock
    private var lastTickElapsed: Int64?

    private static let defaultWaitMillis: Int64 = 30 * 60 * 1000
    private static let defaultGrantMillis: Int64 = 15 * 60 * 1000
    private static let payloadSeparator = ":"

    private static let keyWaitMillis = "wait.duration_millis"
    private static let keyGrantMillis = "wait.grant_millis"
    private static let keyTargetKind = "wait.target_kind"
    private static let keyTargetPayload = "wait.target_payload"
    private static let keyAccumulated = "wait.accumulated_millis"
    private static let keyRequired = "wait.required_millis"

    private static let kindUnlockApp = "UNLOCK_APP"
    private static let kindStopProtection = "STOP_PROTECTION"
    private static let kindChangeDurations = "CHANGE_DURATIONS"

    init(store: KeyValueStore, monotonic: MonotonicClock) {
        self.store = store
        self.monotonic = monotonic
    }

    func onServiceStart() {
        lastTickElapsed = nil
    }

    func waitDuration() -> TimeInterval {
        TimeInterval(store.getLong(Self.keyWaitMillis, fallback: Self.defaultWaitMillis)) / 1000
    }

    func grantDuration() -> TimeInterval {
        TimeInterval(store.getLong(Self.keyGrantMillis, fallback: Self.defaultGrantMillis)) / 1000
    }

    func isConfigured() -> Bool {
        store.getLong(Self.keyWaitMillis, fallback: 0) > 0
    }

    func configureInitial(wait: TimeInterval, grant: TimeInterval) -> Bool {
        if isConfigured() || wait <= 0 || grant <= 0 { return false }
        applyDurations(wait: wait, grant: grant)
        return true
    }

    func request(_ target: WaitTarget) -> Bool {
        if case let .changeDurations(newWait, newGrant) = target,
           newWait <= 0 || newGrant <= 0 {
            return false
        }
        store.putString(Self.keyTargetKind, value: kindOf(target))
        store.putString(Self.keyTargetPayload, value: payloadOf(target))
        store.putLong(Self.keyAccumulated, value: 0)
        store.putLong(Self.keyRequired, value: Int64(waitDuration() * 1000))
        lastTickElapsed = monotonic.elapsedMillis()
        return true
    }

    func cancel() {
        store.putString(Self.keyTargetKind, value: nil)
        store.putString(Self.keyTargetPayload, value: nil)
        store.putLong(Self.keyAccumulated, value: 0)
        store.putLong(Self.keyRequired, value: 0)
    }

    func tick() {
        let now = monotonic.elapsedMillis()
        let previous = lastTickElapsed
        lastTickElapsed = now
        guard pending() != nil, let previous, now >= previous else { return }
        store.putLong(Self.keyAccumulated, value: store.getLong(Self.keyAccumulated, fallback: 0) + (now - previous))
    }

    func pending() -> PendingWait? {
        guard let target = storedTarget() else { return nil }
        return PendingWait(
            target: target,
            accumulated: TimeInterval(store.getLong(Self.keyAccumulated, fallback: 0)) / 1000,
            required: TimeInterval(store.getLong(Self.keyRequired, fallback: Self.defaultWaitMillis)) / 1000
        )
    }

    func pendingUnlockFor(_ packageName: String) -> TimeInterval? {
        guard let current = pending() else { return nil }
        guard case let .unlockApp(target) = current.target, target == packageName else { return nil }
        return current.remaining
    }

    func consumeIfReady() -> WaitTarget? {
        guard let current = pending(), current.isReady else { return nil }
        cancel()
        if case let .changeDurations(newWait, newGrant) = current.target {
            applyDurations(wait: newWait, grant: newGrant)
        }
        return current.target
    }

    private func applyDurations(wait: TimeInterval, grant: TimeInterval) {
        store.putLong(Self.keyWaitMillis, value: Int64(wait * 1000))
        store.putLong(Self.keyGrantMillis, value: Int64(grant * 1000))
    }

    private func storedTarget() -> WaitTarget? {
        let payload = store.getString(Self.keyTargetPayload)
        switch store.getString(Self.keyTargetKind) {
        case Self.kindUnlockApp:
            guard let p = payload, !p.isEmpty else { return nil }
            return .unlockApp(packageName: p)
        case Self.kindStopProtection:
            return .stopProtection
        case Self.kindChangeDurations:
            return decodeDurations(payload)
        default:
            return nil
        }
    }

    private func decodeDurations(_ payload: String?) -> WaitTarget? {
        guard let parts = payload?.split(separator: Character(Self.payloadSeparator)),
              parts.count == 2,
              let wait = Int64(parts[0]), wait > 0,
              let grant = Int64(parts[1]), grant > 0 else { return nil }
        return .changeDurations(
            newWait: TimeInterval(wait) / 1000,
            newGrant: TimeInterval(grant) / 1000
        )
    }

    private func kindOf(_ target: WaitTarget) -> String {
        switch target {
        case .unlockApp: Self.kindUnlockApp
        case .stopProtection: Self.kindStopProtection
        case .changeDurations: Self.kindChangeDurations
        }
    }

    private func payloadOf(_ target: WaitTarget) -> String? {
        switch target {
        case let .unlockApp(packageName): packageName
        case .stopProtection: nil
        case let .changeDurations(newWait, newGrant):
            "\(Int64(newWait * 1000))\(Self.payloadSeparator)\(Int64(newGrant * 1000))"
        }
    }
}
