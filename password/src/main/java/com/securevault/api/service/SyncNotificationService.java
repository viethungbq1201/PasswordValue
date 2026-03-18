package com.securevault.api.service;
import com.securevault.infrastructure.config.WebSocketSyncConfig;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class SyncNotificationService {

    private final SimpMessagingTemplate messagingTemplate;
    private final WebSocketSyncConfig.SyncWebSocketHandler syncWebSocketHandler;

    public SyncNotificationService(SimpMessagingTemplate messagingTemplate, 
                                   WebSocketSyncConfig.SyncWebSocketHandler syncWebSocketHandler) {
        this.messagingTemplate = messagingTemplate;
        this.syncWebSocketHandler = syncWebSocketHandler;
    }

    /**
     * Notify the user that their vault has changed.
     * All devices connected to /topic/sync/{userId} will receive this.
     */
    public void notifySync(UUID userId) {
        messagingTemplate.convertAndSend("/topic/sync/" + userId, "SYNC_REQUIRED");
        syncWebSocketHandler.notifyUser(userId);
    }
}
