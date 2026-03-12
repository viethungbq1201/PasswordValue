import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:securevault/services/crypto_service.dart';
import 'package:securevault/utils/theme.dart';

class PasswordGeneratorWidget extends StatefulWidget {
  const PasswordGeneratorWidget({super.key});

  @override
  State<PasswordGeneratorWidget> createState() => _PasswordGeneratorWidgetState();
}

class _PasswordGeneratorWidgetState extends State<PasswordGeneratorWidget> {
  final _crypto = CryptoService();
  String _password = '';
  double _length = 20;
  bool _uppercase = true;
  bool _lowercase = true;
  bool _numbers = true;
  bool _symbols = true;

  @override
  void initState() {
    super.initState();
    _generate();
  }

  void _generate() {
    setState(() {
      _password = _crypto.generatePassword(
        length: _length.toInt(),
        uppercase: _uppercase,
        lowercase: _lowercase,
        numbers: _numbers,
        symbols: _symbols,
      );
    });
  }

  Color _getStrengthColor() {
    if (_length < 10) return SecureVaultTheme.errorRed;
    if (_length < 16) return SecureVaultTheme.warningAmber;
    return SecureVaultTheme.successGreen;
  }

  String _getStrengthLabel() {
    if (_length < 10) return 'Weak';
    if (_length < 16) return 'Fair';
    if (_length < 24) return 'Strong';
    return 'Very Strong';
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Handle
          Center(
            child: Container(
              width: 40, height: 4,
              decoration: BoxDecoration(
                color: SecureVaultTheme.textSecondary.withOpacity(0.3),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 20),

          Text('Password Generator', style: Theme.of(context).textTheme.titleLarge?.copyWith(
            fontWeight: FontWeight.w600,
          )),
          const SizedBox(height: 24),

          // Generated password
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: SecureVaultTheme.primaryDark,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: _getStrengthColor().withOpacity(0.3)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    _password,
                    style: const TextStyle(fontSize: 18, fontFamily: 'monospace', letterSpacing: 1),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.copy),
                  onPressed: () {
                    Clipboard.setData(ClipboardData(text: _password));
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Password copied')),
                    );
                  },
                ),
                IconButton(
                  icon: const Icon(Icons.refresh),
                  onPressed: _generate,
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),

          // Strength indicator
          Row(
            children: [
              Expanded(
                child: LinearProgressIndicator(
                  value: (_length / 40).clamp(0.0, 1.0),
                  backgroundColor: SecureVaultTheme.textSecondary.withOpacity(0.2),
                  valueColor: AlwaysStoppedAnimation(_getStrengthColor()),
                ),
              ),
              const SizedBox(width: 12),
              Text(_getStrengthLabel(), style: TextStyle(
                color: _getStrengthColor(), fontWeight: FontWeight.w600, fontSize: 13)),
            ],
          ),
          const SizedBox(height: 24),

          // Length slider
          Row(
            children: [
              const Text('Length:'),
              Expanded(
                child: Slider(
                  value: _length,
                  min: 4,
                  max: 40,
                  divisions: 36,
                  label: _length.toInt().toString(),
                  activeColor: SecureVaultTheme.primaryBlue,
                  onChanged: (v) {
                    _length = v;
                    _generate();
                  },
                ),
              ),
              SizedBox(
                width: 32,
                child: Text(_length.toInt().toString(),
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontWeight: FontWeight.w600)),
              ),
            ],
          ),
          const SizedBox(height: 8),

          // Character options
          Wrap(
            spacing: 8,
            children: [
              FilterChip(
                label: const Text('A-Z'),
                selected: _uppercase,
                onSelected: (v) { _uppercase = v; _generate(); },
                selectedColor: SecureVaultTheme.primaryBlue.withOpacity(0.3),
              ),
              FilterChip(
                label: const Text('a-z'),
                selected: _lowercase,
                onSelected: (v) { _lowercase = v; _generate(); },
                selectedColor: SecureVaultTheme.primaryBlue.withOpacity(0.3),
              ),
              FilterChip(
                label: const Text('0-9'),
                selected: _numbers,
                onSelected: (v) { _numbers = v; _generate(); },
                selectedColor: SecureVaultTheme.primaryBlue.withOpacity(0.3),
              ),
              FilterChip(
                label: const Text('!@#\$'),
                selected: _symbols,
                onSelected: (v) { _symbols = v; _generate(); },
                selectedColor: SecureVaultTheme.primaryBlue.withOpacity(0.3),
              ),
            ],
          ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }
}
