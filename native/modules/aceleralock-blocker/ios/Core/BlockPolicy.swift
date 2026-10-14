import Foundation

/// Espelho de `BlockPolicy.kt`: lista de alvos, modo restrito, sites e horarios
/// livres por pacote (so de pacote que esta na lista).
struct BlockPolicy: Codable {
    var blockedPackages: Set<String>
    var restricted: Bool
    var blockedDomains: Set<String>
    var exceptions: [String: [ExceptionWindow]]

    init(
        blockedPackages: Set<String> = [],
        restricted: Bool = false,
        blockedDomains: Set<String> = [],
        exceptions: [String: [ExceptionWindow]] = [:]
    ) {
        self.blockedPackages = blockedPackages
        self.restricted = restricted
        self.blockedDomains = blockedDomains
        self.exceptions = exceptions
    }

    /// Troca a lista de alvos e descarta as faixas de quem saiu dela.
    func withBlockedPackages(_ packages: Set<String>) -> BlockPolicy {
        var copia = self
        copia.blockedPackages = packages
        copia.exceptions = exceptions.filter { packages.contains($0.key) }
        return copia
    }

    /// `nil` para app fora da lista ou faixa invalida, como o `require` do Kotlin.
    func withExceptions(_ packageName: String, _ windows: [ExceptionWindow]) -> BlockPolicy? {
        guard blockedPackages.contains(packageName),
              let validas = ScheduleExceptions.sanitize(windows) else { return nil }
        var copia = self
        copia.exceptions[packageName] = validas.isEmpty ? nil : validas
        return copia
    }
}
