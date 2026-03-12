import 'package:flutter/services.dart';
import 'package:securevault/models/vault_item.dart';
import 'package:securevault/services/vault_service.dart';

class AutofillService {
  static const MethodChannel _channel = MethodChannel('com.securevault/autofill');
  
  final VaultService _vaultService;

  AutofillService(this._vaultService) {
    _channel.setMethodCallHandler(_handleMethodCall);
  }

  Future<dynamic> _handleMethodCall(MethodCall call) async {
    switch (call.method) {
      case 'getMatchingCredentials':
        final String domain = call.arguments['domain'];
        return _getMatchingCredentials(domain);
      case 'saveCredential':
        final Map<String, dynamic> data = Map<String, dynamic>.from(call.arguments);
        return _saveCredential(data);
      default:
        throw MissingPluginException();
    }
  }

  List<Map<String, String>> _getMatchingCredentials(String domain) {
    final List<VaultItem> items = _vaultService.items;
    final List<Map<String, String>> matches = [];

    for (var item in items) {
      if (item.type == 'LOGIN' && item.website != null) {
        if (item.website!.toLowerCase().contains(domain.toLowerCase())) {
          matches.add({
            'username': item.username ?? '',
            'password': item.password ?? '',
            'name': item.name,
          });
        }
      }
    }
    return matches;
  }

  Future<bool> _saveCredential(Map<String, dynamic> data) async {
    try {
      final newItem = VaultItem(
        id: '',
        name: data['domain'],
        type: 'LOGIN',
        website: data['domain'],
        username: data['username'],
        password: data['password'],
        favorite: false,
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );
      await _vaultService.addItem(newItem);
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
