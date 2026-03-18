package com.securevault.infrastructure.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.*;
import org.springframework.web.socket.config.annotation.*;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Configuration
@EnableWebSocket
public class WebSocketSyncConfig implements WebSocketConfigurer {

    private final SyncWebSocketHandler syncWebSocketHandler = new SyncWebSocketHandler();

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(syncWebSocketHandler, "/ws-sync-notification")
                .setAllowedOrigins("*");
    }

    @Bean
    public SyncWebSocketHandler syncWebSocketHandler() {
        return syncWebSocketHandler;
    }

    public static class SyncWebSocketHandler extends TextWebSocketHandler {
        private final Map<UUID, Set<WebSocketSession>> userSessions = new ConcurrentHashMap<>();

        @Override
        public void afterConnectionEstablished(WebSocketSession session) throws Exception {
            // For simplicity, we expect the client to send their userId in a query param or first message
            // In a real app, we'd extract this from the handshake (e.g., via JWT)
        }

        @Override
        protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
            String payload = message.getPayload();
            if (payload.startsWith("AUTH:")) {
                try {
                    UUID userId = UUID.fromString(payload.substring(5));
                    userSessions.computeIfAbsent(userId, k -> ConcurrentHashMap.newKeySet()).add(session);
                    session.getAttributes().put("userId", userId);
                    session.sendMessage(new TextMessage("AUTH_OK"));
                } catch (Exception e) {
                    session.sendMessage(new TextMessage("AUTH_FAILED"));
                }
            }
        }

        @Override
        public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
            UUID userId = (UUID) session.getAttributes().get("userId");
            if (userId != null) {
                Set<WebSocketSession> sessions = userSessions.get(userId);
                if (sessions != null) {
                    sessions.remove(session);
                }
            }
        }

        public void notifyUser(UUID userId) {
            Set<WebSocketSession> sessions = userSessions.get(userId);
            if (sessions != null) {
                TextMessage msg = new TextMessage("SYNC_REQUIRED");
                sessions.forEach(s -> {
                    try {
                        if (s.isOpen()) s.sendMessage(msg);
                    } catch (IOException e) {
                        // ignore
                    }
                });
            }
        }
    }
}
