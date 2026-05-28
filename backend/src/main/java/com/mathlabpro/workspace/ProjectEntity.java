package com.mathlabpro.workspace;

import com.mathlabpro.auth.UserAccount;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "projects")
public class ProjectEntity {

    @Id
    private String id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private UserAccount user;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(nullable = false, length = 1000)
    private String description;

    @OneToMany(mappedBy = "project", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("createdAt ASC")
    private List<ProjectSheetEntity> sheets = new ArrayList<>();

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected ProjectEntity() {
    }

    public ProjectEntity(String id, UserAccount user, String name, String description, Instant createdAt, Instant updatedAt) {
        this.id = id;
        this.user = user;
        this.name = name;
        this.description = description;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public String getId() { return id; }
    public UserAccount getUser() { return user; }
    public String getName() { return name; }
    public String getDescription() { return description; }
    public List<ProjectSheetEntity> getSheets() { return sheets; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setName(String name) { this.name = name; }
    public void setDescription(String description) { this.description = description; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }

    public void replaceSheets(List<ProjectSheetEntity> replacement) {
        sheets.clear();
        replacement.forEach(sheet -> {
            sheet.setProject(this);
            sheets.add(sheet);
        });
    }
}
