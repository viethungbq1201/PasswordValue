package com.securevault.api.dto.folder;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@AllArgsConstructor
public class FolderResponse {
    private UUID id;
    private String name;
    private LocalDateTime deletedAt;
}
