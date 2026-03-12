package com.securevault.api.service;

import com.securevault.api.dto.vault.VaultItemRequest;
import com.securevault.api.dto.vault.VaultItemResponse;
import com.securevault.core.domain.User;
import com.securevault.core.domain.VaultItem;
import com.securevault.core.enums.VaultItemType;
import com.securevault.core.repository.UserRepository;
import com.securevault.core.repository.VaultItemRepository;
import com.securevault.core.repository.FolderRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class VaultServiceTest {

    @Mock
    private VaultItemRepository vaultItemRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private FolderRepository folderRepository;

    @InjectMocks
    private VaultService vaultService;

    private User testUser;
    private UUID userId;

    @BeforeEach
    void setUp() {
        userId = UUID.randomUUID();
        testUser = new User();
        testUser.setId(userId);
    }

    @Test
    void testCreateVaultItem() {
        VaultItemRequest request = new VaultItemRequest();
        request.setType("LOGIN");
        request.setEncryptedData("base64data".getBytes());

        when(userRepository.findById(userId)).thenReturn(Optional.of(testUser));

        VaultItem savedItem = new VaultItem();
        savedItem.setId(UUID.randomUUID());
        savedItem.setUser(testUser);
        savedItem.setType(VaultItemType.LOGIN);
        savedItem.setEncryptedData(request.getEncryptedData());

        when(vaultItemRepository.save(any(VaultItem.class))).thenReturn(savedItem);

        VaultItemResponse response = vaultService.createItem(userId, request);

        assertNotNull(response);
        assertEquals("LOGIN", response.getType());
        verify(vaultItemRepository, times(1)).save(any(VaultItem.class));
    }

    @Test
    void testGetVaultItems() {
        VaultItem item1 = new VaultItem();
        item1.setId(UUID.randomUUID());
        item1.setType(VaultItemType.LOGIN);

        when(vaultItemRepository.findByUserIdAndDeletedAtIsNull(userId)).thenReturn(Arrays.asList(item1));

        List<VaultItemResponse> responses = vaultService.getVaultItems(userId);

        assertEquals(1, responses.size());
        assertEquals("LOGIN", responses.get(0).getType());
    }

    @Test
    void testDeleteVaultItem() {
        UUID itemId = UUID.randomUUID();
        VaultItem existingItem = new VaultItem();
        existingItem.setId(itemId);
        existingItem.setUser(testUser);

        when(vaultItemRepository.findById(itemId)).thenReturn(Optional.of(existingItem));

        vaultService.softDeleteItem(userId, itemId);

        assertNotNull(existingItem.getDeletedAt());
        verify(vaultItemRepository, times(1)).save(existingItem);
    }
}
