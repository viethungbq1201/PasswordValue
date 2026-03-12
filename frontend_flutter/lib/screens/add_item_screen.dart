import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:securevault/models/vault_item.dart';
import 'package:securevault/services/auth_service.dart';
import 'package:securevault/services/vault_service.dart';
import 'package:securevault/services/crypto_service.dart';
import 'package:securevault/utils/theme.dart';

class AddItemScreen extends StatefulWidget {
  const AddItemScreen({super.key});

  @override
  State<AddItemScreen> createState() => _AddItemScreenState();
}

class _AddItemScreenState extends State<AddItemScreen> {
  VaultItemType _selectedType = VaultItemType.login;
  final _nameController = TextEditingController();
  final _websiteController = TextEditingController();
  final _usernameController = TextEditingController();
  final _passwordController = TextEditingController();
  final _notesController = TextEditingController();
  final _cardNumberController = TextEditingController();
  final _cardHolderController = TextEditingController();
  final _cardExpiryController = TextEditingController();
  final _cardCvvController = TextEditingController();
  final _otpSecretController = TextEditingController();
  bool _favorite = false;
  bool _saving = false;

  @override
  void dispose() {
    _nameController.dispose();
    _websiteController.dispose();
    _usernameController.dispose();
    _passwordController.dispose();
    _notesController.dispose();
    _cardNumberController.dispose();
    _cardHolderController.dispose();
    _cardExpiryController.dispose();
    _cardCvvController.dispose();
    _otpSecretController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_nameController.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Name is required')),
      );
      return;
    }

    setState(() => _saving = true);

    final item = VaultItem(
      type: _selectedType,
      favorite: _favorite,
      name: _nameController.text,
      website: _websiteController.text,
      username: _usernameController.text,
      password: _passwordController.text,
      notes: _notesController.text,
      cardNumber: _cardNumberController.text,
      cardHolder: _cardHolderController.text,
      cardExpiry: _cardExpiryController.text,
      cardCvv: _cardCvvController.text,
      otpSecret: _otpSecretController.text,
    );

    final auth = context.read<AuthService>();
    final vault = context.read<VaultService>();
    final success = await vault.createItem(auth.token!, item);

    if (mounted) {
      setState(() => _saving = false);
      if (success) {
        Navigator.pop(context);
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to save item')),
        );
      }
    }
  }

  void _generatePassword() {
    final password = CryptoService().generatePassword();
    _passwordController.text = password;
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Add Item'),
        actions: [
          TextButton(
            onPressed: _saving ? null : _save,
            child: _saving
              ? const SizedBox(width: 20, height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2))
              : const Text('SAVE', style: TextStyle(fontWeight: FontWeight.w600)),
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
              // Type selector
              Text('Item Type', style: TextStyle(
                color: SecureVaultTheme.textSecondary, fontSize: 12, fontWeight: FontWeight.w500)),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                children: VaultItemType.values.map((type) {
                  final selected = _selectedType == type;
                  return ChoiceChip(
                    label: Text(type.name.toUpperCase()),
                    selected: selected,
                    selectedColor: SecureVaultTheme.primaryBlue,
                    onSelected: (_) => setState(() => _selectedType = type),
                  );
                }).toList(),
              ),
              const SizedBox(height: 24),

              // Name
              TextFormField(
                controller: _nameController,
                decoration: const InputDecoration(labelText: 'Name *'),
              ),
              const SizedBox(height: 16),

              // Favorite toggle
              SwitchListTile(
                title: const Text('Favorite'),
                value: _favorite,
                onChanged: (v) => setState(() => _favorite = v),
                activeColor: SecureVaultTheme.warningAmber,
                contentPadding: EdgeInsets.zero,
              ),
              const SizedBox(height: 8),

              // Type-specific fields
              ..._buildTypeFields(),

              // Notes (all types)
              const SizedBox(height: 16),
              TextFormField(
                controller: _notesController,
                decoration: const InputDecoration(labelText: 'Notes'),
                maxLines: 4,
              ),
            ],
          ),
        ),
      ),
    );
  }

  List<Widget> _buildTypeFields() {
    switch (_selectedType) {
      case VaultItemType.login:
        return [
          TextFormField(
            controller: _websiteController,
            decoration: const InputDecoration(labelText: 'Website'),
          ),
          const SizedBox(height: 16),
          TextFormField(
            controller: _usernameController,
            decoration: const InputDecoration(labelText: 'Username'),
          ),
          const SizedBox(height: 16),
          TextFormField(
            controller: _passwordController,
            decoration: InputDecoration(
              labelText: 'Password',
              suffixIcon: IconButton(
                icon: const Icon(Icons.auto_fix_high),
                tooltip: 'Generate Password',
                onPressed: _generatePassword,
              ),
            ),
            obscureText: true,
          ),
        ];
      case VaultItemType.card:
        return [
          TextFormField(
            controller: _cardNumberController,
            decoration: const InputDecoration(labelText: 'Card Number'),
            keyboardType: TextInputType.number,
          ),
          const SizedBox(height: 16),
          TextFormField(
            controller: _cardHolderController,
            decoration: const InputDecoration(labelText: 'Card Holder'),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: TextFormField(
                  controller: _cardExpiryController,
                  decoration: const InputDecoration(labelText: 'Expiry (MM/YY)'),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: TextFormField(
                  controller: _cardCvvController,
                  decoration: const InputDecoration(labelText: 'CVV'),
                  keyboardType: TextInputType.number,
                  obscureText: true,
                ),
              ),
            ],
          ),
        ];
      case VaultItemType.otp:
        return [
          TextFormField(
            controller: _otpSecretController,
            decoration: const InputDecoration(labelText: 'OTP Secret Key'),
          ),
        ];
      case VaultItemType.secureNote:
      case VaultItemType.identity:
        return []; // Notes field is always shown
    }
  }
}
