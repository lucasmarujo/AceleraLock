import Foundation

enum SiteMatcher {
    static func hostOf(_ texto: String) -> String? {
        let limpo = texto.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if limpo.rangeOfCharacter(from: .whitespacesAndNewlines) != nil {
            return nil
        }
        var host = limpo
        if let esquema = host.range(of: "^[a-z][a-z0-9+.-]*://", options: .regularExpression) {
            host.removeSubrange(esquema)
        }
        for separador in ["/", "?", "#"] {
            host = host.components(separatedBy: separador).first ?? ""
        }
        host = host.components(separatedBy: "@").last ?? ""
        host = host.components(separatedBy: ":").first ?? ""
        if host.hasPrefix("www.") {
            host.removeFirst(4)
        }
        let valido = host.range(
            of: "^([a-z0-9]([a-z0-9-]*[a-z0-9])?\\.)+[a-z0-9]([a-z0-9-]*[a-z0-9])?$",
            options: .regularExpression
        ) != nil
        return valido ? host : nil
    }

    static func blocks(_ host: String, _ domains: Set<String>) -> Bool {
        domains.contains { host == $0 || host.hasSuffix(".\($0)") }
    }
}
