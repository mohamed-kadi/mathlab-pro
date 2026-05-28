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
import java.util.ArrayList;
import java.util.List;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "calculation_history")
public class CalculationHistoryEntity {

    @Id
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private UserAccount user;

    @Column(nullable = false, length = 40)
    private String type;

    @Column(nullable = false, length = 4000)
    private String input;

    @Column(nullable = false, length = 8000)
    private String output;

    @Column(name = "latex_input", length = 8000)
    private String latexInput;

    @Column(name = "latex_output", length = 8000)
    private String latexOutput;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false)
    private List<String> steps = new ArrayList<>();

    @Column(length = 10000)
    private String explanation;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected CalculationHistoryEntity() {
    }

    public CalculationHistoryEntity(String id, UserAccount user, String type, String input, String output, String latexInput, String latexOutput, List<String> steps, String explanation, Instant createdAt) {
        this.id = id;
        this.user = user;
        this.type = type;
        this.input = input;
        this.output = output;
        this.latexInput = latexInput;
        this.latexOutput = latexOutput;
        this.steps = steps == null ? List.of() : steps;
        this.explanation = explanation;
        this.createdAt = createdAt;
    }

    public String getId() { return id; }
    public UserAccount getUser() { return user; }
    public String getType() { return type; }
    public String getInput() { return input; }
    public String getOutput() { return output; }
    public String getLatexInput() { return latexInput; }
    public String getLatexOutput() { return latexOutput; }
    public List<String> getSteps() { return steps; }
    public String getExplanation() { return explanation; }
    public Instant getCreatedAt() { return createdAt; }
}
