package com.mathlabpro.workspace;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SharedWorkspaceRepository extends JpaRepository<SharedWorkspaceEntity, String> {

    List<SharedWorkspaceEntity> findByOwner_IdOrderByCreatedAtDesc(String ownerId);

    List<SharedWorkspaceEntity> findBySharedWith_IdOrderByCreatedAtDesc(String sharedWithId);

    Optional<SharedWorkspaceEntity> findByIdAndOwner_Id(String id, String ownerId);

    Optional<SharedWorkspaceEntity> findByProject_IdAndSharedWith_Id(String projectId, String sharedWithId);

    long deleteByIdAndOwner_Id(String id, String ownerId);
}
