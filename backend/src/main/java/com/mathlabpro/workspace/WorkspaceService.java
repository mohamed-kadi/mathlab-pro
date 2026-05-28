package com.mathlabpro.workspace;

import com.mathlabpro.auth.UserAccount;
import com.mathlabpro.auth.UserRepository;
import com.mathlabpro.common.ApiException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class WorkspaceService {

    private static final Set<String> CALCULATION_TYPES = Set.of("polynomial", "algebra", "matrix", "numerical", "statistics", "calculus", "ai-explain");

    private final UserRepository userRepository;
    private final SavedExpressionRepository savedExpressionRepository;
    private final ProjectRepository projectRepository;
    private final GraphConfigurationRepository graphConfigurationRepository;
    private final SharedWorkspaceRepository sharedWorkspaceRepository;
    private final CalculationHistoryRepository historyRepository;
    private final AuditService auditService;

    public WorkspaceService(
        UserRepository userRepository,
        SavedExpressionRepository savedExpressionRepository,
        ProjectRepository projectRepository,
        GraphConfigurationRepository graphConfigurationRepository,
        SharedWorkspaceRepository sharedWorkspaceRepository,
        CalculationHistoryRepository historyRepository,
        AuditService auditService
    ) {
        this.userRepository = userRepository;
        this.savedExpressionRepository = savedExpressionRepository;
        this.projectRepository = projectRepository;
        this.graphConfigurationRepository = graphConfigurationRepository;
        this.sharedWorkspaceRepository = sharedWorkspaceRepository;
        this.historyRepository = historyRepository;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> savedExpressions(String userId) {
        return savedExpressionRepository.findByUser_IdOrderByCreatedAtDesc(userId).stream().map(this::savedExpressionDto).toList();
    }

    @Transactional
    public Map<String, Object> createSavedExpression(String userId, Map<String, Object> request) {
        UserAccount user = user(userId);
        String name = requiredString(request, "name", 1, 120);
        String rawExpression = requiredString(request, "rawExpression", 1, 4000);
        String latexExpression = optionalString(request, "latexExpression", 8000, rawExpression);
        SavedExpressionEntity entity = savedExpressionRepository.save(new SavedExpressionEntity(
            "exp-" + UUID.randomUUID(),
            user,
            name,
            rawExpression,
            latexExpression,
            Instant.now()
        ));
        auditService.record(userId, "create", "saved-expressions", entity.getId(), Map.of("name", name));
        return savedExpressionDto(entity);
    }

    @Transactional
    public Map<String, Object> updateSavedExpression(String userId, String id, Map<String, Object> request) {
        if (request.isEmpty()) throw badRequest("At least one saved expression field is required.");
        SavedExpressionEntity entity = savedExpressionRepository.findByIdAndUser_Id(id, userId)
            .orElseThrow(() -> notFound("Saved expression not found"));
        if (request.containsKey("name")) entity.setName(requiredString(request, "name", 1, 120));
        if (request.containsKey("rawExpression")) entity.setRawExpression(requiredString(request, "rawExpression", 1, 4000));
        if (request.containsKey("latexExpression")) entity.setLatexExpression(optionalString(request, "latexExpression", 8000, entity.getRawExpression()));
        auditService.record(userId, "update", "saved-expressions", id, Map.of());
        return savedExpressionDto(entity);
    }

    @Transactional
    public Map<String, Object> deleteSavedExpression(String userId, String id) {
        long deleted = savedExpressionRepository.deleteByIdAndUser_Id(id, userId);
        if (deleted == 0) throw notFound("Saved expression not found");
        auditService.record(userId, "delete", "saved-expressions", id, Map.of());
        return success();
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> projects(String userId) {
        return projectRepository.findByUser_IdOrderByUpdatedAtDescCreatedAtDesc(userId).stream().map(this::projectDto).toList();
    }

    @Transactional
    public Map<String, Object> createProject(String userId, Map<String, Object> request) {
        UserAccount user = user(userId);
        Instant now = Instant.now();
        ProjectEntity project = new ProjectEntity(
            "proj-" + UUID.randomUUID(),
            user,
            optionalString(request, "name", 120, "Untitled Workspace Project"),
            optionalString(request, "description", 1000, "No description provided."),
            now,
            now
        );
        project.replaceSheets(parseSheets(request.get("sheets"), project.getId(), now));
        ProjectEntity saved = projectRepository.save(project);
        auditService.record(userId, "create", "projects", saved.getId(), Map.of("name", saved.getName()));
        return projectDto(saved);
    }

    @Transactional
    public Map<String, Object> updateProject(String userId, String id, Map<String, Object> request) {
        ProjectEntity project = projectRepository.findByIdAndUser_Id(id, userId)
            .orElseThrow(() -> notFound("Project not found"));
        if (request.containsKey("name")) project.setName(optionalString(request, "name", 120, project.getName()));
        if (request.containsKey("description")) project.setDescription(optionalString(request, "description", 1000, project.getDescription()));
        if (request.containsKey("sheets")) project.replaceSheets(parseSheets(request.get("sheets"), project.getId(), Instant.now()));
        project.setUpdatedAt(Instant.now());
        auditService.record(userId, "update", "projects", id, Map.of());
        return projectDto(project);
    }

    @Transactional
    public Map<String, Object> deleteProject(String userId, String id) {
        long deleted = projectRepository.deleteByIdAndUser_Id(id, userId);
        if (deleted == 0) throw notFound("Project not found");
        auditService.record(userId, "delete", "projects", id, Map.of());
        return success();
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> graphs(String userId) {
        return graphConfigurationRepository.findByUser_IdOrderByUpdatedAtDescCreatedAtDesc(userId).stream().map(this::graphDto).toList();
    }

    @Transactional
    public Map<String, Object> createGraph(String userId, Map<String, Object> request) {
        UserAccount user = user(userId);
        ProjectEntity project = optionalProject(userId, request.get("projectId"));
        Instant now = Instant.now();
        GraphConfigurationEntity graph = graphConfigurationRepository.save(new GraphConfigurationEntity(
            "graph-" + UUID.randomUUID(),
            user,
            project,
            optionalString(request, "name", 120, "Untitled Graph"),
            objectMap(request.get("config"), "config", Map.of()),
            now,
            now
        ));
        auditService.record(userId, "create", "graph-configurations", graph.getId(), Map.of());
        return graphDto(graph);
    }

    @Transactional
    public Map<String, Object> updateGraph(String userId, String id, Map<String, Object> request) {
        if (request.isEmpty()) throw badRequest("At least one graph configuration field is required.");
        GraphConfigurationEntity graph = graphConfigurationRepository.findByIdAndUser_Id(id, userId)
            .orElseThrow(() -> notFound("Graph configuration not found"));
        if (request.containsKey("projectId")) graph.setProject(optionalProject(userId, request.get("projectId")));
        if (request.containsKey("name")) graph.setName(optionalString(request, "name", 120, graph.getName()));
        if (request.containsKey("config")) graph.setConfig(objectMap(request.get("config"), "config", graph.getConfig()));
        graph.setUpdatedAt(Instant.now());
        auditService.record(userId, "update", "graph-configurations", id, Map.of());
        return graphDto(graph);
    }

    @Transactional
    public Map<String, Object> deleteGraph(String userId, String id) {
        long deleted = graphConfigurationRepository.deleteByIdAndUser_Id(id, userId);
        if (deleted == 0) throw notFound("Graph configuration not found");
        auditService.record(userId, "delete", "graph-configurations", id, Map.of());
        return success();
    }

    @Transactional(readOnly = true)
    public Map<String, Object> shares(String userId) {
        return Map.of(
            "outgoing", outgoingShares(userId),
            "incoming", incomingShares(userId)
        );
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> outgoingShares(String userId) {
        return sharedWorkspaceRepository.findByOwner_IdOrderByCreatedAtDesc(userId).stream().map(this::shareDto).toList();
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> incomingShares(String userId) {
        return sharedWorkspaceRepository.findBySharedWith_IdOrderByCreatedAtDesc(userId).stream().map(this::shareDto).toList();
    }

    @Transactional
    public Map<String, Object> createShare(String userId, Map<String, Object> request) {
        ProjectEntity project = projectRepository.findByIdAndUser_Id(requiredString(request, "projectId", 1, 80), userId)
            .orElseThrow(() -> notFound("Project not found"));
        UserAccount recipient = userRepository.findByEmailIgnoreCase(normalizeEmail(requiredString(request, "sharedWithEmail", 1, 254)))
            .orElseThrow(() -> notFound("Recipient user not found"));
        if (recipient.getId().equals(userId)) throw badRequest("You cannot share a workspace with yourself.");
        String role = role(request.get("role"), "viewer");
        SharedWorkspaceEntity share = sharedWorkspaceRepository.findByProject_IdAndSharedWith_Id(project.getId(), recipient.getId())
            .orElseGet(() -> new SharedWorkspaceEntity("share-" + UUID.randomUUID(), project, user(userId), recipient, role, Instant.now()));
        share.setRole(role);
        SharedWorkspaceEntity saved = sharedWorkspaceRepository.save(share);
        auditService.record(userId, "create", "shared-workspaces", saved.getId(), Map.of("projectId", project.getId()));
        return shareDto(saved);
    }

    @Transactional
    public Map<String, Object> updateShare(String userId, String id, Map<String, Object> request) {
        SharedWorkspaceEntity share = sharedWorkspaceRepository.findByIdAndOwner_Id(id, userId)
            .orElseThrow(() -> notFound("Shared workspace not found"));
        share.setRole(role(request.get("role"), null));
        auditService.record(userId, "update", "shared-workspaces", id, Map.of());
        return shareDto(share);
    }

    @Transactional
    public Map<String, Object> deleteShare(String userId, String id) {
        long deleted = sharedWorkspaceRepository.deleteByIdAndOwner_Id(id, userId);
        if (deleted == 0) throw notFound("Shared workspace not found");
        auditService.record(userId, "delete", "shared-workspaces", id, Map.of());
        return success();
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> history(String userId) {
        if (userId == null) return List.of();
        return historyRepository.findByUser_IdOrderByCreatedAtDesc(userId).stream().map(this::historyDto).toList();
    }

    @Transactional
    public Map<String, Object> createHistory(String userId, Map<String, Object> request) {
        String type = requiredString(request, "type", 1, 40);
        if (!CALCULATION_TYPES.contains(type)) throw badRequest("Unsupported calculation type.");
        CalculationHistoryEntity entity = historyRepository.save(new CalculationHistoryEntity(
            "hist-" + UUID.randomUUID(),
            userId == null ? null : user(userId),
            type,
            requiredString(request, "input", 0, 4000),
            requiredString(request, "output", 0, 8000),
            optionalNullableString(request, "latexInput", 8000),
            optionalNullableString(request, "latexOutput", 8000),
            stringList(request.get("steps"), 200),
            optionalNullableString(request, "explanation", 10000),
            Instant.now()
        ));
        if (userId != null) auditService.record(userId, "create", "history", entity.getId(), Map.of("type", type));
        return historyDto(entity);
    }

    private UserAccount user(String userId) {
        return userRepository.findById(userId).orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Authentication required."));
    }

    private ProjectEntity optionalProject(String userId, Object projectId) {
        if (projectId == null) return null;
        String id = stringValue(projectId, "projectId", 1, 80);
        return projectRepository.findByIdAndUser_Id(id, userId).orElseThrow(() -> notFound("Project not found"));
    }

    private List<ProjectSheetEntity> parseSheets(Object value, String projectId, Instant now) {
        if (value == null) {
            return List.of(new ProjectSheetEntity("sheet-" + UUID.randomUUID(), "Workspace 1", Map.of(), now, now));
        }
        if (!(value instanceof List<?> list) || list.size() > 20) throw badRequest("Project sheets must be an array with at most 20 items.");
        List<ProjectSheetEntity> sheets = new ArrayList<>();
        for (Object item : list) {
            if (!(item instanceof Map<?, ?> sheet)) throw badRequest("Project sheet must be an object.");
            sheets.add(new ProjectSheetEntity(
                stringValue(sheet.get("id"), "sheet.id", 1, 80),
                stringValue(sheet.get("name"), "sheet.name", 1, 120),
                stringMap(sheet.get("cells"), "sheet.cells"),
                now,
                now
            ));
        }
        return sheets;
    }

    private Map<String, Object> savedExpressionDto(SavedExpressionEntity entity) {
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id", entity.getId());
        dto.put("userId", entity.getUser().getId());
        dto.put("name", entity.getName());
        dto.put("rawExpression", entity.getRawExpression());
        dto.put("latexExpression", entity.getLatexExpression());
        dto.put("createdAt", entity.getCreatedAt());
        return dto;
    }

    private Map<String, Object> projectDto(ProjectEntity project) {
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id", project.getId());
        dto.put("userId", project.getUser().getId());
        dto.put("name", project.getName());
        dto.put("description", project.getDescription());
        dto.put("sheets", project.getSheets().stream().map(this::sheetDto).toList());
        dto.put("createdAt", project.getCreatedAt());
        dto.put("updatedAt", project.getUpdatedAt());
        return dto;
    }

    private Map<String, Object> sheetDto(ProjectSheetEntity sheet) {
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id", sheet.getId());
        dto.put("name", sheet.getName());
        dto.put("cells", sheet.getCells());
        return dto;
    }

    private Map<String, Object> graphDto(GraphConfigurationEntity graph) {
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id", graph.getId());
        dto.put("userId", graph.getUser().getId());
        if (graph.getProject() != null) dto.put("projectId", graph.getProject().getId());
        dto.put("name", graph.getName());
        dto.put("config", graph.getConfig());
        dto.put("createdAt", graph.getCreatedAt());
        dto.put("updatedAt", graph.getUpdatedAt());
        return dto;
    }

    private Map<String, Object> shareDto(SharedWorkspaceEntity share) {
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id", share.getId());
        dto.put("projectId", share.getProject().getId());
        dto.put("ownerUserId", share.getOwner().getId());
        dto.put("sharedWithUserId", share.getSharedWith().getId());
        dto.put("role", share.getRole());
        dto.put("createdAt", share.getCreatedAt());
        dto.put("projectName", share.getProject().getName());
        dto.put("ownerEmail", share.getOwner().getEmail());
        dto.put("ownerUsername", share.getOwner().getUsername());
        dto.put("sharedWithEmail", share.getSharedWith().getEmail());
        dto.put("sharedWithUsername", share.getSharedWith().getUsername());
        return dto;
    }

    private Map<String, Object> historyDto(CalculationHistoryEntity entity) {
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id", entity.getId());
        if (entity.getUser() != null) dto.put("userId", entity.getUser().getId());
        dto.put("type", entity.getType());
        dto.put("input", entity.getInput());
        dto.put("output", entity.getOutput());
        if (entity.getLatexInput() != null) dto.put("latexInput", entity.getLatexInput());
        if (entity.getLatexOutput() != null) dto.put("latexOutput", entity.getLatexOutput());
        dto.put("steps", entity.getSteps());
        dto.put("explanation", entity.getExplanation() == null ? "" : entity.getExplanation());
        dto.put("createdAt", entity.getCreatedAt());
        return dto;
    }

    private static Map<String, Object> success() {
        return Map.of("success", true);
    }

    private static String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private static String role(Object value, String fallback) {
        String role = value == null ? fallback : stringValue(value, "role", 1, 20);
        if (!"viewer".equals(role) && !"editor".equals(role)) throw badRequest("Role must be viewer or editor.");
        return role;
    }

    private static String requiredString(Map<String, Object> request, String field, int min, int max) {
        if (!request.containsKey(field)) throw badRequest(field + " is required.");
        return stringValue(request.get(field), field, min, max);
    }

    private static String optionalString(Map<String, Object> request, String field, int max, String fallback) {
        if (!request.containsKey(field) || request.get(field) == null) return fallback;
        return stringValue(request.get(field), field, 1, max);
    }

    private static String optionalNullableString(Map<String, Object> request, String field, int max) {
        if (!request.containsKey(field) || request.get(field) == null) return null;
        return stringValue(request.get(field), field, 0, max);
    }

    private static String stringValue(Object value, String field, int min, int max) {
        if (!(value instanceof String string)) throw badRequest(field + " must be a string.");
        String trimmed = string.trim();
        if (trimmed.length() < min || trimmed.length() > max) throw badRequest(field + " length is invalid.");
        return trimmed;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> objectMap(Object value, String field, Map<String, Object> fallback) {
        if (value == null) return fallback;
        if (!(value instanceof Map<?, ?> map)) throw badRequest(field + " must be an object.");
        return new LinkedHashMap<>((Map<String, Object>) map);
    }

    private static Map<String, String> stringMap(Object value, String field) {
        if (value == null) return Map.of();
        if (!(value instanceof Map<?, ?> map)) throw badRequest(field + " must be an object.");
        Map<String, String> result = new LinkedHashMap<>();
        for (Map.Entry<?, ?> entry : map.entrySet()) {
            if (!(entry.getKey() instanceof String key) || !(entry.getValue() instanceof String cellValue)) {
                throw badRequest(field + " must contain string keys and values.");
            }
            if (cellValue.length() > 500) throw badRequest(field + " cell value is too long.");
            result.put(key, cellValue);
        }
        return result;
    }

    private static List<String> stringList(Object value, int max) {
        if (value == null) return List.of();
        if (!(value instanceof List<?> list) || list.size() > max) throw badRequest("steps must be an array.");
        List<String> result = new ArrayList<>();
        for (Object item : list) {
            if (!(item instanceof String string) || string.length() > 4000) throw badRequest("steps must contain strings.");
            result.add(string);
        }
        return result;
    }

    private static ApiException badRequest(String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, message);
    }

    private static ApiException notFound(String message) {
        return new ApiException(HttpStatus.NOT_FOUND, message);
    }
}
