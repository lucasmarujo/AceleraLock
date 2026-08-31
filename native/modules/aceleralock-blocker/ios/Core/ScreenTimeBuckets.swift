import Foundation

struct PackageTotal {
    let packageName: String
    let total: TimeInterval
}

enum ScreenTimeBuckets {
    static func byDay(sessions: [Session], timeZone: TimeZone) -> [String: TimeInterval] {
        var calendar = Calendar.current
        calendar.timeZone = timeZone
        var acumulado: [String: Int64] = [:]

        for session in sessions {
            var cursor = session.startMillis
            while cursor < session.endMillis {
                let date = Date(timeIntervalSince1970: TimeInterval(cursor) / 1000)
                let dc = calendar.dateComponents([.year, .month, .day], from: date)
                let dayStr = ScreenTimeHistory.dayString(dc)

                var nextMidnight = calendar.startOfDay(for: date)
                nextMidnight = calendar.date(byAdding: .day, value: 1, to: nextMidnight)!
                let nextMidnightMillis = Int64(nextMidnight.timeIntervalSince1970 * 1000)

                let end = min(nextMidnightMillis, session.endMillis)
                acumulado[dayStr, default: 0] += end - cursor
                cursor = end
            }
        }

        return acumulado.mapValues { TimeInterval($0) / 1000 }
    }

    static func clipToDay(sessions: [Session], day: DateComponents, timeZone: TimeZone) -> [Session] {
        var calendar = Calendar.current
        calendar.timeZone = timeZone
        guard let dayDate = calendar.date(from: day) else { return [] }
        let startOfDay = calendar.startOfDay(for: dayDate)
        let startMillis = Int64(startOfDay.timeIntervalSince1970 * 1000)
        let endMillis = Int64(calendar.date(byAdding: .day, value: 1, to: startOfDay)!.timeIntervalSince1970 * 1000)

        return sessions.compactMap { session in
            let inicio = max(session.startMillis, startMillis)
            let fim = min(session.endMillis, endMillis)
            guard fim > inicio else { return nil }
            return Session(packageName: session.packageName, startMillis: inicio, endMillis: fim)
        }
    }

    static func byPackage(sessions: [Session]) -> [PackageTotal] {
        Dictionary(grouping: sessions, by: \.packageName)
            .map { (pacote, doPacote) in
                PackageTotal(
                    packageName: pacote,
                    total: doPacote.reduce(0) { $0 + TimeInterval($1.endMillis - $1.startMillis) / 1000 }
                )
            }
            .sorted { $0.total > $1.total }
    }
}
