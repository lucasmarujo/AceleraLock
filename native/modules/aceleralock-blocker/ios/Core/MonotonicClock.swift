import Foundation

protocol MonotonicClock {
    func elapsedMillis() -> Int64
}

struct SystemMonotonicClock: MonotonicClock {
    func elapsedMillis() -> Int64 {
        Int64(clock_gettime_nsec_np(CLOCK_UPTIME_RAW) / 1_000_000)
    }
}
