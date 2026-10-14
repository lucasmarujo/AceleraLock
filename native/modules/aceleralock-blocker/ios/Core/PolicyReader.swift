import Foundation

struct RawPolicy {
    let blockedPackages: [String]
    var restricted: Bool = false
    var blockedDomains: [String] = []
    /// Faixas codificadas por `ScheduleExceptions.encode`.
    var exceptions: [String] = []
}

enum PolicyRead {
    case absent
    case loaded(BlockPolicy)
    case unreadable
}

enum PolicyReader {
    static func read(_ raw: String?, extract: (String) -> RawPolicy?) -> PolicyRead {
        guard let raw else { return .absent }
        guard let parsed = extract(raw) else { return .unreadable }
        let blocked = Set(parsed.blockedPackages)
        return .loaded(BlockPolicy(
            blockedPackages: blocked,
            restricted: parsed.restricted,
            blockedDomains: Set(parsed.blockedDomains),
            exceptions: readExceptions(parsed.exceptions, blocked: blocked)
        ))
    }

    /// Faixa malformada ou de app fora da lista cai sozinha; o resto da politica vale.
    private static func readExceptions(_ encoded: [String], blocked: Set<String>) -> [String: [ExceptionWindow]] {
        var porPacote: [String: [ExceptionWindow]] = [:]
        for (pacote, faixa) in encoded.compactMap(ScheduleExceptions.decode) where blocked.contains(pacote) {
            var faixas = porPacote[pacote] ?? []
            if !faixas.contains(faixa), faixas.count < ScheduleExceptions.maxWindowsPerApp {
                faixas.append(faixa)
            }
            porPacote[pacote] = faixas
        }
        return porPacote
    }
}
