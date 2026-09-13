import Foundation
import ManagedSettings
import FamilyControls

final class ManagedSettingsManager {
    static let shared = ManagedSettingsManager()
    private let store = ManagedSettings.ManagedSettingsStore()
    private let appGroup = "group.com.aceleralock.app"

    private static let keyTokensData = "blocked.tokens_data"
    private static let keyTokenLabels = "blocked.token_labels"
    private static let keyWebDomains = "blocked.web_domains"

    private init() {}

    func applyShields(_ selection: FamilyActivitySelection) {
        store.shield.applications = selection.applicationTokens
        store.shield.applicationCategories = .specific(selection.categoryTokens)
        saveSelection(selection)
    }

    // O match de dominio e do sistema: quem desenha a tela de bloqueio no Safari e
    // a pagina de restricao do iOS, nao um shield nosso.
    func applyWebDomains(_ domains: [String]) {
        store.webContent.blockedByFilter = domains.isEmpty
            ? nil
            : .specific(Set(domains.map { WebDomain(domain: $0) }))
        UserDefaults(suiteName: appGroup)?.set(domains, forKey: Self.keyWebDomains)
    }

    func blockedWebDomains() -> [String] {
        UserDefaults(suiteName: appGroup)?.stringArray(forKey: Self.keyWebDomains) ?? []
    }

    func removeShieldForToken(_ token: ApplicationToken) {
        var current = store.shield.applications ?? []
        current.remove(token)
        store.shield.applications = current
    }

    func clearAll() {
        store.shield.applications = nil
        store.shield.applicationCategories = nil
        store.webContent.blockedByFilter = nil
    }

    func currentSelection() -> FamilyActivitySelection? {
        guard let defaults = UserDefaults(suiteName: appGroup),
              let data = defaults.data(forKey: Self.keyTokensData) else { return nil }
        return try? JSONDecoder().decode(FamilyActivitySelection.self, from: data)
    }

    func blockedTokenIdentifiers() -> [String] {
        guard let defaults = UserDefaults(suiteName: appGroup) else { return [] }
        return defaults.stringArray(forKey: Self.keyTokenLabels) ?? []
    }

    private func saveSelection(_ selection: FamilyActivitySelection) {
        guard let defaults = UserDefaults(suiteName: appGroup) else { return }
        if let data = try? JSONEncoder().encode(selection) {
            defaults.set(data, forKey: Self.keyTokensData)
        }
        let identifiers = selection.applicationTokens.map { token in
            let data = try? JSONEncoder().encode(token)
            return data?.base64EncodedString() ?? UUID().uuidString
        }
        defaults.set(identifiers, forKey: Self.keyTokenLabels)
    }
}
