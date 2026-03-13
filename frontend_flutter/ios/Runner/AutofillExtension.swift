import AuthenticationServices
import Flutter

/**
 * SecureVault iOS AutoFill Extension.
 *
 * Implements ASCredentialProviderViewController for iOS Password AutoFill.
 * Supports Associated Domains via webcredentials: capability.
 *
 * Setup required:
 * 1. Add a new Target in Xcode: AutoFill Credential Provider Extension
 * 2. Enable "AutoFill Credential Provider" capability
 * 3. Configure Associated Domains: webcredentials:yourdomain.com
 * 4. Host apple-app-site-association file on the domain
 * 5. Set up shared App Group for FlutterEngine data sharing
 */
class CredentialProviderViewController: ASCredentialProviderViewController {
    
    private let channelName = "com.securevault/autofill"
    private var flutterEngine: FlutterEngine?
    
    override func viewDidLoad() {
        super.viewDidLoad()
        // Initialize headless FlutterEngine for data access
        initFlutterEngine()
    }
    
    private func initFlutterEngine() {
        let engine = FlutterEngine(name: "securevault_autofill")
        engine.run(withEntrypoint: "autofillMain")
        flutterEngine = engine
    }
    
    /// Called when iOS presents the credential list for Password AutoFill
    override func prepareCredentialList(for serviceIdentifiers: [ASCredentialServiceIdentifier]) {
        guard let engine = flutterEngine else {
            self.extensionContext.cancelRequest(withError: NSError(
                domain: "SecureVault", code: 0,
                userInfo: [NSLocalizedDescriptionKey: "Flutter engine not initialized"]
            ))
            return
        }
        
        let channel = FlutterMethodChannel(name: channelName, binaryMessenger: engine.binaryMessenger)
        
        // Extract domains from service identifiers
        // ASCredentialServiceIdentifier.type can be .domain or .URL
        var domain = ""
        var fullUrl = ""
        
        for identifier in serviceIdentifiers {
            switch identifier.type {
            case .domain:
                domain = identifier.identifier
            case .URL:
                fullUrl = identifier.identifier
                // Extract domain from URL
                if let url = URL(string: identifier.identifier) {
                    domain = url.host ?? identifier.identifier
                }
            @unknown default:
                domain = identifier.identifier
            }
        }
        
        let args: [String: Any] = [
            "domain": domain,
            "fullUrl": fullUrl
        ]
        
        channel.invokeMethod("getMatchingCredentials", arguments: args) { [weak self] (result) in
            guard let self = self else { return }
            
            if let credentials = result as? [[String: String]] {
                // Build credential identities for the QuickType bar
                var identities: [ASPasswordCredentialIdentity] = []
                
                for cred in credentials {
                    let username = cred["username"] ?? ""
                    let name = cred["name"] ?? domain
                    
                    let serviceId = ASCredentialServiceIdentifier(
                        identifier: domain,
                        type: .domain
                    )
                    
                    let identity = ASPasswordCredentialIdentity(
                        serviceIdentifier: serviceId,
                        user: username.isEmpty ? name : username,
                        recordIdentifier: cred["id"]
                    )
                    identities.append(identity)
                }
                
                // Register identities for QuickType bar suggestions
                ASCredentialIdentityStore.shared.saveCredentialIdentities(identities) { (success, error) in
                    // Identities saved for QuickType bar
                }
            }
            
            // Cancel the request since we're just populating, not providing a credential
            self.extensionContext.cancelRequest(withError: NSError(
                domain: ASExtensionErrorDomain,
                code: ASExtensionError.userCanceled.rawValue
            ))
        }
    }
    
    /// Called when user selects a credential from the QuickType bar
    override func provideCredentialWithoutUserInteraction(for credentialIdentity: ASPasswordCredentialIdentity) {
        guard let engine = flutterEngine else {
            self.extensionContext.cancelRequest(withError: NSError(
                domain: "SecureVault", code: 0,
                userInfo: [NSLocalizedDescriptionKey: "Flutter engine not initialized"]
            ))
            return
        }
        
        let channel = FlutterMethodChannel(name: channelName, binaryMessenger: engine.binaryMessenger)
        let domain = credentialIdentity.serviceIdentifier.identifier
        
        channel.invokeMethod("getMatchingCredentials", arguments: ["domain": domain]) { [weak self] (result) in
            guard let self = self else { return }
            
            if let credentials = result as? [[String: String]],
               let cred = credentials.first {
                let username = cred["username"] ?? ""
                let password = cred["password"] ?? ""
                
                let credential = ASPasswordCredential(user: username, password: password)
                self.extensionContext.completeRequest(
                    withSelectedCredential: credential,
                    completionHandler: nil
                )
            } else {
                self.extensionContext.cancelRequest(withError: NSError(
                    domain: ASExtensionErrorDomain,
                    code: ASExtensionError.credentialIdentityNotFound.rawValue
                ))
            }
        }
    }
}
