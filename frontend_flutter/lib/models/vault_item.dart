enum VaultItemType { login, secureNote, card, identity, otp }

enum UrlMatchType { domain, host, startsWith, exact }

class VaultItem {
  final String? id;
  final VaultItemType type;
  final String encryptedData;
  final String? folderId;
  final bool favorite;
  final DateTime? createdAt;
  final DateTime? updatedAt;
  final DateTime? deletedAt;
  final UrlMatchType matchType;

  // Decrypted fields (client-side only)
  String? name;
  String? website;
  String? username;
  String? password;
  String? notes;
  String? cardNumber;
  String? cardHolder;
  String? cardExpiry;
  String? cardCvv;
  String? otpSecret;

  VaultItem({
    this.id,
    required this.type,
    this.encryptedData = '',
    this.folderId,
    this.favorite = false,
    this.matchType = UrlMatchType.domain,
    this.createdAt,
    this.updatedAt,
    this.deletedAt,
    this.name,
    this.website,
    this.username,
    this.password,
    this.notes,
    this.cardNumber,
    this.cardHolder,
    this.cardExpiry,
    this.cardCvv,
    this.otpSecret,
  });

  bool get isDeleted => deletedAt != null;

  factory VaultItem.fromJson(Map<String, dynamic> json) {
    return VaultItem(
      id: json['id'],
      type: _parseType(json['type']),
      encryptedData: json['encryptedData'] ?? '',
      folderId: json['folderId'],
      favorite: json['favorite'] ?? false,
      matchType: _parseMatchType(json['matchType']),
      createdAt: json['createdAt'] != null ? DateTime.parse(json['createdAt']) : null,
      updatedAt: json['updatedAt'] != null ? DateTime.parse(json['updatedAt']) : null,
      deletedAt: json['deletedAt'] != null ? DateTime.parse(json['deletedAt']) : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      if (id != null) 'id': id,
      'type': type.name.toUpperCase(),
      'encryptedData': encryptedData,
      if (folderId != null) 'folderId': folderId,
      'favorite': favorite,
      'matchType': matchType.name.toUpperCase(),
    };
  }

  /// Convert decrypted fields to a JSON map for encryption
  Map<String, dynamic> toDecryptedJson() {
    final map = <String, dynamic>{
      'name': name ?? '',
      'type': type.name,
    };

    switch (type) {
      case VaultItemType.login:
        map['website'] = website ?? '';
        map['username'] = username ?? '';
        map['password'] = password ?? '';
        map['notes'] = notes ?? '';
        break;
      case VaultItemType.secureNote:
        map['notes'] = notes ?? '';
        break;
      case VaultItemType.card:
        map['cardNumber'] = cardNumber ?? '';
        map['cardHolder'] = cardHolder ?? '';
        map['cardExpiry'] = cardExpiry ?? '';
        map['cardCvv'] = cardCvv ?? '';
        map['notes'] = notes ?? '';
        break;
      case VaultItemType.identity:
        map['notes'] = notes ?? '';
        break;
      case VaultItemType.otp:
        map['otpSecret'] = otpSecret ?? '';
        map['notes'] = notes ?? '';
        break;
    }

    return map;
  }

  /// Populate decrypted fields from a decrypted JSON map
  void fromDecryptedJson(Map<String, dynamic> map) {
    name = map['name'] ?? '';
    notes = map['notes'] ?? '';

    switch (type) {
      case VaultItemType.login:
        website = map['website'] ?? '';
        username = map['username'] ?? '';
        password = map['password'] ?? '';
        break;
      case VaultItemType.card:
        cardNumber = map['cardNumber'] ?? '';
        cardHolder = map['cardHolder'] ?? '';
        cardExpiry = map['cardExpiry'] ?? '';
        cardCvv = map['cardCvv'] ?? '';
        break;
      case VaultItemType.otp:
        otpSecret = map['otpSecret'] ?? '';
        break;
      default:
        break;
    }
  }

  static VaultItemType _parseType(String? type) {
    switch (type?.toUpperCase()) {
      case 'LOGIN':
        return VaultItemType.login;
      case 'SECURE_NOTE':
        return VaultItemType.secureNote;
      case 'CARD':
        return VaultItemType.card;
      case 'IDENTITY':
        return VaultItemType.identity;
      case 'OTP':
        return VaultItemType.otp;
      default:
        return VaultItemType.login;
    }
  }

  static UrlMatchType _parseMatchType(String? matchType) {
    switch (matchType?.toUpperCase()) {
      case 'HOST':
        return UrlMatchType.host;
      case 'STARTS_WITH':
        return UrlMatchType.startsWith;
      case 'EXACT':
        return UrlMatchType.exact;
      default:
        return UrlMatchType.domain;
    }
  }
}
