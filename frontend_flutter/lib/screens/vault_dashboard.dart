import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:securevault/models/vault_item.dart';
import 'package:securevault/services/auth_service.dart';
import 'package:securevault/services/vault_service.dart';
import 'package:securevault/screens/add_item_screen.dart';
import 'package:securevault/screens/vault_item_detail.dart';
import 'package:securevault/screens/settings_screen.dart';
import 'package:securevault/utils/theme.dart';
import 'package:securevault/widgets/password_generator.dart';

class VaultDashboard extends StatefulWidget {
  const VaultDashboard({super.key});

  @override
  State<VaultDashboard> createState() => _VaultDashboardState();
}

class _VaultDashboardState extends State<VaultDashboard> {
  int _selectedNav = 0;
  final _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    final auth = context.read<AuthService>();
    final vault = context.read<VaultService>();
    if (auth.token != null) {
      await vault.fetchVault(auth.token!);
      await vault.fetchFolders(auth.token!);
    }
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<VaultItem> _getFilteredItems(VaultService vault) {
    switch (_selectedNav) {
      case 0:
        return vault.items; // All
      case 1:
        return vault.favorites; // Favorites
      case 2:
        return vault.getByType(VaultItemType.login);
      case 3:
        return vault.getByType(VaultItemType.card);
      case 4:
        return vault.getByType(VaultItemType.secureNote);
      case 5:
        return vault.getByType(VaultItemType.identity);
      case 6:
        return vault.trashItems; // Trash
      default:
        return vault.items;
    }
  }

  IconData _getItemIcon(VaultItemType type) {
    switch (type) {
      case VaultItemType.login:
        return Icons.language;
      case VaultItemType.secureNote:
        return Icons.note_outlined;
      case VaultItemType.card:
        return Icons.credit_card;
      case VaultItemType.identity:
        return Icons.person_outlined;
      case VaultItemType.otp:
        return Icons.timer_outlined;
    }
  }

  @override
  Widget build(BuildContext context) {
    final vault = context.watch<VaultService>();
    final auth = context.watch<AuthService>();
    final items = _getFilteredItems(vault);
    final isWide = MediaQuery.of(context).size.width > 800;

    return Scaffold(
      appBar: AppBar(
        title: const Text('SecureVault'),
        actions: [
          IconButton(
            icon: const Icon(Icons.password),
            tooltip: 'Password Generator',
            onPressed: () => _showPasswordGenerator(context),
          ),
          IconButton(
            icon: const Icon(Icons.settings_outlined),
            onPressed: () => Navigator.push(context,
              MaterialPageRoute(builder: (_) => const SettingsScreen())),
          ),
        ],
      ),
      body: Row(
        children: [
          // Sidebar navigation
          if (isWide) _buildSidebar(),

          // Main content
          Expanded(
            child: Column(
              children: [
                // Search bar
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: TextField(
                    controller: _searchController,
                    decoration: InputDecoration(
                      hintText: 'Search vault...',
                      prefixIcon: const Icon(Icons.search),
                      suffixIcon: _searchController.text.isNotEmpty
                        ? IconButton(
                            icon: const Icon(Icons.close),
                            onPressed: () {
                              _searchController.clear();
                              vault.setSearchQuery(null);
                            },
                          )
                        : null,
                    ),
                    onChanged: (q) => vault.setSearchQuery(q),
                  ),
                ),

                // Items list
                Expanded(
                  child: vault.isLoading
                    ? const Center(child: CircularProgressIndicator())
                    : items.isEmpty
                      ? _buildEmptyState()
                      : RefreshIndicator(
                          onRefresh: _loadData,
                          child: ListView.builder(
                            padding: const EdgeInsets.symmetric(horizontal: 16),
                            itemCount: items.length,
                            itemBuilder: (context, index) {
                              final item = items[index];
                              return _buildItemTile(item);
                            },
                          ),
                        ),
                ),
              ],
            ),
          ),
        ],
      ),
      bottomNavigationBar: isWide ? null : _buildBottomNav(),
      floatingActionButton: FloatingActionButton(
        onPressed: () => Navigator.push(context,
          MaterialPageRoute(builder: (_) => const AddItemScreen())),
        backgroundColor: SecureVaultTheme.primaryBlue,
        child: const Icon(Icons.add, color: Colors.white),
      ),
    );
  }

  Widget _buildSidebar() {
    final navItems = [
      ('All Items', Icons.apps),
      ('Favorites', Icons.star_outline),
      ('Logins', Icons.language),
      ('Cards', Icons.credit_card),
      ('Notes', Icons.note_outlined),
      ('Identities', Icons.person_outlined),
      ('Trash', Icons.delete_outline),
    ];

    return Container(
      width: 240,
      color: SecureVaultTheme.surfaceDark,
      child: Column(
        children: [
          const SizedBox(height: 16),
          ...List.generate(navItems.length, (i) {
            final (label, icon) = navItems[i];
            final selected = _selectedNav == i;
            return ListTile(
              leading: Icon(icon, color: selected ? SecureVaultTheme.primaryBlue : SecureVaultTheme.textSecondary),
              title: Text(label, style: TextStyle(
                color: selected ? Colors.white : SecureVaultTheme.textSecondary,
                fontWeight: selected ? FontWeight.w600 : FontWeight.normal,
              )),
              selected: selected,
              selectedTileColor: SecureVaultTheme.primaryBlue.withOpacity(0.15),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              onTap: () {
                setState(() => _selectedNav = i);
                if (i == 6) {
                  final auth = context.read<AuthService>();
                  context.read<VaultService>().fetchTrash(auth.token!);
                }
              },
            );
          }),
        ],
      ),
    );
  }

  Widget _buildBottomNav() {
    return BottomNavigationBar(
      currentIndex: _selectedNav.clamp(0, 4),
      onTap: (i) => setState(() => _selectedNav = i),
      type: BottomNavigationBarType.fixed,
      selectedItemColor: SecureVaultTheme.primaryBlue,
      unselectedItemColor: SecureVaultTheme.textSecondary,
      items: const [
        BottomNavigationBarItem(icon: Icon(Icons.apps), label: 'All'),
        BottomNavigationBarItem(icon: Icon(Icons.star_outline), label: 'Favorites'),
        BottomNavigationBarItem(icon: Icon(Icons.language), label: 'Logins'),
        BottomNavigationBarItem(icon: Icon(Icons.credit_card), label: 'Cards'),
        BottomNavigationBarItem(icon: Icon(Icons.delete_outline), label: 'Trash'),
      ],
    );
  }

  Widget _buildItemTile(VaultItem item) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: Container(
          width: 40, height: 40,
          decoration: BoxDecoration(
            color: SecureVaultTheme.primaryBlue.withOpacity(0.15),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(_getItemIcon(item.type), color: SecureVaultTheme.primaryBlue, size: 20),
        ),
        title: Text(
          item.name ?? 'Unknown',
          style: const TextStyle(fontWeight: FontWeight.w500),
          overflow: TextOverflow.ellipsis,
        ),
        subtitle: Text(
          item.username ?? item.website ?? item.type.name,
          style: TextStyle(color: SecureVaultTheme.textSecondary, fontSize: 13),
          overflow: TextOverflow.ellipsis,
        ),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (item.favorite)
              Icon(Icons.star, color: SecureVaultTheme.warningAmber, size: 18),
            if (item.type == VaultItemType.login && item.password != null)
              IconButton(
                icon: const Icon(Icons.copy, size: 18),
                tooltip: 'Copy password',
                onPressed: () {
                  Clipboard.setData(ClipboardData(text: item.password!));
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Password copied'), duration: Duration(seconds: 2)),
                  );
                },
              ),
          ],
        ),
        onTap: () => Navigator.push(context,
          MaterialPageRoute(builder: (_) => VaultItemDetail(item: item))),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.shield_outlined, size: 64, color: SecureVaultTheme.textSecondary),
          const SizedBox(height: 16),
          Text('No items yet', style: Theme.of(context).textTheme.titleMedium?.copyWith(
            color: SecureVaultTheme.textSecondary,
          )),
          const SizedBox(height: 8),
          Text('Tap + to add your first vault item',
            style: TextStyle(color: SecureVaultTheme.textSecondary)),
        ],
      ),
    );
  }

  void _showPasswordGenerator(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: SecureVaultTheme.cardDark,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => const PasswordGeneratorWidget(),
    );
  }
}
