import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:securevault/models/vault_item.dart';
import 'package:securevault/services/auth_service.dart';
import 'package:securevault/services/vault_service.dart';
import 'package:securevault/utils/theme.dart';

class VaultItemDetail extends StatelessWidget {
  final VaultItem item;

  const VaultItemDetail({super.key, required this.item});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(item.name ?? 'Item Detail'),
        actions: [
          IconButton(
            icon: Icon(item.favorite ? Icons.star : Icons.star_border,
              color: item.favorite ? SecureVaultTheme.warningAmber : null),
            onPressed: () {
              // Toggle favorite
            },
          ),
          PopupMenuButton<String>(
            onSelected: (value) async {
              final auth = context.read<AuthService>();
              final vault = context.read<VaultService>();
              if (value == 'delete' && item.id != null) {
                await vault.deleteItem(auth.token!, item.id!);
                if (context.mounted) Navigator.pop(context);
              }
            },
            itemBuilder: (_) => [
              const PopupMenuItem(value: 'delete', child: Text('Move to Trash')),
            ],
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 600),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Type badge
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: SecureVaultTheme.primaryBlue.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  item.type.name.toUpperCase(),
                  style: TextStyle(
                    color: SecureVaultTheme.primaryBlue,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              const SizedBox(height: 24),

              // Fields based on type
              if (item.type == VaultItemType.login) ...[
                _buildField(context, 'Website', item.website),
                _buildField(context, 'Username', item.username, copyable: true),
                _buildPasswordField(context, item.password),
              ],
              if (item.type == VaultItemType.card) ...[
                _buildField(context, 'Card Number', item.cardNumber, copyable: true),
                _buildField(context, 'Card Holder', item.cardHolder),
                _buildField(context, 'Expiry', item.cardExpiry),
                _buildField(context, 'CVV', item.cardCvv, sensitive: true),
              ],
              if (item.type == VaultItemType.otp) ...[
                _buildField(context, 'OTP Secret', item.otpSecret, copyable: true),
              ],
              if (item.notes != null && item.notes!.isNotEmpty)
                _buildField(context, 'Notes', item.notes),

              const SizedBox(height: 24),
              if (item.createdAt != null)
                Text('Created: ${_formatDate(item.createdAt!)}',
                  style: TextStyle(color: SecureVaultTheme.textSecondary, fontSize: 12)),
              if (item.updatedAt != null)
                Text('Updated: ${_formatDate(item.updatedAt!)}',
                  style: TextStyle(color: SecureVaultTheme.textSecondary, fontSize: 12)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildField(BuildContext context, String label, String? value, {
    bool copyable = false, bool sensitive = false,
  }) {
    if (value == null || value.isEmpty) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: TextStyle(
            color: SecureVaultTheme.textSecondary, fontSize: 12, fontWeight: FontWeight.w500)),
          const SizedBox(height: 4),
          Row(
            children: [
              Expanded(
                child: Text(
                  sensitive ? '••••••••' : value,
                  style: const TextStyle(fontSize: 16),
                ),
              ),
              if (copyable)
                IconButton(
                  icon: const Icon(Icons.copy, size: 18),
                  onPressed: () {
                    Clipboard.setData(ClipboardData(text: value));
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('$label copied'), duration: const Duration(seconds: 2)),
                    );
                  },
                ),
            ],
          ),
          const Divider(),
        ],
      ),
    );
  }

  Widget _buildPasswordField(BuildContext context, String? password) {
    if (password == null || password.isEmpty) return const SizedBox.shrink();

    return StatefulBuilder(builder: (context, setState) {
      bool obscure = true;
      return Padding(
        padding: const EdgeInsets.only(bottom: 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Password', style: TextStyle(
              color: SecureVaultTheme.textSecondary, fontSize: 12, fontWeight: FontWeight.w500)),
            const SizedBox(height: 4),
            Row(
              children: [
                Expanded(
                  child: Text(
                    obscure ? '••••••••••••' : password,
                    style: const TextStyle(fontSize: 16, fontFamily: 'monospace'),
                  ),
                ),
                IconButton(
                  icon: Icon(obscure ? Icons.visibility_off : Icons.visibility, size: 18),
                  onPressed: () => setState(() => obscure = !obscure),
                ),
                IconButton(
                  icon: const Icon(Icons.copy, size: 18),
                  onPressed: () {
                    Clipboard.setData(ClipboardData(text: password));
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Password copied'), duration: Duration(seconds: 2)),
                    );
                  },
                ),
              ],
            ),
            const Divider(),
          ],
        ),
      );
    });
  }

  String _formatDate(DateTime dt) => '${dt.year}-${dt.month.toString().padLeft(2, '0')}-${dt.day.toString().padLeft(2, '0')}';
}
