package com.securevault.api.service;

import com.securevault.core.domain.AuditLog;
import com.securevault.core.domain.User;
import com.securevault.core.repository.AuditLogRepository;
import com.securevault.core.repository.UserRepository;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class AuditService {

    private final AuditLogRepository auditLogRepository;
    private final UserRepository userRepository;

    public AuditService(AuditLogRepository auditLogRepository, UserRepository userRepository) {
        this.auditLogRepository = auditLogRepository;
        this.userRepository = userRepository;
    }

    /**
     * Log an auditable action.
     *
     * @param userId    the user performing the action (nullable for failed logins)
     * @param action    the action type (e.g., LOGIN, REGISTER, VAULT_CREATE, VAULT_DELETE)
     * @param targetType the type of the target entity (e.g., VAULT_ITEM, FOLDER)
     * @param targetId  the ID of the target entity (nullable)
     * @param ipAddress the client IP address (nullable)
     * @param details   additional details (nullable)
     */
    public void log(UUID userId, String action, String targetType, UUID targetId,
                    String ipAddress, String details) {
        User user = null;
        if (userId != null) {
            user = userRepository.findById(userId).orElse(null);
        }

        AuditLog auditLog = AuditLog.builder()
                .user(user)
                .action(action)
                .targetType(targetType)
                .targetId(targetId)
                .ipAddress(ipAddress)
                .details(details)
                .build();

        auditLogRepository.save(auditLog);
    }
}
