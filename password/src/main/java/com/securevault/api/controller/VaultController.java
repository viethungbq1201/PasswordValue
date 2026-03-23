package com.securevault.api.controller;

import com.securevault.api.dto.vault.VaultItemRequest;
import com.securevault.api.dto.vault.VaultItemResponse;
import com.securevault.api.service.VaultService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/vault")
public class VaultController {

    private final VaultService vaultService;

    public VaultController(VaultService vaultService) {
        this.vaultService = vaultService;
    }

    @GetMapping
    public ResponseEntity<List<VaultItemResponse>> getVaultItems(
            Authentication auth,
            @RequestParam(required = false) String type) {
        UUID userId = (UUID) auth.getPrincipal();
        List<VaultItemResponse> items;
        if (type != null) {
            items = vaultService.getVaultItemsByType(userId, type);
        } else {
            items = vaultService.getVaultItems(userId);
        }
        return ResponseEntity.ok(items);
    }

    @GetMapping("/favorites")
    public ResponseEntity<List<VaultItemResponse>> getFavorites(Authentication auth) {
        UUID userId = (UUID) auth.getPrincipal();
        return ResponseEntity.ok(vaultService.getFavorites(userId));
    }

    @GetMapping("/trash")
    public ResponseEntity<List<VaultItemResponse>> getTrash(Authentication auth) {
        UUID userId = (UUID) auth.getPrincipal();
        return ResponseEntity.ok(vaultService.getTrash(userId));
    }

    @GetMapping("/folder/{folderId}")
    public ResponseEntity<List<VaultItemResponse>> getByFolder(
            Authentication auth,
            @PathVariable UUID folderId) {
        UUID userId = (UUID) auth.getPrincipal();
        return ResponseEntity.ok(vaultService.getByFolder(userId, folderId));
    }

    @PostMapping
    public ResponseEntity<VaultItemResponse> createItem(
            Authentication auth,
            @Valid @RequestBody VaultItemRequest request) {
        UUID userId = (UUID) auth.getPrincipal();
        VaultItemResponse response = vaultService.createItem(userId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PutMapping("/{id}")
    public ResponseEntity<VaultItemResponse> updateItem(
            Authentication auth,
            @PathVariable UUID id,
            @Valid @RequestBody VaultItemRequest request) {
        UUID userId = (UUID) auth.getPrincipal();
        return ResponseEntity.ok(vaultService.updateItem(userId, id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> softDeleteItem(Authentication auth, @PathVariable UUID id) {
        UUID userId = (UUID) auth.getPrincipal();
        vaultService.softDeleteItem(userId, id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/restore")
    public ResponseEntity<VaultItemResponse> restoreItem(Authentication auth, @PathVariable UUID id) {
        UUID userId = (UUID) auth.getPrincipal();
        return ResponseEntity.ok(vaultService.restoreItem(userId, id));
    }

    @DeleteMapping("/{id}/permanent")
    public ResponseEntity<Void> permanentDelete(Authentication auth, @PathVariable UUID id) {
        UUID userId = (UUID) auth.getPrincipal();
        vaultService.permanentDeleteItem(userId, id);
        return ResponseEntity.noContent().build();
    }
}
