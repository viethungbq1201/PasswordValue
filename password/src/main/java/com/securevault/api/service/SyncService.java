package com.securevault.api.service;

import com.securevault.api.dto.sync.SyncRequest;
import com.securevault.api.dto.sync.SyncResponse;
import com.securevault.api.dto.vault.VaultItemResponse;
import com.securevault.core.domain.Device;
import com.securevault.core.domain.Folder;
import com.securevault.core.domain.User;
import com.securevault.core.domain.VaultItem;
import com.securevault.core.enums.DeviceType;
import com.securevault.core.enums.VaultItemType;
import com.securevault.core.repository.DeviceRepository;
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
    private final DeviceRepository deviceRepository;
    private final UserRepository userRepository;
    private final FolderRepository folderRepository;

    public SyncService(VaultItemRepository vaultItemRepository,
            DeviceRepository deviceRepository,
            UserRepository userRepository,
            FolderRepository folderRepository) {
        this.vaultItemRepository = vaultItemRepository;
        this.deviceRepository = deviceRepository;
        this.userRepository = userRepository;
        this.folderRepository = folderRepository;
    }

    /**
     * Upload encrypted items from a device. Upserts vault items and updates device
     * sync timestamp.
     */
    @Transactional
    public SyncResponse upload(UUID userId, SyncRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        // Register or update device
        Device device = registerOrUpdateDevice(user, request);

        // Upsert each item
        for (SyncRequest.SyncItemPayload payload : request.getItems()) {
            if (payload.getId() != null) {
                // Update existing item
                vaultItemRepository.findById(payload.getId()).ifPresentOrElse(
                        item -> {
                            if (!item.getUser().getId().equals(userId))
                                return;
                            item.setEncryptedData(payload.getEncryptedData());
                            item.setType(VaultItemType.valueOf(payload.getType().toUpperCase()));
                            if (payload.getFavorite() != null)
                                item.setFavorite(payload.getFavorite());
                            if (payload.getFolderId() != null) {
                                item.setFolder(folderRepository.findById(payload.getFolderId()).orElse(null));
                            }
                            if (Boolean.TRUE.equals(payload.getDeleted())) {
                                item.setDeletedAt(LocalDateTime.now());
                            }
                            vaultItemRepository.save(item);
                        },
                        () -> createItemFromPayload(user, payload));
            } else {
                createItemFromPayload(user, payload);
            }
        }

        // Update device last_sync
        device.setLastSync(LocalDateTime.now());
        deviceRepository.save(device);

        // Return current state
        return buildSyncResponse(userId);
    }

    /**
     * Download items modified since a given timestamp (delta sync).
     */
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

    /**
     * Full vault download — all items including soft-deleted (for new device
     * setup).
     */
    public SyncResponse downloadFull(UUID userId) {
        return buildSyncResponse(userId);
    }

    private Device registerOrUpdateDevice(User user, SyncRequest request) {
        if (request.getDeviceId() != null) {
            return deviceRepository.findById(request.getDeviceId())
                    .orElseGet(() -> createDevice(user, request));
        }
        return createDevice(user, request);
    }

    private Device createDevice(User user, SyncRequest request) {
        Device device = Device.builder()
                .user(user)
                .deviceName(request.getDeviceName() != null ? request.getDeviceName() : "Unknown Device")
                .deviceType(parseDeviceType(request.getDeviceType()))
                .lastSync(LocalDateTime.now())
                .build();
        return deviceRepository.save(device);
    }

    private DeviceType parseDeviceType(String type) {
        try {
            return type != null ? DeviceType.valueOf(type.toUpperCase()) : DeviceType.WEB;
        } catch (IllegalArgumentException e) {
            return DeviceType.WEB;
        }
    }

    private void createItemFromPayload(User user, SyncRequest.SyncItemPayload payload) {
        Folder folder = null;
        if (payload.getFolderId() != null) {
            folder = folderRepository.findById(payload.getFolderId()).orElse(null);
        }

        VaultItem item = VaultItem.builder()
                .user(user)
                .folder(folder)
                .type(VaultItemType.valueOf(payload.getType().toUpperCase()))
                .encryptedData(payload.getEncryptedData())
                .favorite(payload.getFavorite() != null ? payload.getFavorite() : false)
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
                .createdAt(item.getCreatedAt())
                .updatedAt(item.getUpdatedAt())
                .deletedAt(item.getDeletedAt())
                .build();
    }
}
