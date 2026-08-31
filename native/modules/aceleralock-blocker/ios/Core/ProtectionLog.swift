import Foundation

struct Interruption {
    let duration: TimeInterval?
}

final class ProtectionLog {
    private let store: KeyValueStore
    private let monotonic: MonotonicClock

    private static let absent: Int64 = -1
    private static let unmeasurable: Int64 = -2
    private static let keyActive = "protection.active"
    private static let keyHeartbeat = "protection.heartbeat_millis"
    private static let keyTotalMillis = "protection.downtime_total_millis"
    private static let keyLastMillis = "protection.downtime_last_millis"
    private static let keyUnknownCount = "protection.downtime_unknown_count"

    init(store: KeyValueStore, monotonic: MonotonicClock) {
        self.store = store
        self.monotonic = monotonic
    }

    func isActive() -> Bool {
        store.getLong(Self.keyActive, fallback: 0) == 1
    }

    func markActive() {
        store.putLong(Self.keyActive, value: 1)
        heartbeat()
    }

    func markStopped() {
        store.putLong(Self.keyActive, value: 0)
        store.putLong(Self.keyHeartbeat, value: 0)
    }

    func heartbeat() {
        store.putLong(Self.keyHeartbeat, value: monotonic.elapsedMillis())
    }

    func onServiceStart() -> Interruption? {
        guard isActive() else { return nil }
        let now = monotonic.elapsedMillis()
        let last = store.getLong(Self.keyHeartbeat, fallback: 0)
        heartbeat()
        if last == 0 { return nil }
        if now < last {
            store.putInt(Self.keyUnknownCount, value: Int32(unknownInterruptions() + 1))
            store.putLong(Self.keyLastMillis, value: Self.unmeasurable)
            return Interruption(duration: nil)
        }
        let gap = now - last
        store.putLong(Self.keyTotalMillis, value: store.getLong(Self.keyTotalMillis, fallback: 0) + gap)
        store.putLong(Self.keyLastMillis, value: gap)
        return Interruption(duration: TimeInterval(gap) / 1000)
    }

    func totalMeasuredDowntime() -> TimeInterval {
        TimeInterval(store.getLong(Self.keyTotalMillis, fallback: 0)) / 1000
    }

    func unknownInterruptions() -> Int {
        Int(store.getInt(Self.keyUnknownCount, fallback: 0))
    }

    func lastInterruption() -> Interruption? {
        let last = store.getLong(Self.keyLastMillis, fallback: Self.absent)
        switch last {
        case Self.absent: return nil
        case Self.unmeasurable: return Interruption(duration: nil)
        default: return Interruption(duration: TimeInterval(last) / 1000)
        }
    }
}
