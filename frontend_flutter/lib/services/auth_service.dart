import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:securevault/services/crypto_service.dart';
import 'package:securevault/utils/constants.dart';

class AuthService extends ChangeNotifier {
  String? _token;
  String? _userId;
  String? _email;
  bool _isLoading = false;

  final _storage = const FlutterSecureStorage();
  final _cryptoService = CryptoService();

  bool get isAuthenticated => _token != null;
  bool get isLoading => _isLoading;
  String? get token => _token;
  String? get userId => _userId;
  String? get email => _email;

  /// Try to restore session from secure storage.
  Future<void> tryAutoLogin() async {
    _token = await _storage.read(key: 'jwt_token');
    _userId = await _storage.read(key: 'user_id');
    _email = await _storage.read(key: 'email');

    if (_token != null) {
      notifyListeners();
    }
  }

  /// Register a new user.
  Future<String?> register(String email, String masterPassword) async {
    _isLoading = true;
    notifyListeners();

    try {
      final response = await http.post(
        Uri.parse(ApiConstants.register),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'email': email,
          'masterPassword': masterPassword,
        }),
      );

      if (response.statusCode == 201) {
        final data = jsonDecode(response.body);
        await _handleAuthSuccess(data, email, masterPassword);
        return null; // success
      } else {
        final error = jsonDecode(response.body);
        return error['error'] ?? 'Registration failed';
      }
    } catch (e) {
      return 'Connection error: ${e.toString()}';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Login with email and master password.
  Future<String?> login(String email, String masterPassword) async {
    _isLoading = true;
    notifyListeners();

    try {
      final response = await http.post(
        Uri.parse(ApiConstants.login),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'email': email,
          'masterPassword': masterPassword,
        }),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        await _handleAuthSuccess(data, email, masterPassword);
        return null; // success
      } else {
        return 'Invalid email or password';
      }
    } catch (e) {
      return 'Connection error: ${e.toString()}';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> _handleAuthSuccess(
      Map<String, dynamic> data, String email, String masterPassword) async {
    _token = data['token'];
    _userId = data['userId'];
    _email = data['email'];

    // Store session
    await _storage.write(key: 'jwt_token', value: _token);
    await _storage.write(key: 'user_id', value: _userId);
    await _storage.write(key: 'email', value: _email);

    // Derive encryption key from master password
    await _cryptoService.deriveKey(masterPassword, email);
  }

  /// Logout and clear all stored data.
  Future<void> logout() async {
    _token = null;
    _userId = null;
    _email = null;
    _cryptoService.clearKey();

    await _storage.deleteAll();
    notifyListeners();
  }
}
