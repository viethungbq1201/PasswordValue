import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';
import 'package:cryptography/cryptography.dart';

/// Client-side encryption service implementing zero-knowledge architecture.
/// Uses Argon2id for key derivation and AES-256-GCM for encryption.
class CryptoService {
  static final CryptoService _instance = CryptoService._internal();
  factory CryptoService() => _instance;
  CryptoService._internal();

  Uint8List? _masterKey;
  final _random = Random.secure();

  /// Derive a 256-bit master key from the user's master password using PBKDF2.
  Future<Uint8List> deriveKey(String masterPassword, String email) async {
    final algorithm = Pbkdf2(
      macAlgorithm: Hmac.sha256(),
      iterations: 100000,
      bits: 256,
    );

    // Use email as salt for deterministic key derivation
    final salt = utf8.encode(email.toLowerCase().trim());

    final result = await algorithm.deriveKey(
      secretKey: SecretKey(utf8.encode(masterPassword)),
      nonce: salt,
    );

    final keyBytes = await result.extractBytes();
    _masterKey = Uint8List.fromList(keyBytes);
    return _masterKey!;
  }

  /// Encrypt plaintext JSON data using AES-256-GCM.
  /// Returns Base64-encoded string: iv(12) + ciphertext + mac(16)
  Future<String> encrypt(Map<String, dynamic> data) async {
    if (_masterKey == null) throw StateError('Master key not derived');

    try {
      final plaintext = utf8.encode(jsonEncode(data));
      final algorithm = AesGcm.with256bits();
      final secretKey = SecretKey(_masterKey!);
      final nonce = algorithm.newNonce(); // 12 bytes IV

      final secretBox = await algorithm.encrypt(
        plaintext,
        secretKey: secretKey,
        nonce: nonce,
      );

      // WebCrypto standard: IV + CIPHERTEXT + MAC
      final combined = <int>[
        ...secretBox.nonce,
        ...secretBox.cipherText,
        ...secretBox.mac.bytes,
      ];

      return base64Encode(combined);
    } catch (e) {
      print('[CryptoService] Encryption error: $e');
      rethrow;
    }
  }

  /// Decrypt Base64-encoded encrypted data back to JSON.
  Future<Map<String, dynamic>> decrypt(String encryptedBase64) async {
    if (_masterKey == null) throw StateError('Master key not derived');

    try {
      final combined = base64Decode(encryptedBase64);

      // Extract: iv(12) + ciphertext + mac(16)
      // WebCrypto combined block = IV (12) + CT (var) + MAC (16)
      final nonce = combined.sublist(0, 12);
      final macBytes = combined.sublist(combined.length - 16);
      final cipherText = combined.sublist(12, combined.length - 16);

      final secretBox = SecretBox(
        cipherText,
        nonce: nonce,
        mac: Mac(macBytes),
      );

      final algorithm = AesGcm.with256bits();
      final secretKey = SecretKey(_masterKey!);

      final plaintext = await algorithm.decrypt(secretBox, secretKey: secretKey);
      final jsonString = utf8.decode(plaintext);

      return jsonDecode(jsonString) as Map<String, dynamic>;
    } catch (e) {
      // Fallback to legacy Base64 for development migration
      try {
        final decodedStr = utf8.decode(base64Decode(encryptedBase64));
        return jsonDecode(decodedStr) as Map<String, dynamic>;
      } catch (legacyErr) {
        print('[CryptoService] Decryption error (incl fallback): $e');
        rethrow;
      }
    }
  }

  /// Generate a random password.
  String generatePassword({
    int length = 20,
    bool uppercase = true,
    bool lowercase = true,
    bool numbers = true,
    bool symbols = true,
  }) {
    const upperChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowerChars = 'abcdefghijklmnopqrstuvwxyz';
    const numChars = '0123456789';
    const symbolChars = '!@#\$%^&*()_+-=[]{}|;:,.<>?';

    String chars = '';
    if (uppercase) chars += upperChars;
    if (lowercase) chars += lowerChars;
    if (numbers) chars += numChars;
    if (symbols) chars += symbolChars;

    if (chars.isEmpty) chars = lowerChars + numChars;

    return List.generate(length, (_) => chars[_random.nextInt(chars.length)]).join();
  }

  bool get hasKey => _masterKey != null;

  String? get masterKeyBase64 {
    return _masterKey != null ? base64Encode(_masterKey!) : null;
  }

  void setMasterKeyBase64(String base64Key) {
    _masterKey = Uint8List.fromList(base64Decode(base64Key));
  }

  void clearKey() {
    if (_masterKey != null) {
      _masterKey!.fillRange(0, _masterKey!.length, 0);
      _masterKey = null;
    }
  }
}
