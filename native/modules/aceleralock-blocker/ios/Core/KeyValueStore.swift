import Foundation

protocol KeyValueStore {
    func getLong(_ key: String, fallback: Int64) -> Int64
    func putLong(_ key: String, value: Int64)
    func getInt(_ key: String, fallback: Int32) -> Int32
    func putInt(_ key: String, value: Int32)
    func getString(_ key: String) -> String?
    func putString(_ key: String, value: String?)
}

final class UserDefaultsStore: KeyValueStore {
    private let defaults: UserDefaults

    init(suiteName: String) {
        guard let defaults = UserDefaults(suiteName: suiteName) else {
            fatalError("App Group \(suiteName) nao configurado")
        }
        self.defaults = defaults
    }

    func getLong(_ key: String, fallback: Int64) -> Int64 {
        defaults.object(forKey: key) != nil ? Int64(defaults.integer(forKey: key)) : fallback
    }

    func putLong(_ key: String, value: Int64) {
        defaults.set(value, forKey: key)
    }

    func getInt(_ key: String, fallback: Int32) -> Int32 {
        defaults.object(forKey: key) != nil ? Int32(defaults.integer(forKey: key)) : fallback
    }

    func putInt(_ key: String, value: Int32) {
        defaults.set(value, forKey: key)
    }

    func getString(_ key: String) -> String? {
        defaults.string(forKey: key)
    }

    func putString(_ key: String, value: String?) {
        if let value {
            defaults.set(value, forKey: key)
        } else {
            defaults.removeObject(forKey: key)
        }
    }
}
