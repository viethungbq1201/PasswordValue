class ApiConstants {
  static const String baseUrl = 'https://passwordvalue-production.up.railway.app/api';

  // Auth
  static const String register = '$baseUrl/auth/register';
  static const String login = '$baseUrl/auth/login';

  // Vault
  static const String vault = '$baseUrl/vault';
  static const String vaultFavorites = '$baseUrl/vault/favorites';
  static const String vaultTrash = '$baseUrl/vault/trash';

  // Folders
  static const String folders = '$baseUrl/folders';

  // Sync
  static const String syncUpload = '$baseUrl/sync/upload';
  static const String syncDownload = '$baseUrl/sync/download';
  static const String syncFull = '$baseUrl/sync/full';

  // Health
  static const String health = '$baseUrl/health';
}
