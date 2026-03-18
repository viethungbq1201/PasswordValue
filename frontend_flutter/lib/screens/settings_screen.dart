import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:securevault/services/auth_service.dart';
import 'package:securevault/utils/theme.dart';

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
                const Divider(height: 1),
                ListTile(
                  leading: const Icon(Icons.lock_reset),
                  title: const Text('Lock Vault'),
                  onTap: () async {
                    await auth.logout();
                  },
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
      builder: (_) => AlertDialog(
        title: const Text('Auto-lock Timer'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (final option in ['Immediately', '1 minute', '5 minutes', '15 minutes', '1 hour', 'Never'])
              RadioListTile<String>(
                value: option,
                groupValue: '5 minutes',
                title: Text(option),
                onChanged: (v) => Navigator.pop(context),
              ),
          ],
        ),
      ),
    );
  }
}
