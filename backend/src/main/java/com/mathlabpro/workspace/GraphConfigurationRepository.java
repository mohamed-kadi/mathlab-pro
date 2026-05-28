package com.mathlabpro.workspace;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GraphConfigurationRepository extends JpaRepository<GraphConfigurationEntity, String> {

    List<GraphConfigurationEntity> findByUser_IdOrderByUpdatedAtDescCreatedAtDesc(String userId);

    Optional<GraphConfigurationEntity> findByIdAndUser_Id(String id, String userId);

    long deleteByIdAndUser_Id(String id, String userId);
}
