import Foundation

extension AtlasStore {
    /// Keep sharing usable while a newly configured custom domain awaits DNS.
    func resolveShareDomain() async {
        guard let preferred=URL(string:Bundle.main.object(forInfoDictionaryKey:"AtlasWebURL") as? String ?? ""),
              let host=preferred.host,let url=URL(string:"https://\(host)/.well-known/apple-app-site-association") else { return }
        do {
            let (data,response)=try await URLSession.shared.data(for:URLRequest(url:url,cachePolicy:.reloadIgnoringLocalCacheData,timeoutInterval:8))
            guard (response as? HTTPURLResponse)?.statusCode == 200,
                  let root=try JSONSerialization.jsonObject(with:data) as? [String:Any],
                  let links=root["applinks"] as? [String:Any],let details=links["details"] as? [[String:Any]] else { return }
            let appID="\(Bundle.main.object(forInfoDictionaryKey:"AtlasAppleTeam") as? String ?? "").\(Bundle.main.bundleIdentifier ?? "")"
            if details.contains(where:{ ($0["appIDs"] as? [String])?.contains(appID) == true || $0["appID"] as? String == appID }) { shareBaseOverride=preferred }
        } catch { /* Historical content and the configured fallback work offline. */ }
    }
}
