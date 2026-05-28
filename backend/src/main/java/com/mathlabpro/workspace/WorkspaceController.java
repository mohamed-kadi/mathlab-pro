package com.mathlabpro.workspace;

import java.util.List;
import java.util.Map;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class WorkspaceController {

    private final WorkspaceService workspaceService;
    private final AuditService auditService;

    public WorkspaceController(WorkspaceService workspaceService, AuditService auditService) {
        this.workspaceService = workspaceService;
        this.auditService = auditService;
    }

    @GetMapping("/audit-logs")
    public List<Map<String, Object>> auditLogs(@AuthenticationPrincipal Jwt jwt, @RequestParam(defaultValue = "100") int limit) {
        return auditService.listForUser(jwt.getSubject(), limit);
    }

    @GetMapping("/saved-expressions")
    public List<Map<String, Object>> savedExpressions(@AuthenticationPrincipal Jwt jwt) {
        return workspaceService.savedExpressions(jwt.getSubject());
    }

    @PostMapping("/saved-expressions")
    public Map<String, Object> createSavedExpression(@AuthenticationPrincipal Jwt jwt, @RequestBody Map<String, Object> request) {
        return workspaceService.createSavedExpression(jwt.getSubject(), request);
    }

    @PutMapping("/saved-expressions/{id}")
    public Map<String, Object> updateSavedExpression(@AuthenticationPrincipal Jwt jwt, @PathVariable String id, @RequestBody Map<String, Object> request) {
        return workspaceService.updateSavedExpression(jwt.getSubject(), id, request);
    }

    @DeleteMapping("/saved-expressions/{id}")
    public Map<String, Object> deleteSavedExpression(@AuthenticationPrincipal Jwt jwt, @PathVariable String id) {
        return workspaceService.deleteSavedExpression(jwt.getSubject(), id);
    }

    @GetMapping("/projects")
    public List<Map<String, Object>> projects(@AuthenticationPrincipal Jwt jwt) {
        return workspaceService.projects(jwt.getSubject());
    }

    @PostMapping("/projects")
    public Map<String, Object> createProject(@AuthenticationPrincipal Jwt jwt, @RequestBody Map<String, Object> request) {
        return workspaceService.createProject(jwt.getSubject(), request);
    }

    @PutMapping("/projects/{id}")
    public Map<String, Object> updateProject(@AuthenticationPrincipal Jwt jwt, @PathVariable String id, @RequestBody Map<String, Object> request) {
        return workspaceService.updateProject(jwt.getSubject(), id, request);
    }

    @DeleteMapping("/projects/{id}")
    public Map<String, Object> deleteProject(@AuthenticationPrincipal Jwt jwt, @PathVariable String id) {
        return workspaceService.deleteProject(jwt.getSubject(), id);
    }

    @GetMapping("/graph-configurations")
    public List<Map<String, Object>> graphs(@AuthenticationPrincipal Jwt jwt) {
        return workspaceService.graphs(jwt.getSubject());
    }

    @PostMapping("/graph-configurations")
    public Map<String, Object> createGraph(@AuthenticationPrincipal Jwt jwt, @RequestBody Map<String, Object> request) {
        return workspaceService.createGraph(jwt.getSubject(), request);
    }

    @PutMapping("/graph-configurations/{id}")
    public Map<String, Object> updateGraph(@AuthenticationPrincipal Jwt jwt, @PathVariable String id, @RequestBody Map<String, Object> request) {
        return workspaceService.updateGraph(jwt.getSubject(), id, request);
    }

    @DeleteMapping("/graph-configurations/{id}")
    public Map<String, Object> deleteGraph(@AuthenticationPrincipal Jwt jwt, @PathVariable String id) {
        return workspaceService.deleteGraph(jwt.getSubject(), id);
    }

    @GetMapping("/shared-workspaces")
    public Map<String, Object> shares(@AuthenticationPrincipal Jwt jwt) {
        return workspaceService.shares(jwt.getSubject());
    }

    @GetMapping("/shared-workspaces/outgoing")
    public List<Map<String, Object>> outgoingShares(@AuthenticationPrincipal Jwt jwt) {
        return workspaceService.outgoingShares(jwt.getSubject());
    }

    @GetMapping("/shared-workspaces/incoming")
    public List<Map<String, Object>> incomingShares(@AuthenticationPrincipal Jwt jwt) {
        return workspaceService.incomingShares(jwt.getSubject());
    }

    @PostMapping("/shared-workspaces")
    public Map<String, Object> createShare(@AuthenticationPrincipal Jwt jwt, @RequestBody Map<String, Object> request) {
        return workspaceService.createShare(jwt.getSubject(), request);
    }

    @PutMapping("/shared-workspaces/{id}")
    public Map<String, Object> updateShare(@AuthenticationPrincipal Jwt jwt, @PathVariable String id, @RequestBody Map<String, Object> request) {
        return workspaceService.updateShare(jwt.getSubject(), id, request);
    }

    @DeleteMapping("/shared-workspaces/{id}")
    public Map<String, Object> deleteShare(@AuthenticationPrincipal Jwt jwt, @PathVariable String id) {
        return workspaceService.deleteShare(jwt.getSubject(), id);
    }

    @GetMapping("/history")
    public List<Map<String, Object>> history(@AuthenticationPrincipal Jwt jwt) {
        return workspaceService.history(jwt == null ? null : jwt.getSubject());
    }

    @PostMapping("/history")
    public Map<String, Object> createHistory(@AuthenticationPrincipal Jwt jwt, @RequestBody Map<String, Object> request) {
        return workspaceService.createHistory(jwt == null ? null : jwt.getSubject(), request);
    }
}
