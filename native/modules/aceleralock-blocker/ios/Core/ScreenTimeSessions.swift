import Foundation

struct Session {
    let packageName: String
    let startMillis: Int64
    let endMillis: Int64

    var duration: TimeInterval { TimeInterval(endMillis - startMillis) / 1000 }
}

enum ScreenTimeSessions {
    static let minSessionMillis: Int64 = 1_000

    static func reconstruct(events: [RawUsageEvent], windowEndMillis: Int64) -> [Session] {
        var sessions: [Session] = []
        var openPackage: String?
        var openStart: Int64 = 0

        func close(at: Int64) {
            guard let pacote = openPackage else { return }
            openPackage = nil
            let duracao = at - openStart
            if duracao >= minSessionMillis {
                sessions.append(Session(packageName: pacote, startMillis: openStart, endMillis: at))
            }
        }

        for event in events.sorted(by: { $0.timestampMillis < $1.timestampMillis }) {
            switch event.type {
            case .foreground:
                close(at: event.timestampMillis)
                openPackage = event.packageName
                openStart = event.timestampMillis
            case .background:
                if openPackage == event.packageName {
                    close(at: event.timestampMillis)
                }
            case .screenOff:
                close(at: event.timestampMillis)
            case .screenOn:
                break
            }
        }

        close(at: windowEndMillis)
        return sessions
    }
}
