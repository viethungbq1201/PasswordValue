import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:securevault/services/auth_service.dart';
import 'package:securevault/services/vault_service.dart';
import 'package:securevault/utils/theme.dart';
import 'package:securevault/screens/login_screen.dart';
import 'package:securevault/screens/vault_dashboard.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const SecureVaultApp());
}

class SecureVaultApp extends StatelessWidget {
  const SecureVaultApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthService()),
        ChangeNotifierProvider(create: (_) => VaultService()),
      ],
      child: Consumer<AuthService>(
        builder: (context, auth, _) {
          return MaterialApp(
            title: 'SecureVault',
            debugShowCheckedModeBanner: false,
            theme: SecureVaultTheme.lightTheme,
            darkTheme: SecureVaultTheme.darkTheme,
            themeMode: ThemeMode.dark,
            home: auth.isAuthenticated
                ? const VaultDashboard()
                : const LoginScreen(),
          );
        },
      ),
    );
  }
}
