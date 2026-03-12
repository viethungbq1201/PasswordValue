package com.securevault.api.dto.sync;

import com.securevault.api.dto.vault.VaultItemResponse;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@AllArgsConstructor
public class SyncResponse {
    private LocalDateTime syncTimestamp;
    private List<VaultItemResponse> items;
    private int totalItems;
}
