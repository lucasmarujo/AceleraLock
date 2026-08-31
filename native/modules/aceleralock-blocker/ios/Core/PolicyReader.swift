import Foundation

struct RawPolicy {
    let blockedPackages: [String]
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
        return .loaded(BlockPolicy(blockedPackages: Set(parsed.blockedPackages)))
    }
}
