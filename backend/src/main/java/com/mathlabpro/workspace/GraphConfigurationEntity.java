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
@Table(name = "graph_configurations")
public class GraphConfigurationEntity {

    @Id
    private String id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private UserAccount user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id")
    private ProjectEntity project;

    @Column(nullable = false, length = 120)
    private String name;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false)
    private Map<String, Object> config = new LinkedHashMap<>();

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected GraphConfigurationEntity() {
    }

    public GraphConfigurationEntity(String id, UserAccount user, ProjectEntity project, String name, Map<String, Object> config, Instant createdAt, Instant updatedAt) {
        this.id = id;
        this.user = user;
        this.project = project;
        this.name = name;
        this.config = config == null ? new LinkedHashMap<>() : config;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public String getId() { return id; }
    public UserAccount getUser() { return user; }
    public ProjectEntity getProject() { return project; }
    public String getName() { return name; }
    public Map<String, Object> getConfig() { return config; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setName(String name) { this.name = name; }
    public void setProject(ProjectEntity project) { this.project = project; }
    public void setConfig(Map<String, Object> config) { this.config = config; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
