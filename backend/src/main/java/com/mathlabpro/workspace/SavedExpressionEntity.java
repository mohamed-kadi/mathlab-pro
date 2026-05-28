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
@Table(name = "saved_expressions")
public class SavedExpressionEntity {

    @Id
    private String id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private UserAccount user;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(name = "raw_expression", nullable = false, length = 4000)
    private String rawExpression;

    @Column(name = "latex_expression", nullable = false, length = 8000)
    private String latexExpression;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected SavedExpressionEntity() {
    }

    public SavedExpressionEntity(String id, UserAccount user, String name, String rawExpression, String latexExpression, Instant createdAt) {
        this.id = id;
        this.user = user;
        this.name = name;
        this.rawExpression = rawExpression;
        this.latexExpression = latexExpression;
        this.createdAt = createdAt;
    }

    public String getId() { return id; }
    public UserAccount getUser() { return user; }
    public String getName() { return name; }
    public String getRawExpression() { return rawExpression; }
    public String getLatexExpression() { return latexExpression; }
    public Instant getCreatedAt() { return createdAt; }
    public void setName(String name) { this.name = name; }
    public void setRawExpression(String rawExpression) { this.rawExpression = rawExpression; }
    public void setLatexExpression(String latexExpression) { this.latexExpression = latexExpression; }
}
