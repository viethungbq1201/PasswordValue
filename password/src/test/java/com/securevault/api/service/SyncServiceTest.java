package com.securevault.api.service;

import com.securevault.api.dto.sync.SyncRequest;
import com.securevault.api.dto.sync.SyncResponse;
import com.securevault.core.domain.DeviceSyncState;
import com.securevault.core.domain.User;
import com.securevault.core.domain.VaultItem;
import com.securevault.core.repository.DeviceSyncStateRepository;
import com.securevault.core.repository.UserRepository;
import com.securevault.core.repository.VaultItemRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SyncServiceTest {

    @Mock
    private VaultItemRepository vaultItemRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private DeviceSyncStateRepository syncStateRepository;

    @Mock
    private com.securevault.core.repository.FolderRepository folderRepository;

    @InjectMocks
    private SyncService syncService;

    private User testUser;
    private UUID userId;

    @BeforeEach
    void setUp() {
        userId = UUID.randomUUID();
        testUser = new User();
        testUser.setId(userId);
        testUser.setEmail("test@example.com");
    }

    @Test
    void testDownloadFull_ShouldReturnAllItems() {
        VaultItem item1 = new VaultItem();
        item1.setId(UUID.randomUUID());
        item1.setType(com.securevault.core.enums.VaultItemType.LOGIN);
        item1.setEncryptedData("data1".getBytes());

        VaultItem item2 = new VaultItem();
        item2.setId(UUID.randomUUID());
        item2.setType(com.securevault.core.enums.VaultItemType.SECURE_NOTE);
        item2.setEncryptedData("data2".getBytes());

        when(vaultItemRepository.findByUserId(userId)).thenReturn(Arrays.asList(item1, item2));

        SyncResponse response = syncService.downloadFull(userId);

        assertEquals(2, response.getItems().size());
        verify(vaultItemRepository, times(1)).findByUserId(userId);
    }

    @Test
    void testUpload_WithConflict_ShouldKeepExistingIfNewer() {
        String deviceId = "device-123";
        SyncRequest request = new SyncRequest();
        request.setDeviceId(deviceId);

        SyncRequest.SyncItemPayload payload = new SyncRequest.SyncItemPayload();
        UUID itemId = UUID.randomUUID();
        payload.setId(itemId);
        payload.setType("LOGIN");
        payload.setEncryptedData("new-data".getBytes());
        payload.setRevisionNumber(1);
        payload.setUpdatedAt(LocalDateTime.now().minusDays(1)); // Older payload

        request.setItems(Arrays.asList(payload));

        VaultItem existingItem = new VaultItem();
        existingItem.setId(itemId);
        existingItem.setUser(testUser);
        existingItem.setRevisionNumber(2);
        existingItem.setUpdatedAt(LocalDateTime.now()); // Newer existing

        when(userRepository.findById(userId)).thenReturn(Optional.of(testUser));
        when(syncStateRepository.findByUserIdAndDeviceId(userId, deviceId))
                .thenReturn(Optional.of(new DeviceSyncState()));

        when(vaultItemRepository.findById(itemId)).thenReturn(Optional.of(existingItem));

        syncService.upload(userId, request);

        // Should not save since existing is newer
        verify(vaultItemRepository, never()).save(any(VaultItem.class));
    }

    @Test
    void testUpload_AddNewItem() {
        String deviceId = "device-123";
        SyncRequest request = new SyncRequest();
        request.setDeviceId(deviceId);

        SyncRequest.SyncItemPayload payload = new SyncRequest.SyncItemPayload();
        payload.setType("LOGIN");
        payload.setEncryptedData("new-data".getBytes());

        request.setItems(Arrays.asList(payload));

        when(userRepository.findById(userId)).thenReturn(Optional.of(testUser));
        when(syncStateRepository.findByUserIdAndDeviceId(userId, deviceId))
                .thenReturn(Optional.of(new DeviceSyncState()));

        when(vaultItemRepository.save(any(VaultItem.class))).thenAnswer(i -> i.getArguments()[0]);

        syncService.upload(userId, request);

        verify(vaultItemRepository, times(1)).save(any(VaultItem.class));
    }
}
