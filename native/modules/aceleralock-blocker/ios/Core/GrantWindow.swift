import Foundation

final class GrantWindow {
    private let store: KeyValueStore
    private let monotonic: MonotonicClock
    private let duration: () -> TimeInterval

    private static let keyPackage = "grant.package"
    private static let keyRemaining = "grant.remaining_millis"
    private static let keyLastElapsed = "grant.last_elapsed_millis"

    init(store: KeyValueStore, monotonic: MonotonicClock, duration: @escaping () -> TimeInterval) {
        self.store = store
        self.monotonic = monotonic
        self.duration = duration
    }

    func onServiceStart() {
        tick()
    }

    func open(_ packageName: String) -> Bool {
        guard !packageName.isEmpty else { return false }
        store.putString(Self.keyPackage, value: packageName)
        store.putLong(Self.keyRemaining, value: Int64(duration() * 1000))
        store.putLong(Self.keyLastElapsed, value: monotonic.elapsedMillis())
        return true
    }

    func tick() {
        guard store.getString(Self.keyPackage) != nil else { return }
        let now = monotonic.elapsedMillis()
        let previous = store.getLong(Self.keyLastElapsed, fallback: now)
        store.putLong(Self.keyLastElapsed, value: now)
        if now < previous {
            clear()
            return
        }
        let remaining = store.getLong(Self.keyRemaining, fallback: 0) - (now - previous)
        if remaining <= 0 {
            clear()
        } else {
            store.putLong(Self.keyRemaining, value: remaining)
        }
    }

    func activePackage() -> String? {
        remainingMillis() > 0 ? store.getString(Self.keyPackage) : nil
    }

    func remaining() -> TimeInterval {
        TimeInterval(max(remainingMillis(), 0)) / 1000
    }

    func clear() {
        store.putString(Self.keyPackage, value: nil)
        store.putLong(Self.keyRemaining, value: 0)
        store.putLong(Self.keyLastElapsed, value: 0)
    }

    private func remainingMillis() -> Int64 {
        store.getLong(Self.keyRemaining, fallback: 0)
    }
}
