import 'dart:convert';
import 'package:flutter/services.dart';
import 'package:securevault/models/vault_item.dart';
import 'package:securevault/services/vault_service.dart';
import 'package:http/http.dart' as http;

class AutofillService {
  static const MethodChannel _channel = MethodChannel('com.securevault/autofill');
  
  final VaultService _vaultService;
  String? _authToken;

  AutofillService(this._vaultService) {
    _channel.setMethodCallHandler(_handleMethodCall);
  }

  void setAuthToken(String token) {
    _authToken = token;
  }

  Future<dynamic> _handleMethodCall(MethodCall call) async {
    switch (call.method) {
      case 'getMatchingCredentials':
        final String domain = call.arguments['domain'];
        final String? fullUrl = call.arguments['fullUrl'];
        return _getMatchingCredentials(domain, fullUrl);
      case 'saveCredential':
        final Map<String, dynamic> data = Map<String, dynamic>.from(call.arguments);
        return _saveCredential(data);
      default:
        throw MissingPluginException();
    }
  }

  /// Query the backend /api/autofill endpoint for matching credentials
  Future<List<Map<String, String>>> _getMatchingCredentials(String domain, String? fullUrl) async {
    // Try backend API first
    if (_authToken != null) {
      try {
        final uri = Uri.parse('http://localhost:8080/api/autofill')
            .replace(queryParameters: {
          'domain': domain,
          if (fullUrl != null) 'fullUrl': fullUrl,
        });

        final response = await http.get(uri, headers: {
          'Authorization': 'Bearer $_authToken',
        });

        if (response.statusCode == 200) {
          final List<dynamic> items = jsonDecode(response.body);
          final List<Map<String, String>> matches = [];
          
          for (var item in items) {
            // Items are encrypted — return encrypted data for client-side decryption
            matches.add({
              'id': item['id'] ?? '',
              'encryptedData': item['encryptedData'] != null 
                  ? base64Encode(List<int>.from(item['encryptedData'])) 
                  : '',
            });
          }
          return matches;
        }
      } catch (e) {
        // Fallback to local matching
      }
    }

    // Fallback: local matching from cached vault items
    return _getLocalMatchingCredentials(domain);
  }

  /// Local fallback matching using cached vault items
  List<Map<String, String>> _getLocalMatchingCredentials(String domain) {
    final List<VaultItem> items = _vaultService.items;
    final List<Map<String, String>> matches = [];

    for (var item in items) {
      if (item.type == VaultItemType.login && item.website != null) {
        if (_matchesDomain(item.website!, domain)) {
          matches.add({
            'username': item.username ?? '',
            'password': item.password ?? '',
            'name': item.name ?? '',
          });
        }
      }
    }
    return matches;
  }

  /// Root domain extraction (Public Suffix List approach)
  bool _matchesDomain(String storedUrl, String queryDomain) {
    final stored = _extractRootDomain(storedUrl);
    final query = _extractRootDomain(queryDomain);
    return stored == query;
  }

  String _extractRootDomain(String input) {
    var s = input.toLowerCase();
    s = s.replaceFirst(RegExp(r'^https?://'), '');
    s = s.replaceFirst(RegExp(r'^www\.'), '');
    final slashIdx = s.indexOf('/');
    if (slashIdx > 0) s = s.substring(0, slashIdx);
    
    final parts = s.split('.');
    if (parts.length <= 2) return s;

    // Check for multi-part TLDs
    const multiPartTlds = {
      'co.uk', 'co.jp', 'co.kr', 'co.in', 'co.nz', 'co.za',
      'com.au', 'com.br', 'com.cn', 'com.mx', 'com.sg', 'com.tw',
      'org.uk', 'org.au', 'net.au', 'ac.uk', 'gov.uk',
    };

    final lastTwo = '${parts[parts.length - 2]}.${parts[parts.length - 1]}';
    if (multiPartTlds.contains(lastTwo) && parts.length >= 3) {
      return '${parts[parts.length - 3]}.$lastTwo';
    }
    return '${parts[parts.length - 2]}.${parts[parts.length - 1]}';
  }

  Future<bool> _saveCredential(Map<String, dynamic> data) async {
    try {
      final newItem = VaultItem(
        type: VaultItemType.login,
        name: data['domain'],
        website: data['domain'],
        username: data['username'],
        password: data['password'],
      );
      if (_authToken == null) return false;
      await _vaultService.createItem(_authToken!, newItem);
      return true;
    } catch (e) {
      return false;
    }
  }

  Future<void> sendCredentialsToNative(String username, String password) async {
    try {
      await _channel.invokeMethod('provideAutofillDataset', {
        'username': username,
        'password': password,
      });
    } on PlatformException catch (e) {
      print("Failed to provide autofill dataset: '${e.message}'.");
    }
  }
}
