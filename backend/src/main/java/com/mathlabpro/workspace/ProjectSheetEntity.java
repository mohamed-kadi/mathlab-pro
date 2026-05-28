package com.mathlabpro.workspace;

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
@Table(name = "project_sheets")
public class ProjectSheetEntity {

    @Id
    private String id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "project_id", nullable = false)
    private ProjectEntity project;

    @Column(nullable = false, length = 120)
    private String name;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false)
    private Map<String, String> cells = new LinkedHashMap<>();

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected ProjectSheetEntity() {
    }

    public ProjectSheetEntity(String id, String name, Map<String, String> cells, Instant createdAt, Instant updatedAt) {
        this.id = id;
        this.name = name;
        this.cells = cells == null ? new LinkedHashMap<>() : cells;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public String getId() { return id; }
    public ProjectEntity getProject() { return project; }
    public String getName() { return name; }
    public Map<String, String> getCells() { return cells; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setProject(ProjectEntity project) { this.project = project; }
}
