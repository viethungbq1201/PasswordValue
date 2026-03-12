package com.securevault.api.controller;

import com.securevault.api.dto.sync.SyncRequest;
import com.securevault.api.dto.sync.SyncResponse;
import com.securevault.api.service.SyncService;
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
     * Upserts items and tracks device sync state.
     */
    @PostMapping("/upload")
    public ResponseEntity<SyncResponse> upload(
            Authentication auth,
            @RequestBody SyncRequest request) {
        UUID userId = (UUID) auth.getPrincipal();
        return ResponseEntity.ok(syncService.upload(userId, request));
    }

    /**
     * Delta sync: download items modified since a given timestamp.
     */
    @GetMapping("/download")
    public ResponseEntity<SyncResponse> downloadDelta(
            Authentication auth,
            @RequestParam("since") LocalDateTime since) {
        UUID userId = (UUID) auth.getPrincipal();
        return ResponseEntity.ok(syncService.downloadDelta(userId, since));
    }

    /**
     * Full sync: download entire vault (for new device setup).
     */
    @PostMapping("/full")
    public ResponseEntity<SyncResponse> downloadFull(Authentication auth) {
        UUID userId = (UUID) auth.getPrincipal();
        return ResponseEntity.ok(syncService.downloadFull(userId));
    }
}
