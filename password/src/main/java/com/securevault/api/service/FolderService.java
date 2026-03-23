package com.securevault.api.service;

import com.securevault.api.dto.folder.FolderRequest;
import com.securevault.api.dto.folder.FolderResponse;
import com.securevault.core.domain.Folder;
import com.securevault.core.domain.User;
import com.securevault.core.repository.FolderRepository;
import com.securevault.core.repository.UserRepository;
import com.securevault.infrastructure.exception.AccessDeniedException;
import com.securevault.infrastructure.exception.ResourceNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class FolderService {

    private final FolderRepository folderRepository;
    private final UserRepository userRepository;

    public FolderService(FolderRepository folderRepository, UserRepository userRepository) {
        this.folderRepository = folderRepository;
        this.userRepository = userRepository;
    }

    public List<FolderResponse> getFolders(UUID userId) {
        return folderRepository.findByUserIdAndDeletedAtIsNull(userId)
                .stream().map(this::toResponse).toList();
    }

    @Transactional
    public FolderResponse createFolder(UUID userId, FolderRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        Folder folder = Folder.builder()
                .user(user)
                .name(request.getName())
                .build();

        folder = folderRepository.save(folder);
        return toResponse(folder);
    }

    @Transactional
    public FolderResponse updateFolder(UUID userId, UUID folderId, FolderRequest request) {
        Folder folder = folderRepository.findById(folderId)
                .orElseThrow(() -> new ResourceNotFoundException("Folder not found"));

        if (!folder.getUser().getId().equals(userId)) {
            throw new AccessDeniedException("Access denied");
        }

        folder.setName(request.getName());
        folder = folderRepository.save(folder);
        return toResponse(folder);
    }

    @Transactional
    public void softDeleteFolder(UUID userId, UUID folderId) {
        Folder folder = folderRepository.findById(folderId)
                .orElseThrow(() -> new ResourceNotFoundException("Folder not found"));

        if (!folder.getUser().getId().equals(userId)) {
            throw new AccessDeniedException("Access denied");
        }

        folder.setDeletedAt(LocalDateTime.now());
        folderRepository.save(folder);
    }

    private FolderResponse toResponse(Folder folder) {
        return FolderResponse.builder()
                .id(folder.getId())
                .name(folder.getName())
                .deletedAt(folder.getDeletedAt())
                .build();
    }
}
