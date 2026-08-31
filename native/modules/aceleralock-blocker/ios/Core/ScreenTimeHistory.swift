import Foundation

final class ScreenTimeHistory {
    private let store: KeyValueStore
    private let wall: WallClock

    private static let separadorEntradas = ";"
    private static let separadorCampos = "="
    private static let retencaoDias = 90
    private static let keyTotals = "screentime.daily_totals"

    init(store: KeyValueStore, wall: WallClock) {
        self.store = store
        self.wall = wall
    }

    func record(day: DateComponents, totalSeconds: TimeInterval) {
        var atual = totals()
        let dayStr = Self.dayString(day)
        let gravado = atual[dayStr]

        let today = wall.today()
        if Self.isBefore(day, today), let gravado, totalSeconds < gravado {
            return
        }

        atual[dayStr] = totalSeconds
        write(podar(atual))
    }

    func totals() -> [String: TimeInterval] {
        guard let cru = store.getString(Self.keyTotals), !cru.isEmpty else { return [:] }
        var result: [String: TimeInterval] = [:]
        for entrada in cru.split(separator: Character(Self.separadorEntradas)) {
            let partes = entrada.split(separator: Character(Self.separadorCampos))
            guard partes.count == 2,
                  let millis = Int64(partes[1]) else { continue }
            result[String(partes[0])] = TimeInterval(millis) / 1000
        }
        return result
    }

    private func podar(_ totais: [String: TimeInterval]) -> [String: TimeInterval] {
        guard let cutoff = Self.addingDays(-Self.retencaoDias, to: wall.today()) else { return totais }
        let cutoffStr = Self.dayString(cutoff)
        return totais.filter { $0.key >= cutoffStr }
    }

    private func write(_ totais: [String: TimeInterval]) {
        let serializado = totais.sorted { $0.key < $1.key }
            .map { "\($0.key)\(Self.separadorCampos)\(Int64($0.value * 1000))" }
            .joined(separator: Self.separadorEntradas)
        store.putString(Self.keyTotals, value: serializado)
    }

    static func dayString(_ dc: DateComponents) -> String {
        String(format: "%04d-%02d-%02d", dc.year ?? 0, dc.month ?? 0, dc.day ?? 0)
    }

    private static func isBefore(_ a: DateComponents, _ b: DateComponents) -> Bool {
        dayString(a) < dayString(b)
    }

    private static func addingDays(_ days: Int, to dc: DateComponents) -> DateComponents? {
        guard let date = Calendar.current.date(from: dc) else { return nil }
        let shifted = Calendar.current.date(byAdding: .day, value: days, to: date)!
        return Calendar.current.dateComponents([.year, .month, .day], from: shifted)
    }
}
