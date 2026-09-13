import Foundation

struct BlockPolicy: Codable {
    var blockedPackages: Set<String>
    var blockedDomains: Set<String>

    init(blockedPackages: Set<String> = [], blockedDomains: Set<String> = []) {
        self.blockedPackages = blockedPackages
        self.blockedDomains = blockedDomains
    }
}
