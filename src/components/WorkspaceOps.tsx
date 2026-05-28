import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Activity,
  BookMarked,
  Circle,
  Database,
  FolderOpen,
  Play,
  RefreshCw,
  Save,
  Share2,
  Trash2
} from 'lucide-react';
import {
  AuditLog,
  CacheStatus,
  GraphConfigurationRecord,
  GraphEquation,
  Project,
  SavedExpression,
  SharedWorkspace
} from '../types';

interface WorkspaceOpsProps {
  token?: string | null;
  graphEquations: GraphEquation[];
  onLoadGraphEquations: (equations: GraphEquation[]) => void;
  onAddGraphEquation: (expression: string) => void;
}

interface SharedWorkspacePayload {
  outgoing: SharedWorkspace[];
  incoming: SharedWorkspace[];
}

const emptyShares: SharedWorkspacePayload = { outgoing: [], incoming: [] };

export default function WorkspaceOps({ token, graphEquations, onLoadGraphEquations, onAddGraphEquation }: WorkspaceOpsProps) {
  const [savedExpressions, setSavedExpressions] = useState<SavedExpression[]>([]);
  const [graphConfigurations, setGraphConfigurations] = useState<GraphConfigurationRecord[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [sharedWorkspaces, setSharedWorkspaces] = useState<SharedWorkspacePayload>(emptyShares);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [cacheStatus, setCacheStatus] = useState<CacheStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [expressionName, setExpressionName] = useState('Reusable expression');
  const [rawExpression, setRawExpression] = useState('sin(x) * x');
  const [latexExpression, setLatexExpression] = useState('');
  const [graphName, setGraphName] = useState('Current graph view');
  const [graphProjectId, setGraphProjectId] = useState('');
  const [shareProjectId, setShareProjectId] = useState('');
  const [shareEmail, setShareEmail] = useState('');
  const [shareRole, setShareRole] = useState<'viewer' | 'editor'>('viewer');

  const headers = useMemo(() => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  }), [token]);

  const fetchJson = async <T,>(path: string, init: RequestInit = {}) => {
    const response = await fetch(path, {
      ...init,
      headers: {
        ...headers,
        ...(init.headers || {})
      }
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `Request failed: ${path}`);
    }
    return data as T;
  };

  const refresh = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [expressions, graphs, projectList, shares, logs, cache] = await Promise.all([
        fetchJson<SavedExpression[]>('/api/saved-expressions'),
        fetchJson<GraphConfigurationRecord[]>('/api/graph-configurations'),
        fetchJson<Project[]>('/api/projects'),
        fetchJson<SharedWorkspacePayload>('/api/shared-workspaces'),
        fetchJson<AuditLog[]>('/api/audit-logs?limit=30'),
        fetchJson<CacheStatus>('/api/cache/status')
      ]);
      setSavedExpressions(expressions);
      setGraphConfigurations(graphs);
      setProjects(projectList);
      setSharedWorkspaces(shares);
      setAuditLogs(logs);
      setCacheStatus(cache);
      if (!graphProjectId && projectList[0]) setGraphProjectId(projectList[0].id);
      if (!shareProjectId && projectList[0]) setShareProjectId(projectList[0].id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      setSavedExpressions([]);
      setGraphConfigurations([]);
      setProjects([]);
      setSharedWorkspaces(emptyShares);
      setAuditLogs([]);
      setCacheStatus(null);
      return;
    }
    void refresh();
  }, [token]);

  const createExpression = async () => {
    if (!rawExpression.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await fetchJson<SavedExpression>('/api/saved-expressions', {
        method: 'POST',
        body: JSON.stringify({
          name: expressionName.trim() || rawExpression.trim(),
          rawExpression: rawExpression.trim(),
          latexExpression: latexExpression.trim() || rawExpression.trim()
        })
      });
      setExpressionName('Reusable expression');
      setRawExpression('');
      setLatexExpression('');
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const deleteExpression = async (id: string) => {
    await fetchJson(`/api/saved-expressions/${id}`, { method: 'DELETE' });
    await refresh();
  };

  const saveGraphConfiguration = async () => {
    if (graphEquations.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      await fetchJson<GraphConfigurationRecord>('/api/graph-configurations', {
        method: 'POST',
        body: JSON.stringify({
          name: graphName.trim() || 'Current graph view',
          projectId: graphProjectId || undefined,
          config: {
            equations: graphEquations,
            savedFrom: 'graph-hud',
            savedAt: new Date().toISOString()
          }
        })
      });
      setGraphName('Current graph view');
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const deleteGraphConfiguration = async (id: string) => {
    await fetchJson(`/api/graph-configurations/${id}`, { method: 'DELETE' });
    await refresh();
  };

  const shareWorkspace = async () => {
    if (!shareProjectId || !shareEmail.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await fetchJson<SharedWorkspace>('/api/shared-workspaces', {
        method: 'POST',
        body: JSON.stringify({
          projectId: shareProjectId,
          sharedWithEmail: shareEmail.trim(),
          role: shareRole
        })
      });
      setShareEmail('');
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const updateShareRole = async (id: string, role: 'viewer' | 'editor') => {
    await fetchJson<SharedWorkspace>(`/api/shared-workspaces/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ role })
    });
    await refresh();
  };

  const deleteShare = async (id: string) => {
    await fetchJson(`/api/shared-workspaces/${id}`, { method: 'DELETE' });
    await refresh();
  };

  if (!token) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-8 text-center shadow-sm">
        <Database className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Workspace operations require a profile</h2>
        <p className="text-xs text-slate-500 mt-2 max-w-md mx-auto">
          Connect a profile to manage saved expressions, graph snapshots, workspace sharing, audit logs, and cache status.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
      <div className="xl:col-span-12 flex items-center justify-between gap-3 bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-indigo-600" />
          <div>
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Workspace Operations</h2>
            <p className="text-[11px] text-slate-500">Saved assets, collaboration controls, cache state, and audit history.</p>
          </div>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="h-8 px-3 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white text-xs font-semibold rounded-md flex items-center gap-2"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="xl:col-span-12 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg p-3">
          {error}
        </div>
      )}

      <section className="xl:col-span-6 bg-white border border-slate-200 rounded-lg p-4 shadow-sm flex flex-col gap-3">
        <PanelTitle icon={<BookMarked className="w-4 h-4 text-indigo-600" />} title="Saved Expressions" count={savedExpressions.length} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <input value={expressionName} onChange={event => setExpressionName(event.target.value)} className="ops-input" placeholder="Name" />
          <input value={rawExpression} onChange={event => setRawExpression(event.target.value)} className="ops-input" placeholder="Expression" />
          <input value={latexExpression} onChange={event => setLatexExpression(event.target.value)} className="ops-input" placeholder="LaTeX optional" />
        </div>
        <button onClick={createExpression} disabled={saving || !rawExpression.trim()} className="ops-primary-button">
          <Save className="w-3.5 h-3.5" />
          Save Expression
        </button>
        <div className="ops-list">
          {savedExpressions.map(expression => (
            <div key={expression.id} className="ops-row">
              <div className="min-w-0">
                <p className="ops-row-title">{expression.name}</p>
                <p className="ops-row-subtitle">{expression.rawExpression}</p>
              </div>
              <div className="ops-row-actions">
                <button onClick={() => onAddGraphEquation(expression.rawExpression)} className="ops-icon-button" title="Plot expression">
                  <Play className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => void deleteExpression(expression.id)} className="ops-icon-button danger" title="Delete expression">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
          {savedExpressions.length === 0 && <EmptyText text="No saved expressions yet." />}
        </div>
      </section>

      <section className="xl:col-span-6 bg-white border border-slate-200 rounded-lg p-4 shadow-sm flex flex-col gap-3">
        <PanelTitle icon={<FolderOpen className="w-4 h-4 text-indigo-600" />} title="Graph Library" count={graphConfigurations.length} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <input value={graphName} onChange={event => setGraphName(event.target.value)} className="ops-input" placeholder="Graph snapshot name" />
          <select value={graphProjectId} onChange={event => setGraphProjectId(event.target.value)} className="ops-input">
            <option value="">No project link</option>
            {projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
        </div>
        <button onClick={saveGraphConfiguration} disabled={saving || graphEquations.length === 0} className="ops-primary-button">
          <Save className="w-3.5 h-3.5" />
          Save Current Graph
        </button>
        <div className="ops-list">
          {graphConfigurations.map(config => (
            <div key={config.id} className="ops-row">
              <div className="min-w-0">
                <p className="ops-row-title">{config.name}</p>
                <p className="ops-row-subtitle">{config.config.equations?.length || 0} plotted equations</p>
              </div>
              <div className="ops-row-actions">
                <button
                  onClick={() => config.config.equations && onLoadGraphEquations(config.config.equations)}
                  className="ops-icon-button"
                  title="Load graph snapshot"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => void deleteGraphConfiguration(config.id)} className="ops-icon-button danger" title="Delete graph snapshot">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
          {graphConfigurations.length === 0 && <EmptyText text="No saved graph snapshots yet." />}
        </div>
      </section>

      <section className="xl:col-span-7 bg-white border border-slate-200 rounded-lg p-4 shadow-sm flex flex-col gap-3">
        <PanelTitle icon={<Share2 className="w-4 h-4 text-indigo-600" />} title="Shared Workspaces" count={sharedWorkspaces.outgoing.length + sharedWorkspaces.incoming.length} />
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_120px] gap-2">
          <select value={shareProjectId} onChange={event => setShareProjectId(event.target.value)} className="ops-input">
            <option value="">Select project</option>
            {projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
          <input value={shareEmail} onChange={event => setShareEmail(event.target.value)} className="ops-input" placeholder="colleague@example.com" />
          <select value={shareRole} onChange={event => setShareRole(event.target.value as 'viewer' | 'editor')} className="ops-input">
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
          </select>
        </div>
        <button onClick={shareWorkspace} disabled={saving || !shareProjectId || !shareEmail.trim()} className="ops-primary-button">
          <Share2 className="w-3.5 h-3.5" />
          Share Project
        </button>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <ShareList
            title="Outgoing"
            shares={sharedWorkspaces.outgoing}
            editable
            onRoleChange={updateShareRole}
            onDelete={deleteShare}
          />
          <ShareList title="Incoming" shares={sharedWorkspaces.incoming} />
        </div>
      </section>

      <section className="xl:col-span-5 bg-white border border-slate-200 rounded-lg p-4 shadow-sm flex flex-col gap-3">
        <PanelTitle icon={<Activity className="w-4 h-4 text-indigo-600" />} title="Operations Status" count={auditLogs.length} />
        <div className="grid grid-cols-2 gap-2">
          <StatusPill label="Cache" value={cacheStatus ? cacheStatus.provider : 'unknown'} active={Boolean(cacheStatus?.enabled)} />
          <StatusPill label="TTL" value={cacheStatus ? `${cacheStatus.ttlSeconds}s` : '-'} active />
        </div>
        <div className="ops-list max-h-80">
          {auditLogs.map(log => (
            <div key={log.id} className="ops-row items-start">
              <div className="min-w-0">
                <p className="ops-row-title">{log.action} · {log.resource}</p>
                <p className="ops-row-subtitle">{new Date(log.createdAt).toLocaleString()}</p>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">{log.metadata?.statusCode as string || '200'}</span>
            </div>
          ))}
          {auditLogs.length === 0 && <EmptyText text="No audit entries yet." />}
        </div>
      </section>
    </div>
  );
}

function PanelTitle({ icon, title, count }: { icon: ReactNode; title: string; count: number }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-xs font-bold uppercase tracking-wide text-slate-700">{title}</span>
      </div>
      <span className="text-[10px] font-mono text-slate-400">{count}</span>
    </div>
  );
}

function ShareList({
  title,
  shares,
  editable = false,
  onRoleChange,
  onDelete
}: {
  title: string;
  shares: SharedWorkspace[];
  editable?: boolean;
  onRoleChange?: (id: string, role: 'viewer' | 'editor') => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}) {
  return (
    <div className="border border-slate-200 rounded-lg p-2">
      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide mb-2">{title}</p>
      <div className="flex flex-col gap-2 max-h-52 overflow-y-auto">
        {shares.map(share => (
          <div key={share.id} className="ops-row">
            <div className="min-w-0">
              <p className="ops-row-title">{share.projectName || share.projectId}</p>
              <p className="ops-row-subtitle">{editable ? share.sharedWithEmail : share.ownerEmail}</p>
            </div>
            {editable ? (
              <div className="ops-row-actions">
                <select
                  value={share.role}
                  onChange={event => void onRoleChange?.(share.id, event.target.value as 'viewer' | 'editor')}
                  className="h-7 rounded border border-slate-200 bg-white text-[10px] text-slate-600"
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                </select>
                <button onClick={() => void onDelete?.(share.id)} className="ops-icon-button danger" title="Remove share">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <span className="text-[10px] font-mono text-slate-500 capitalize">{share.role}</span>
            )}
          </div>
        ))}
        {shares.length === 0 && <EmptyText text={`No ${title.toLowerCase()} shares.`} />}
      </div>
    </div>
  );
}

function StatusPill({ label, value, active }: { label: string; value: string; active: boolean }) {
  return (
    <div className="border border-slate-200 rounded-lg p-3 flex items-center justify-between">
      <div>
        <p className="text-[10px] text-slate-400 font-bold uppercase">{label}</p>
        <p className="text-xs text-slate-700 font-semibold">{value}</p>
      </div>
      <Circle className={`w-3 h-3 ${active ? 'fill-emerald-500 text-emerald-500' : 'fill-amber-500 text-amber-500'}`} />
    </div>
  );
}

function EmptyText({ text }: { text: string }) {
  return <div className="text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg p-4">{text}</div>;
}
