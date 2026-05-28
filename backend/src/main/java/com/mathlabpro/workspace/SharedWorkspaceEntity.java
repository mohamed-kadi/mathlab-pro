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

@Entity
@Table(name = "shared_workspaces")
public class SharedWorkspaceEntity {

    @Id
    private String id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "project_id", nullable = false)
    private ProjectEntity project;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_user_id", nullable = false)
    private UserAccount owner;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "shared_with_user_id", nullable = false)
    private UserAccount sharedWith;

    @Column(nullable = false, length = 20)
    private String role;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected SharedWorkspaceEntity() {
    }

    public SharedWorkspaceEntity(String id, ProjectEntity project, UserAccount owner, UserAccount sharedWith, String role, Instant createdAt) {
        this.id = id;
        this.project = project;
        this.owner = owner;
        this.sharedWith = sharedWith;
        this.role = role;
        this.createdAt = createdAt;
    }

    public String getId() { return id; }
    public ProjectEntity getProject() { return project; }
    public UserAccount getOwner() { return owner; }
    public UserAccount getSharedWith() { return sharedWith; }
    public String getRole() { return role; }
    public Instant getCreatedAt() { return createdAt; }
    public void setRole(String role) { this.role = role; }
}
