package com.securevault.api.dto.vault;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@AllArgsConstructor
public class VaultItemResponse {
    private UUID id;
    private String type;
    private byte[] encryptedData;
    private UUID folderId;
    private Boolean favorite;
    private Integer revisionNumber;
    private String website;
    private String matchType;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime deletedAt;
}
