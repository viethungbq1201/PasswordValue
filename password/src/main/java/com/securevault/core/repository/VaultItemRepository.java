package com.securevault.core.repository;

import com.securevault.core.domain.VaultItem;
import com.securevault.core.enums.VaultItemType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface VaultItemRepository extends JpaRepository<VaultItem, UUID> {

    /** Active items (not soft-deleted) for a user */
    List<VaultItem> findByUserIdAndDeletedAtIsNull(UUID userId);

    /** Active items filtered by type */
    List<VaultItem> findByUserIdAndTypeAndDeletedAtIsNull(UUID userId, VaultItemType type);

    /** Favorites */
    List<VaultItem> findByUserIdAndFavoriteTrueAndDeletedAtIsNull(UUID userId);

    /** Recycle bin (soft-deleted) */
    List<VaultItem> findByUserIdAndDeletedAtIsNotNull(UUID userId);

    /** Items in a specific folder */
    List<VaultItem> findByUserIdAndFolderIdAndDeletedAtIsNull(UUID userId, UUID folderId);

    /** Items modified after a timestamp — for delta sync */
    @Query("SELECT v FROM VaultItem v WHERE v.user.id = :userId AND v.updatedAt > :since")
    List<VaultItem> findByUserIdAndUpdatedAtAfter(
            @Param("userId") UUID userId,
            @Param("since") LocalDateTime since);

    /** All items for full sync (including soft-deleted) */
    List<VaultItem> findByUserId(UUID userId);

    /** Match vault items by domain substring in the website column */
    @Query("SELECT v FROM VaultItem v WHERE v.user.id = :userId AND v.deletedAt IS NULL AND LOWER(v.website) LIKE LOWER(CONCAT('%', :domain, '%'))")
    List<VaultItem> findByUserIdAndWebsiteContainingDomain(
            @Param("userId") UUID userId,
            @Param("domain") String domain);
}
