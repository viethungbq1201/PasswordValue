package com.securevault.api.controller;

import com.securevault.api.dto.folder.FolderRequest;
import com.securevault.api.dto.folder.FolderResponse;
import com.securevault.api.service.FolderService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping({"/api/folders", "/folders"})
public class FolderController {

    private final FolderService folderService;

    public FolderController(FolderService folderService) {
        this.folderService = folderService;
    }

    @GetMapping
    public ResponseEntity<List<FolderResponse>> getFolders(Authentication auth) {
        UUID userId = (UUID) auth.getPrincipal();
        return ResponseEntity.ok(folderService.getFolders(userId));
    }

    @PostMapping
    public ResponseEntity<FolderResponse> createFolder(
            Authentication auth,
            @Valid @RequestBody FolderRequest request) {
        UUID userId = (UUID) auth.getPrincipal();
        return ResponseEntity.status(HttpStatus.CREATED).body(folderService.createFolder(userId, request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<FolderResponse> updateFolder(
            Authentication auth,
            @PathVariable UUID id,
            @Valid @RequestBody FolderRequest request) {
        UUID userId = (UUID) auth.getPrincipal();
        return ResponseEntity.ok(folderService.updateFolder(userId, id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteFolder(Authentication auth, @PathVariable UUID id) {
        UUID userId = (UUID) auth.getPrincipal();
        folderService.softDeleteFolder(userId, id);
        return ResponseEntity.noContent().build();
    }
}
