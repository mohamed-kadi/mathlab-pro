package com.mathlabpro.workspace;

import com.mathlabpro.auth.UserAccount;
import com.mathlabpro.auth.UserRepository;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuditService {

    private final AuditLogRepository auditLogRepository;
    private final UserRepository userRepository;

    public AuditService(AuditLogRepository auditLogRepository, UserRepository userRepository) {
        this.auditLogRepository = auditLogRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listForUser(String userId, int limit) {
        int safeLimit = Math.min(Math.max(limit, 1), 250);
        return auditLogRepository.findByUser_IdOrderByCreatedAtDesc(userId, PageRequest.of(0, safeLimit))
            .stream()
            .map(this::toDto)
            .toList();
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(String userId, String action, String resource, String resourceId, Map<String, Object> metadata) {
        if (userId == null) return;
        UserAccount user = userRepository.findById(userId).orElse(null);
        if (user == null) return;
        auditLogRepository.save(new AuditLogEntity(
            "audit-" + UUID.randomUUID(),
            user,
            action,
            resource,
            resourceId,
            metadata == null ? Map.of() : metadata,
            Instant.now()
        ));
    }

    private Map<String, Object> toDto(AuditLogEntity entity) {
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id", entity.getId());
        if (entity.getUser() != null) dto.put("userId", entity.getUser().getId());
        dto.put("action", entity.getAction());
        dto.put("resource", entity.getResource());
        if (entity.getResourceId() != null) dto.put("resourceId", entity.getResourceId());
        dto.put("metadata", entity.getMetadata());
        if (entity.getIpAddress() != null) dto.put("ipAddress", entity.getIpAddress());
        if (entity.getUserAgent() != null) dto.put("userAgent", entity.getUserAgent());
        dto.put("createdAt", entity.getCreatedAt());
        return dto;
    }
}
