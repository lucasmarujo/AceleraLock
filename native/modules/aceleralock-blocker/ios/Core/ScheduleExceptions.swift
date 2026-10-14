import Foundation

/// Espelho de `ScheduleExceptions.kt`. Dias ISO (1 = segunda ... 7 = domingo) e
/// minutos desde 00:00; `endMinute` menor que `startMinute` atravessa a meia-noite
/// e os dias sao sempre os de inicio da faixa.
struct ExceptionWindow: Codable, Equatable, Hashable {
    let days: Set<Int>
    let startMinute: Int
    let endMinute: Int
}

/// Hora local e se o aparelho a acerta sozinho. Sem hora e fuso automaticos a
/// faixa nao vale — mesma barreira do Kotlin.
struct LocalClockReading {
    let isoWeekday: Int
    let minuteOfDay: Int
    let automaticTime: Bool
    let automaticZone: Bool
}

enum ScheduleExceptions {
    static let minutesPerDay = 24 * 60
    static let maxWindowsPerApp = 8
    private static let separator: Character = "|"

    static func isValid(_ window: ExceptionWindow) -> Bool {
        !window.days.isEmpty &&
            window.days.allSatisfy { (1...7).contains($0) } &&
            (0..<minutesPerDay).contains(window.startMinute) &&
            (0..<minutesPerDay).contains(window.endMinute) &&
            window.startMinute != window.endMinute
    }

    static func covers(_ window: ExceptionWindow, weekday: Int, minute: Int) -> Bool {
        guard isValid(window) else { return false }
        if window.startMinute < window.endMinute {
            return window.days.contains(weekday) &&
                minute >= window.startMinute && minute < window.endMinute
        }
        let ontem = weekday == 1 ? 7 : weekday - 1
        return (window.days.contains(weekday) && minute >= window.startMinute) ||
            (window.days.contains(ontem) && minute < window.endMinute)
    }

    static func isExempt(_ packageName: String, policy: BlockPolicy, clock: LocalClockReading?) -> Bool {
        guard let clock, !policy.restricted, clock.automaticTime, clock.automaticZone else {
            return false
        }
        return (policy.exceptions[packageName] ?? []).contains {
            covers($0, weekday: clock.isoWeekday, minute: clock.minuteOfDay)
        }
    }

    static func sanitize(_ windows: [ExceptionWindow]) -> [ExceptionWindow]? {
        guard windows.count <= maxWindowsPerApp, windows.allSatisfy(isValid) else { return nil }
        var vistas = Set<ExceptionWindow>()
        return windows.filter { vistas.insert($0).inserted }
    }

    static func encode(_ packageName: String, _ window: ExceptionWindow) -> String {
        [
            packageName,
            window.days.sorted().map(String.init).joined(separator: ","),
            String(window.startMinute),
            String(window.endMinute),
        ].joined(separator: String(separator))
    }

    static func decode(_ raw: String) -> (String, ExceptionWindow)? {
        let parts = raw.split(separator: separator, omittingEmptySubsequences: false).map(String.init)
        guard parts.count == 4, !parts[0].trimmingCharacters(in: .whitespaces).isEmpty else { return nil }
        var days = Set<Int>()
        for parte in parts[1].split(separator: ",", omittingEmptySubsequences: false) {
            guard let valor = Int(parte), (1...7).contains(valor) else { return nil }
            days.insert(valor)
        }
        guard let start = Int(parts[2]), let end = Int(parts[3]) else { return nil }
        let window = ExceptionWindow(days: days, startMinute: start, endMinute: end)
        return isValid(window) ? (parts[0], window) : nil
    }
}
