import Foundation

struct BlockPolicy: Codable {
    var blockedPackages: Set<String>

    init(blockedPackages: Set<String> = []) {
        self.blockedPackages = blockedPackages
    }
}
