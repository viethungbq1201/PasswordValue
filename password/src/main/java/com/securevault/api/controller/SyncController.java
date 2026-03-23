package com.securevault.api.controller;

import com.securevault.api.dto.sync.SyncRequest;
import com.securevault.api.dto.sync.SyncResponse;
import com.securevault.api.service.SyncService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.UUID;

@RestController
@RequestMapping("/api/sync")
public class SyncController {

    private final SyncService syncService;

    public SyncController(SyncService syncService) {
        this.syncService = syncService;
    }

    /**
     * Upload encrypted vault items from a device.
     */
    @PostMapping("/upload")
    public ResponseEntity<SyncResponse> upload(
            Authentication auth,
            @Valid @RequestBody SyncRequest request) {
        UUID userId = (UUID) auth.getPrincipal();
        return ResponseEntity.ok(syncService.upload(userId, request));
    }

    /**
     * Delta sync: download items modified since a given timestamp.
     */
    @GetMapping("/changes")
    public ResponseEntity<SyncResponse> downloadDelta(
            Authentication auth,
            @RequestParam("since") LocalDateTime since) {
        UUID userId = (UUID) auth.getPrincipal();
        return ResponseEntity.ok(syncService.downloadDelta(userId, since));
    }

    /**
     * Full sync GET: download entire vault
     */
    @GetMapping("/full")
    public ResponseEntity<SyncResponse> downloadFullGet(Authentication auth) {
        UUID userId = (UUID) auth.getPrincipal();
        return ResponseEntity.ok(syncService.downloadFull(userId));
    }

    /**
     * Full sync POST: force full re-upload and download entire vault
     */
    @PostMapping("/full")
    public ResponseEntity<SyncResponse> downloadFullPost(Authentication auth) {
        UUID userId = (UUID) auth.getPrincipal();
        return ResponseEntity.ok(syncService.downloadFull(userId));
    }
}
