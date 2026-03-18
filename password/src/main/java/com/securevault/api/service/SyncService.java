package com.securevault.api.service;

import com.securevault.api.dto.sync.SyncRequest;
import com.securevault.api.dto.sync.SyncResponse;
import com.securevault.api.dto.vault.VaultItemResponse;
import com.securevault.core.domain.DeviceSyncState;
import com.securevault.core.domain.Folder;
import com.securevault.core.domain.User;
import com.securevault.core.domain.VaultItem;
import com.securevault.core.enums.VaultItemType;
import com.securevault.core.repository.DeviceSyncStateRepository;
import com.securevault.core.repository.FolderRepository;
import com.securevault.core.repository.UserRepository;
import com.securevault.core.repository.VaultItemRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class SyncService {

    private final VaultItemRepository vaultItemRepository;
    private final DeviceSyncStateRepository deviceSyncStateRepository;
    private final UserRepository userRepository;
    private final FolderRepository folderRepository;
    private final SyncNotificationService syncNotificationService;

    public SyncService(VaultItemRepository vaultItemRepository,
            DeviceSyncStateRepository deviceSyncStateRepository,
            UserRepository userRepository,
            FolderRepository folderRepository,
            SyncNotificationService syncNotificationService) {
        this.vaultItemRepository = vaultItemRepository;
        this.deviceSyncStateRepository = deviceSyncStateRepository;
        this.userRepository = userRepository;
        this.folderRepository = folderRepository;
        this.syncNotificationService = syncNotificationService;
    }

    @Transactional
    public SyncResponse upload(UUID userId, SyncRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        if (request.getDeviceId() == null || request.getDeviceId().isBlank()) {
            throw new IllegalArgumentException("Device ID is required");
        }

        DeviceSyncState deviceSyncState = deviceSyncStateRepository
                .findByUserIdAndDeviceId(userId, request.getDeviceId())
                .orElseGet(() -> DeviceSyncState.builder()
                        .user(user)
                        .deviceId(request.getDeviceId())
                        .deviceName(request.getDeviceName() != null ? request.getDeviceName() : "Unknown")
                        .deviceType(request.getDeviceType() != null ? request.getDeviceType() : "WEB")
                        .build());

        for (SyncRequest.SyncItemPayload payload : request.getItems()) {
            if (payload.getId() != null) {
                vaultItemRepository.findById(payload.getId()).ifPresentOrElse(
                        existingItem -> {
                            if (!existingItem.getUser().getId().equals(userId))
                                return;

                            // Conflict Resolution:
                            // The client sends the revisionNumber it thinks is current.
                            // If the payload's updatedAt is newer than the existing item's updatedAt,
                            // or if it's explicitly resolving a conflict, we update.
                            boolean shouldUpdate = false;

                            // If client has a higher or equal revision and later updated_at timestamp, we
                            // apply their changes
                            if (payload.getUpdatedAt() != null && existingItem.getUpdatedAt() != null) {
                                if (payload.getUpdatedAt().isAfter(existingItem.getUpdatedAt())) {
                                    shouldUpdate = true;
                                }
                            } else {
                                // Fallback to basic override if timestamps missing
                                shouldUpdate = true;
                            }

                            if (shouldUpdate) {
                                existingItem.setEncryptedData(payload.getEncryptedData());
                                existingItem.setType(VaultItemType.valueOf(payload.getType().toUpperCase()));
                                existingItem.setRevisionNumber(
                                        payload.getRevisionNumber() != null ? payload.getRevisionNumber() + 1
                                                : existingItem.getRevisionNumber() + 1);

                                if (payload.getFavorite() != null)
                                    existingItem.setFavorite(payload.getFavorite());
                                if (payload.getFolderId() != null) {
                                    existingItem
                                            .setFolder(folderRepository.findById(payload.getFolderId()).orElse(null));
                                }
                                if (Boolean.TRUE.equals(payload.getDeleted())) {
                                    existingItem.setDeletedAt(LocalDateTime.now());
                                }
                                vaultItemRepository.save(existingItem);
                            }
                        },
                        () -> createItemFromPayload(user, payload));
            } else {
                createItemFromPayload(user, payload);
            }
        }

        deviceSyncState.setLastSyncAt(LocalDateTime.now());
        deviceSyncStateRepository.save(deviceSyncState);
        syncNotificationService.notifySync(userId);

        return buildSyncResponse(userId);
    }

    public SyncResponse downloadDelta(UUID userId, LocalDateTime since) {
        List<VaultItemResponse> items = vaultItemRepository
                .findByUserIdAndUpdatedAtAfter(userId, since)
                .stream().map(this::toResponse).toList();

        return SyncResponse.builder()
                .syncTimestamp(LocalDateTime.now())
                .items(items)
                .totalItems(items.size())
                .build();
    }

    public SyncResponse downloadFull(UUID userId) {
        return buildSyncResponse(userId);
    }

    private void createItemFromPayload(User user, SyncRequest.SyncItemPayload payload) {
        Folder folder = null;
        if (payload.getFolderId() != null) {
            folder = folderRepository.findById(payload.getFolderId()).orElse(null);
        }

        VaultItem item = VaultItem.builder()
                .id(payload.getId() != null ? payload.getId() : UUID.randomUUID())
                .user(user)
                .folder(folder)
                .type(VaultItemType.valueOf(payload.getType().toUpperCase()))
                .encryptedData(payload.getEncryptedData())
                .favorite(payload.getFavorite() != null ? payload.getFavorite() : false)
                .revisionNumber(payload.getRevisionNumber() != null ? payload.getRevisionNumber() : 1)
                .build();

        if (Boolean.TRUE.equals(payload.getDeleted())) {
            item.setDeletedAt(LocalDateTime.now());
        }

        vaultItemRepository.save(item);
    }

    private SyncResponse buildSyncResponse(UUID userId) {
        List<VaultItemResponse> items = vaultItemRepository.findByUserId(userId)
                .stream().map(this::toResponse).toList();

        return SyncResponse.builder()
                .syncTimestamp(LocalDateTime.now())
                .items(items)
                .totalItems(items.size())
                .build();
    }

    private VaultItemResponse toResponse(VaultItem item) {
        return VaultItemResponse.builder()
                .id(item.getId())
                .type(item.getType().name())
                .encryptedData(item.getEncryptedData())
                .folderId(item.getFolder() != null ? item.getFolder().getId() : null)
                .favorite(item.getFavorite())
                .revisionNumber(item.getRevisionNumber())
                .createdAt(item.getCreatedAt())
                .updatedAt(item.getUpdatedAt())
                .deletedAt(item.getDeletedAt())
                .build();
    }
}
