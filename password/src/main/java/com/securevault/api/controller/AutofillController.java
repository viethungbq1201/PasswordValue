package com.securevault.api.controller;

import com.securevault.api.dto.vault.VaultItemResponse;
import com.securevault.api.service.VaultMatchingService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/vault")
public class AutofillController {

    private final VaultMatchingService vaultMatchingService;

    public AutofillController(VaultMatchingService vaultMatchingService) {
        this.vaultMatchingService = vaultMatchingService;
    }

    /**
     * GET /api/vault/match?domain=github.com
     *
     * Returns vault items whose website matches the given domain.
     */
    @GetMapping("/match")
    public ResponseEntity<List<VaultItemResponse>> matchByDomain(
            Authentication auth,
            @RequestParam String domain) {
        UUID userId = (UUID) auth.getPrincipal();
        List<VaultItemResponse> matches = vaultMatchingService.findMatchesByDomain(userId, domain);
        return ResponseEntity.ok(matches);
    }
}
