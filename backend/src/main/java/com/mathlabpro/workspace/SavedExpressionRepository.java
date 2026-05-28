package com.mathlabpro.workspace;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SavedExpressionRepository extends JpaRepository<SavedExpressionEntity, String> {

    List<SavedExpressionEntity> findByUser_IdOrderByCreatedAtDesc(String userId);

    Optional<SavedExpressionEntity> findByIdAndUser_Id(String id, String userId);

    long deleteByIdAndUser_Id(String id, String userId);
}
