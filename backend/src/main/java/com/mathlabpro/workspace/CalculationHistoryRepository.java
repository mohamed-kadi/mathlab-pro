package com.mathlabpro.workspace;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CalculationHistoryRepository extends JpaRepository<CalculationHistoryEntity, String> {

    List<CalculationHistoryEntity> findByUser_IdOrderByCreatedAtDesc(String userId);
}
