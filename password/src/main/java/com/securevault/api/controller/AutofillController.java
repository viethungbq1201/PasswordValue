package com.securevault.api.controller;

import com.securevault.api.dto.vault.VaultItemResponse;
import com.securevault.api.service.VaultMatchingService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api")
public class AutofillController {

    private final VaultMatchingService vaultMatchingService;

    public AutofillController(VaultMatchingService vaultMatchingService) {
        this.vaultMatchingService = vaultMatchingService;
    }

    /**
     * GET /api/autofill?domain=github.com&fullUrl=https://github.com/login
     *
     * Returns vault items matching the domain or fullUrl strategies.
     */
    @GetMapping("/autofill")
    public ResponseEntity<List<VaultItemResponse>> matchByDomain(
            Authentication auth,
            @RequestParam String domain,
            @RequestParam(required = false) String fullUrl) {
        UUID userId = (UUID) auth.getPrincipal();
        List<VaultItemResponse> matches = vaultMatchingService.findMatchesByDomain(userId, domain, fullUrl);
        return ResponseEntity.ok(matches);
    }
}
