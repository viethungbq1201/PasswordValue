package com.securevault.api.dto.sync;

import com.securevault.api.dto.vault.VaultItemRequest;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
public class SyncRequest {

    private String deviceId;
    private String deviceName;
    private String deviceType;

    /** Encrypted vault items to upload */
    private List<SyncItemPayload> items;

    @Data
    public static class SyncItemPayload {
        private UUID id;
        private String type;
        private byte[] encryptedData;
        private UUID folderId;
        private Boolean favorite;
        private Boolean deleted;
        private Integer revisionNumber;
        private LocalDateTime updatedAt;
    }
}
