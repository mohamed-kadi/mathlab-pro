package com.mathlabpro.workspace;

import com.mathlabpro.auth.UserAccount;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "audit_logs")
public class AuditLogEntity {

    @Id
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private UserAccount user;

    @Column(nullable = false)
    private String action;

    @Column(nullable = false)
    private String resource;

    @Column(name = "resource_id")
    private String resourceId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false)
    private Map<String, Object> metadata = new LinkedHashMap<>();

    @Column(name = "ip_address")
    private String ipAddress;

    @Column(name = "user_agent")
    private String userAgent;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected AuditLogEntity() {
    }

    public AuditLogEntity(String id, UserAccount user, String action, String resource, String resourceId, Map<String, Object> metadata, Instant createdAt) {
        this.id = id;
        this.user = user;
        this.action = action;
        this.resource = resource;
        this.resourceId = resourceId;
        this.metadata = metadata == null ? new LinkedHashMap<>() : metadata;
        this.createdAt = createdAt;
    }

    public String getId() {
        return id;
    }

    public UserAccount getUser() {
        return user;
    }

    public String getAction() {
        return action;
    }

    public String getResource() {
        return resource;
    }

    public String getResourceId() {
        return resourceId;
    }

    public Map<String, Object> getMetadata() {
        return metadata;
    }

    public String getIpAddress() {
        return ipAddress;
    }

    public String getUserAgent() {
        return userAgent;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
