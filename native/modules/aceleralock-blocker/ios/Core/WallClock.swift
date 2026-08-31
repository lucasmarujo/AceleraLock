import Foundation

protocol WallClock {
    func today() -> DateComponents
    func nowMillis() -> Int64
}

struct SystemWallClock: WallClock {
    func today() -> DateComponents {
        Calendar.current.dateComponents([.year, .month, .day], from: Date())
    }

    func nowMillis() -> Int64 {
        Int64(Date().timeIntervalSince1970 * 1000)
    }
}
