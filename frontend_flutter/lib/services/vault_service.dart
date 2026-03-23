import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:securevault/models/vault_item.dart';
import 'package:securevault/models/folder.dart';
import 'package:securevault/services/crypto_service.dart';
import 'package:securevault/utils/constants.dart';

class VaultService extends ChangeNotifier {
  List<VaultItem> _items = [];
  List<VaultItem> _trashItems = [];
  List<Folder> _folders = [];
  bool _isLoading = false;
  String? _searchQuery;

  final _cryptoService = CryptoService();

  List<VaultItem> get items => _searchQuery != null && _searchQuery!.isNotEmpty
      ? _items.where((item) =>
          (item.name?.toLowerCase().contains(_searchQuery!.toLowerCase()) ?? false) ||
          (item.website?.toLowerCase().contains(_searchQuery!.toLowerCase()) ?? false) ||
          (item.username?.toLowerCase().contains(_searchQuery!.toLowerCase()) ?? false)
      ).toList()
      : _items;

  List<VaultItem> get favorites => _items.where((i) => i.favorite).toList();
  List<VaultItem> get trashItems => _trashItems;
  List<Folder> get folders => _folders;
  bool get isLoading => _isLoading;

  List<VaultItem> getByType(VaultItemType type) =>
      _items.where((i) => i.type == type).toList();

  List<VaultItem> getByFolder(String folderId) =>
      _items.where((i) => i.folderId == folderId).toList();

  void setSearchQuery(String? query) {
    _searchQuery = query;
    notifyListeners();
  }

  /// Fetch and decrypt all vault items.
  Future<void> fetchVault(String token) async {
    _isLoading = true;
    notifyListeners();

    try {
      final response = await http.get(
        Uri.parse(ApiConstants.vault),
        headers: _authHeaders(token),
      );

      if (response.statusCode == 200) {
        final List<dynamic> data = jsonDecode(response.body);
        _items = [];
        for (final json in data) {
          final item = VaultItem.fromJson(json);
          try {
            if (item.encryptedData.isNotEmpty) {
              final decrypted = await _cryptoService.decrypt(item.encryptedData);
              item.fromDecryptedJson(decrypted);
            }
          } catch (e) {
            print('[VaultService] Decryption error for item ${item.id}: $e');
            item.name = 'Decryption Error';
          }
          _items.add(item);
        }
      }
    } catch (e) {
      print('[VaultService] Fetch error: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Get all items without search filtering.
  List<VaultItem> getAllItems() => List.unmodifiable(_items);

  /// Fetch trash items.
  Future<void> fetchTrash(String token) async {
    try {
      final response = await http.get(
        Uri.parse(ApiConstants.vaultTrash),
        headers: _authHeaders(token),
      );

      if (response.statusCode == 200) {
        final List<dynamic> data = jsonDecode(response.body);
        _trashItems = data.map((json) => VaultItem.fromJson(json)).toList();
        notifyListeners();
      }
    } catch (e) {
      // Handle error
    }
  }

  /// Fetch folders.
  Future<void> fetchFolders(String token) async {
    try {
      final response = await http.get(
        Uri.parse(ApiConstants.folders),
        headers: _authHeaders(token),
      );

      if (response.statusCode == 200) {
        final List<dynamic> data = jsonDecode(response.body);
        _folders = data.map((json) => Folder.fromJson(json)).toList();
        notifyListeners();
      }
    } catch (e) {
      // Handle error
    }
  }

  /// Create a new vault item (encrypt → upload).
  Future<bool> createItem(String token, VaultItem item) async {
    try {
      final encrypted = await _cryptoService.encrypt(item.toDecryptedJson());

      final response = await http.post(
        Uri.parse(ApiConstants.vault),
        headers: _authHeaders(token),
        body: jsonEncode({
          'type': item.type.name.toUpperCase(),
          'encryptedData': encrypted,
          'folderId': item.folderId,
          'favorite': item.favorite,
        }),
      );

      if (response.statusCode == 201) {
        await fetchVault(token);
        return true;
      }
    } catch (e) {
      // Handle error
    }
    return false;
  }

  /// Update a vault item.
  Future<bool> updateItem(String token, VaultItem item) async {
    if (item.id == null) return false;

    try {
      final encrypted = await _cryptoService.encrypt(item.toDecryptedJson());

      final response = await http.put(
        Uri.parse('${ApiConstants.vault}/${item.id}'),
        headers: _authHeaders(token),
        body: jsonEncode({
          'type': item.type.name.toUpperCase(),
          'encryptedData': encrypted,
          'folderId': item.folderId,
          'favorite': item.favorite,
        }),
      );

      if (response.statusCode == 200) {
        await fetchVault(token);
        return true;
      }
    } catch (e) {
      // Handle error
    }
    return false;
  }

  /// Soft delete (move to trash).
  Future<bool> deleteItem(String token, String itemId) async {
    try {
      final response = await http.delete(
        Uri.parse('${ApiConstants.vault}/$itemId'),
        headers: _authHeaders(token),
      );

      if (response.statusCode == 204) {
        _items.removeWhere((i) => i.id == itemId);
        notifyListeners();
        return true;
      }
    } catch (e) {
      // Handle error
    }
    return false;
  }

  /// Restore from trash.
  Future<bool> restoreItem(String token, String itemId) async {
    try {
      final response = await http.post(
        Uri.parse('${ApiConstants.vault}/$itemId/restore'),
        headers: _authHeaders(token),
      );

      if (response.statusCode == 200) {
        await fetchVault(token);
        await fetchTrash(token);
        return true;
      }
    } catch (e) {
      // Handle error
    }
    return false;
  }

  /// Create folder.
  Future<bool> createFolder(String token, String name) async {
    try {
      final response = await http.post(
        Uri.parse(ApiConstants.folders),
        headers: _authHeaders(token),
        body: jsonEncode({'name': name}),
      );

      if (response.statusCode == 201) {
        await fetchFolders(token);
        return true;
      }
    } catch (e) {
      // Handle error
    }
    return false;
  }

  Map<String, String> _authHeaders(String token) => {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer $token',
  };

  void clear() {
    _items.clear();
    _trashItems.clear();
    _folders.clear();
    _searchQuery = null;
    notifyListeners();
  }
}
