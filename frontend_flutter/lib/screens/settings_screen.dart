import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:securevault/services/auth_service.dart';
import 'package:securevault/services/vault_service.dart';
import 'package:securevault/utils/theme.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import 'dart:io';
import 'dart:convert';
import 'package:securevault/services/crypto_service.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();

    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Account section
          _buildSectionHeader(context, 'Account'),
          Card(
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.email_outlined),
                  title: const Text('Email'),
                  subtitle: Text(auth.email ?? ''),
                ),
                const Divider(height: 1),
                ListTile(
                  leading: const Icon(Icons.fingerprint),
                  title: const Text('Biometric Unlock'),
                  trailing: Switch(
                    value: auth.biometricEnabled,
                    onChanged: (v) {
                      auth.setBiometricEnabled(v);
                    },
                    activeColor: SecureVaultTheme.primaryBlue,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // Security section
          _buildSectionHeader(context, 'Security'),
          Card(
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.timer_outlined),
                  title: const Text('Auto-lock Timer'),
                  subtitle: const Text('5 minutes'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => _showAutoLockDialog(context),
                ),
                ListTile(
                  leading: const Icon(Icons.file_download_outlined),
                  title: const Text('Export Vault'),
                  subtitle: const Text('Export all data to an encrypted file'),
                  onTap: () => _showExportDialog(context),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // Sync section
          _buildSectionHeader(context, 'Sync'),
          Card(
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.sync),
                  title: const Text('Sync Now'),
                  onTap: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Syncing...')),
                    );
                  },
                ),
                const Divider(height: 1),
                const ListTile(
                  leading: Icon(Icons.devices),
                  title: Text('Registered Devices'),
                  trailing: Icon(Icons.chevron_right),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // About section
          _buildSectionHeader(context, 'About'),
          Card(
            child: Column(
              children: [
                const ListTile(
                  leading: Icon(Icons.info_outline),
                  title: Text('SecureVault'),
                  subtitle: Text('Version 1.0.0'),
                ),
                const Divider(height: 1),
                const ListTile(
                  leading: Icon(Icons.shield_outlined),
                  title: Text('Zero-Knowledge Architecture'),
                  subtitle: Text('Your vault is encrypted on your device. The server never has access to your data.'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // Logout
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              icon: const Icon(Icons.logout, color: SecureVaultTheme.errorRed),
              label: const Text('Log Out', style: TextStyle(color: SecureVaultTheme.errorRed)),
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: SecureVaultTheme.errorRed),
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
              onPressed: () async {
                await auth.logout();
                if (context.mounted) {
                  Navigator.of(context).popUntil((route) => route.isFirst);
                }
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionHeader(BuildContext context, String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(title, style: TextStyle(
        color: SecureVaultTheme.textSecondary,
        fontSize: 13,
        fontWeight: FontWeight.w600,
        letterSpacing: 0.5,
      )),
    );
  }

  void _showAutoLockDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Auto-lock Timer'),
        content: const Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Select how long to wait before automatically locking the vault.'),
            // Simplification: just show a placeholder for now
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  void _showExportDialog(BuildContext context) {
    final passwordController = TextEditingController();
    bool isExporting = false;

    showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setState) => AlertDialog(
          title: const Text('Export Vault'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('This will export all your vault items into an encrypted file protected by your master password.'),
              const SizedBox(height: 16),
              TextField(
                controller: passwordController,
                obscureText: true,
                decoration: const InputDecoration(
                  labelText: 'Confirm Master Password',
                  border: OutlineInputBorder(),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: isExporting ? null : () => Navigator.pop(context),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: isExporting
                  ? null
                  : () async {
                      if (passwordController.text.isEmpty) return;
                      setState(() => isExporting = true);
                      await _handleExport(context, passwordController.text);
                      if (context.mounted) Navigator.pop(context);
                    },
              child: isExporting
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Text('Export'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _handleExport(BuildContext context, String password) async {
    final auth = Provider.of<AuthService>(context, listen: false);
    final vault = Provider.of<VaultService>(context, listen: false);
    final crypto = CryptoService();

    try {
      // 1. Verify/Derive key
      await crypto.deriveKey(password, auth.email ?? '');

      // 2. Prepare data
      final items = vault.getAllItems();
      final List<Map<String, dynamic>> exportData = items.map((item) => {
        'id': item.id,
        'type': item.type.name,
        'name': item.name,
        'website': item.website,
        'username': item.username,
        'password': item.password,
        'notes': item.notes,
        'favorite': item.favorite,
        'folderId': item.folderId,
      }).toList();

      final exportWrapper = {
        'version': '1.0',
        'exportedAt': DateTime.now().toIso8601String(),
        'items': exportData,
      };

      // 3. Encrypt the whole JSON blob
      final encryptedBlob = await crypto.encrypt(exportWrapper);

      // 4. Save to temporary file
      final tempDir = await getTemporaryDirectory();
      final file = File('${tempDir.path}/SecureVault_Export_${DateTime.now().millisecondsSinceEpoch}.json');
      await file.writeAsString(jsonEncode({
        'data': encryptedBlob,
        'hint': 'AES-256-GCM encrypted file. Decrypt using SecureVault.',
      }));

      // 5. Share file
      await Share.shareXFiles([XFile(file.path)], text: 'SecureVault Encrypted Export');

      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Vault exported successfully')),
        );
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Export failed: ${e.toString()}'), backgroundColor: SecureVaultTheme.errorRed),
        );
      }
    }
  }
}
