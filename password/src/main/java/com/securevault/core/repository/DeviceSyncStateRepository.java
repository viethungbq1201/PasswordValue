package com.securevault.core.repository;

import com.securevault.core.domain.DeviceSyncState;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface DeviceSyncStateRepository extends JpaRepository<DeviceSyncState, UUID> {
    Optional<DeviceSyncState> findByUserIdAndDeviceId(UUID userId, String deviceId);
}
