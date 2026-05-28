package com.mathlabpro.workspace;

import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AuditLogRepository extends JpaRepository<AuditLogEntity, String> {

    List<AuditLogEntity> findByUser_IdOrderByCreatedAtDesc(String userId, Pageable pageable);
}
