package com.mathlabpro.workspace;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectRepository extends JpaRepository<ProjectEntity, String> {

    List<ProjectEntity> findByUser_IdOrderByUpdatedAtDescCreatedAtDesc(String userId);

    Optional<ProjectEntity> findByIdAndUser_Id(String id, String userId);

    long deleteByIdAndUser_Id(String id, String userId);
}
