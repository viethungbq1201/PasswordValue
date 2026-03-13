package com.securevault.api.dto.vault;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;
import com.securevault.core.enums.UrlMatchType;

@Data
public class VaultItemRequest {

    @NotBlank(message = "Type is required")
    private String type;

    @NotNull(message = "Encrypted data is required")
    private byte[] encryptedData;

    private UUID folderId;

    private Boolean favorite;

    private Integer revisionNumber;

    private String website;

    private UrlMatchType matchType;
}
