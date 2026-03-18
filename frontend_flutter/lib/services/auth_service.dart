import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:securevault/services/crypto_service.dart';
import 'package:securevault/utils/constants.dart';
import 'package:local_auth/local_auth.dart';

class AuthService extends ChangeNotifier {
  String? _token;
  String? _userId;
  String? _email;
  bool _isLoading = false;
  bool _biometricEnabled = false;

  final _storage = const FlutterSecureStorage();
  final _cryptoService = CryptoService();
  final _localAuth = LocalAuthentication();

  bool get isAuthenticated => _token != null;
  bool get isLoading => _isLoading;
  String? get token => _token;
  String? get userId => _userId;
  String? get email => _email;
  bool get biometricEnabled => _biometricEnabled;

  /// Try to restore session from secure storage.
  Future<void> tryAutoLogin() async {
    _token = await _storage.read(key: 'jwt_token');
    _userId = await _storage.read(key: 'user_id');
    _email = await _storage.read(key: 'email');
    _biometricEnabled = (await _storage.read(key: 'biometric_enabled')) == 'true';
    final storedKey = await _storage.read(key: 'sv_master_key');

    if (_token != null && storedKey != null && _biometricEnabled) {
      bool canCheckBiometrics = await _localAuth.canCheckBiometrics;
      bool isDeviceSupported = await _localAuth.isDeviceSupported();

      bool didAuthenticate = false;
      if (canCheckBiometrics || isDeviceSupported) {
        try {
          didAuthenticate = await _localAuth.authenticate(
            localizedReason: 'Please authenticate to unlock SecureVault',
            options: const AuthenticationOptions(
              stickyAuth: true,
              biometricOnly: false,
            ),
          );
        } catch (e) {
          debugPrint('Biometric error: $e');
        }
      } else {
        // Fallback for devices without biometric hardware, allow token login
        didAuthenticate = true;
      }

      if (didAuthenticate) {
        _cryptoService.setMasterKeyBase64(storedKey);
        notifyListeners();
      } else {
        // If they cancel or fail biometrics, logout
        await logout();
      }
    } else {
        // If partial data, clean up
        if (_token != null) await logout();
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
    
    // Save the derived key securely for biometric auto-login
    if (_cryptoService.masterKeyBase64 != null) {
      await _storage.write(key: 'sv_master_key', value: _cryptoService.masterKeyBase64);
    }
  }

  /// Logout and clear all stored data.
  Future<void> logout() async {
    _token = null;
    _userId = null;
    _email = null;
    _cryptoService.clearKey();

    await _storage.deleteAll();
    _biometricEnabled = false;
    notifyListeners();
  }

  /// Toggle biometric unlock.
  Future<void> setBiometricEnabled(bool enabled) async {
    _biometricEnabled = enabled;
    await _storage.write(key: 'biometric_enabled', value: enabled.toString());
    notifyListeners();
  }
}
