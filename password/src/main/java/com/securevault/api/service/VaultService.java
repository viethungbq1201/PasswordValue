package com.securevault.api.service;

import com.securevault.api.dto.vault.VaultItemRequest;
import com.securevault.api.dto.vault.VaultItemResponse;
import com.securevault.core.domain.Folder;
import com.securevault.core.domain.User;
import com.securevault.core.domain.VaultItem;
import com.securevault.core.enums.UrlMatchType;
import com.securevault.core.enums.VaultItemType;
import com.securevault.core.repository.FolderRepository;
import com.securevault.core.repository.UserRepository;
import com.securevault.core.repository.VaultItemRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class VaultService {

    private final VaultItemRepository vaultItemRepository;
    private final UserRepository userRepository;
    private final FolderRepository folderRepository;

    public VaultService(VaultItemRepository vaultItemRepository,
            UserRepository userRepository,
            FolderRepository folderRepository) {
        this.vaultItemRepository = vaultItemRepository;
        this.userRepository = userRepository;
        this.folderRepository = folderRepository;
    }

    public List<VaultItemResponse> getVaultItems(UUID userId) {
        return vaultItemRepository.findByUserIdAndDeletedAtIsNull(userId)
                .stream().map(this::toResponse).toList();
    }

    public List<VaultItemResponse> getVaultItemsByType(UUID userId, String type) {
        VaultItemType itemType = VaultItemType.valueOf(type.toUpperCase());
        return vaultItemRepository.findByUserIdAndTypeAndDeletedAtIsNull(userId, itemType)
                .stream().map(this::toResponse).toList();
    }

    public List<VaultItemResponse> getFavorites(UUID userId) {
        return vaultItemRepository.findByUserIdAndFavoriteTrueAndDeletedAtIsNull(userId)
                .stream().map(this::toResponse).toList();
    }

    public List<VaultItemResponse> getTrash(UUID userId) {
        return vaultItemRepository.findByUserIdAndDeletedAtIsNotNull(userId)
                .stream().map(this::toResponse).toList();
    }

    public List<VaultItemResponse> getByFolder(UUID userId, UUID folderId) {
        return vaultItemRepository.findByUserIdAndFolderIdAndDeletedAtIsNull(userId, folderId)
                .stream().map(this::toResponse).toList();
    }

    @Transactional
    public VaultItemResponse createItem(UUID userId, VaultItemRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        Folder folder = null;
        if (request.getFolderId() != null) {
            folder = folderRepository.findById(request.getFolderId()).orElse(null);
        }

        VaultItem item = VaultItem.builder()
                .user(user)
                .folder(folder)
                .type(VaultItemType.valueOf(request.getType().toUpperCase()))
                .encryptedData(request.getEncryptedData())
                .website(request.getWebsite())
                .matchType(request.getMatchType() != null ? request.getMatchType() : UrlMatchType.DOMAIN)
                .favorite(request.getFavorite() != null ? request.getFavorite() : false)
                .build();

        item = vaultItemRepository.save(item);
        return toResponse(item);
    }

    @Transactional
    public VaultItemResponse updateItem(UUID userId, UUID itemId, VaultItemRequest request) {
        VaultItem item = vaultItemRepository.findById(itemId)
                .orElseThrow(() -> new IllegalArgumentException("Item not found"));

        if (!item.getUser().getId().equals(userId)) {
            throw new IllegalArgumentException("Access denied");
        }

        if (request.getEncryptedData() != null) {
            item.setEncryptedData(request.getEncryptedData());
        }
        if (request.getType() != null) {
            item.setType(VaultItemType.valueOf(request.getType().toUpperCase()));
        }
        if (request.getFolderId() != null) {
            Folder folder = folderRepository.findById(request.getFolderId()).orElse(null);
            item.setFolder(folder);
        }
        if (request.getFavorite() != null) {
            item.setFavorite(request.getFavorite());
        }
        if (request.getWebsite() != null) {
            item.setWebsite(request.getWebsite());
        }
        if (request.getMatchType() != null) {
            item.setMatchType(request.getMatchType());
        }

        item = vaultItemRepository.save(item);
        return toResponse(item);
    }

    @Transactional
    public void softDeleteItem(UUID userId, UUID itemId) {
        VaultItem item = vaultItemRepository.findById(itemId)
                .orElseThrow(() -> new IllegalArgumentException("Item not found"));

        if (!item.getUser().getId().equals(userId)) {
            throw new IllegalArgumentException("Access denied");
        }

        item.setDeletedAt(LocalDateTime.now());
        vaultItemRepository.save(item);
    }

    @Transactional
    public VaultItemResponse restoreItem(UUID userId, UUID itemId) {
        VaultItem item = vaultItemRepository.findById(itemId)
                .orElseThrow(() -> new IllegalArgumentException("Item not found"));

        if (!item.getUser().getId().equals(userId)) {
            throw new IllegalArgumentException("Access denied");
        }

        item.setDeletedAt(null);
        item = vaultItemRepository.save(item);
        return toResponse(item);
    }

    @Transactional
    public void permanentDeleteItem(UUID userId, UUID itemId) {
        VaultItem item = vaultItemRepository.findById(itemId)
                .orElseThrow(() -> new IllegalArgumentException("Item not found"));

        if (!item.getUser().getId().equals(userId)) {
            throw new IllegalArgumentException("Access denied");
        }

        vaultItemRepository.delete(item);
    }

    private VaultItemResponse toResponse(VaultItem item) {
        return VaultItemResponse.builder()
                .id(item.getId())
                .type(item.getType().name())
                .encryptedData(item.getEncryptedData())
                .folderId(item.getFolder() != null ? item.getFolder().getId() : null)
                .favorite(item.getFavorite())
                .revisionNumber(item.getRevisionNumber())
                .website(item.getWebsite())
                .matchType(item.getMatchType() != null ? item.getMatchType().name() : UrlMatchType.DOMAIN.name())
                .createdAt(item.getCreatedAt())
                .updatedAt(item.getUpdatedAt())
                .deletedAt(item.getDeletedAt())
                .build();
    }
}
