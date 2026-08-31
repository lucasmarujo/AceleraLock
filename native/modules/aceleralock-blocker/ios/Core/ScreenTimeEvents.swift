import Foundation

enum UsageEventType {
    case foreground
    case background
    case screenOff
    case screenOn
}

struct RawUsageEvent {
    let packageName: String
    let type: UsageEventType
    let timestampMillis: Int64
}
