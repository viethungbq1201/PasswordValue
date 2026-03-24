package com.securevault.api.service;

import com.securevault.api.dto.vault.VaultItemResponse;
import com.securevault.core.domain.VaultItem;
import com.securevault.core.enums.UrlMatchType;
import com.securevault.core.repository.VaultItemRepository;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class VaultMatchingService {

    private final VaultItemRepository vaultItemRepository;

    // Common multi-part TLDs (Public Suffix List subset)
    private static final Set<String> MULTI_PART_TLDS = Set.of(
            "co.uk", "co.jp", "co.kr", "co.in", "co.nz", "co.za",
            "com.au", "com.br", "com.cn", "com.mx", "com.sg", "com.tw",
            "org.uk", "org.au", "net.au", "ac.uk", "gov.uk",
            "co.id", "co.il", "co.th", "com.ar", "com.co", "com.hk",
            "com.my", "com.ph", "com.pk", "com.tr", "com.ua", "com.vn", "co.vn");

    public VaultMatchingService(VaultItemRepository vaultItemRepository) {
        this.vaultItemRepository = vaultItemRepository;
    }

    /**
     * Find vault items whose website column matches the given domain.
     * Uses LIKE query for substring matching, then filters by root domain.
     */
    public List<VaultItemResponse> findMatchesByDomain(UUID userId, String domain, String fullUrl) {
        String normalizedDomain = normalizeDomain(domain);
        if (normalizedDomain.isEmpty())
            return Collections.emptyList();

        String rootDomain = extractRootDomain(normalizedDomain);

        // Query using LIKE to get candidates
        List<VaultItem> candidates = vaultItemRepository
                .findByUserIdAndWebsiteContainingDomain(userId, rootDomain);

        // Filter: ensure root domain actually matches based on match_type
        List<VaultItemResponse> matchedItems = new ArrayList<>();

        for (VaultItem item : candidates) {
            if (item.getWebsite() == null || item.getWebsite().isBlank()) continue;

            UrlMatchType matchType = item.getMatchType() != null ? item.getMatchType() : UrlMatchType.DOMAIN;
            String itemWebsiteUrl = item.getWebsite().trim();
            String itemDomain = normalizeDomain(itemWebsiteUrl);

            boolean matches = false;
            switch(matchType) {
                case EXACT:
                    matches = fullUrl != null && fullUrl.equals(itemWebsiteUrl);
                    break;
                case STARTS_WITH:
                    matches = fullUrl != null && fullUrl.startsWith(itemWebsiteUrl);
                    break;
                case HOST:
                    matches = normalizedDomain.equals(itemDomain);
                    break;
                case DOMAIN:
                default:
                    String itemRootDomain = extractRootDomain(itemDomain);
                    matches = rootDomain.equals(itemRootDomain);
                    break;
            }
            if (matches) {
                matchedItems.add(toResponse(item));
            }
        }
        return matchedItems;
    }

    /**
     * Normalize a URL/domain string by stripping protocol and www.
     */
    public static String normalizeDomain(String input) {
        if (input == null || input.isBlank())
            return "";
        String s = input.trim().toLowerCase();
        if (s.startsWith("https://"))
            s = s.substring(8);
        if (s.startsWith("http://"))
            s = s.substring(7);
        if (s.startsWith("www."))
            s = s.substring(4);
        // Remove path/query
        int slashIdx = s.indexOf('/');
        if (slashIdx > 0)
            s = s.substring(0, slashIdx);
        int queryIdx = s.indexOf('?');
        if (queryIdx > 0)
            s = s.substring(0, queryIdx);
        // Remove port
        int colonIdx = s.indexOf(':');
        if (colonIdx > 0)
            s = s.substring(0, colonIdx);
        return s;
    }

    /**
     * Extract root domain using Public Suffix List approach.
     * accounts.google.com → google.com
     * m.facebook.com → facebook.com
     * bbc.co.uk → bbc.co.uk
     */
    public static String extractRootDomain(String hostname) {
        if (hostname == null || hostname.isBlank())
            return "";
        String[] parts = hostname.split("\\.");
        if (parts.length <= 2)
            return hostname;

        // Check for multi-part TLD (e.g. co.uk, com.au)
        String lastTwo = parts[parts.length - 2] + "." + parts[parts.length - 1];
        if (MULTI_PART_TLDS.contains(lastTwo)) {
            if (parts.length >= 3) {
                return parts[parts.length - 3] + "." + lastTwo;
            }
            return hostname;
        }

        // Standard TLD — return last two parts
        return parts[parts.length - 2] + "." + parts[parts.length - 1];
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
