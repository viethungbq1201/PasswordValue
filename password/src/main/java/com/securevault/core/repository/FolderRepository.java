package com.securevault.core.repository;

import com.securevault.core.domain.Folder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface FolderRepository extends JpaRepository<Folder, UUID> {

    List<Folder> findByUserIdAndDeletedAtIsNull(UUID userId);

    List<Folder> findByUserIdAndDeletedAtIsNotNull(UUID userId);
}
