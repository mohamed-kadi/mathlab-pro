import { useState, useEffect } from 'react';
import { Briefcase, Plus, Sheet, RefreshCw, Trash2, Edit2, Play } from 'lucide-react';
import { create, all } from 'mathjs';
import { Project, SpreadsheetData } from '../types';

const math = create(all);
const CELL_PATTERN = /^[A-D][1-5]$/;

interface WorkspaceSpreadsheetProps {
  token?: string | null;
}

export default function WorkspaceSpreadsheet({ token }: WorkspaceSpreadsheetProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<SpreadsheetData | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New project modal simple fields
  const [newProjName, setNewProjName] = useState("");
  const [newProjDesc, setNewProjDesc] = useState("");

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const resp = await fetch('/api/projects', {
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      const data = await resp.json();
      if (resp.ok) {
        setProjects(data);
        if (data.length > 0 && !selectedProject) {
          setSelectedProject(data[0]);
          if (data[0].sheets?.length > 0) {
            setSelectedSheet(data[0].sheets[0]);
          }
        }
      }
    } catch {
      console.error("Failed to fetch workspaces.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [token]);

  const handleCreateProject = async () => {
    if (!newProjName) return;
    try {
      const resp = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          name: newProjName,
          description: newProjDesc,
          sheets: [{ id: "sheet-" + Math.random().toString(36).substring(2, 7), name: "Constant Sheet 1", cells: { "A1": "10.5", "B1": "20.2", "C1": "A1 + B1" } }]
        })
      });
      if (resp.ok) {
        setNewProjName("");
        setNewProjDesc("");
        fetchProjects();
      }
    } catch {
      setError("Failed to create new scientific project workspace.");
    }
  };

  const handleDeleteProject = async (id: string) => {
    try {
      const resp = await fetch(`/api/projects/${id}`, {
        method: 'DELETE',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      if (resp.ok) {
        if (selectedProject?.id === id) {
          setSelectedProject(null);
          setSelectedSheet(null);
        }
        fetchProjects();
      }
    } catch {
      console.error("Failed to delete project.");
    }
  };

  const handleCellBlur = async (cellId: string, value: string) => {
    if (!selectedProject || !selectedSheet) return;
    
    const updatedCells = { ...selectedSheet.cells, [cellId]: value };
    const updatedSheets = selectedProject.sheets.map(sh =>
      sh.id === selectedSheet.id ? { ...sh, cells: updatedCells } : sh
    );

    // Update locally first for speed HMR
    setSelectedSheet({ ...selectedSheet, cells: updatedCells });
    setSelectedProject({ ...selectedProject, sheets: updatedSheets });

    // Sync to database
    try {
      await fetch(`/api/projects/${selectedProject.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ sheets: updatedSheets })
      });
    } catch {
      console.error("Failed database cell synchronization.");
    }
  };

  const evaluateCellVal = (cells: Record<string, string>, currentCell: string, visited = new Set<string>()): string => {
    const rawValue = cells[currentCell] || '';
    if (!rawValue.startsWith('=')) return rawValue;
    if (visited.has(currentCell)) return "#CYCLE!";

    // Evaluate arithmetic-only spreadsheet formulas without executing JavaScript.
    try {
      visited.add(currentCell);
      const formula = rawValue.substring(1); // Strip '='
      const tokens = formula.match(/[A-Z]\d+|\d+(?:\.\d+)?|[+\-*/^%()]|\s+/g) || [];
      if (tokens.join('') !== formula) return "#VALUE!";

      const variablesScope: Record<string, number> = {};
      const referencedCells = Array.from(new Set(tokens.filter(token => /^[A-Z]\d+$/.test(token))));
      for (const cellId of referencedCells) {
        if (!CELL_PATTERN.test(cellId)) return "#REF!";
        const dep = evaluateCellVal(cells, cellId, new Set(visited));
        const numericValue = Number(dep);
        if (!Number.isFinite(numericValue)) return "#REF!";
        variablesScope[cellId] = numericValue;
      }

      const result = math.evaluate(formula, variablesScope);
      return typeof result === 'number' && Number.isFinite(result) ? result.toFixed(3) : "Err eval";
    } catch {
      return "#REF!";
    }
  };

  // Helper row & col labels
  const columns = ['A', 'B', 'C', 'D'];
  const rowNumbers = [1, 2, 3, 4, 5];

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-5 p-1">
      {/* WORKSPACE DIRECTORY PANEL */}
      <div className="md:col-span-4 bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex flex-col space-y-4 shadow-xl">
        <span className="text-xs font-bold text-zinc-300 uppercase tracking-wide flex items-center space-x-1.5 font-mono border-b border-zinc-850 pb-2">
          <Briefcase className="w-4 h-4 text-indigo-500" />
          <span>Projects Directory</span>
        </span>

        <div className="flex flex-col space-y-2 max-h-[200px] overflow-y-auto">
          {projects.map(proj => (
            <div
              key={proj.id}
              onClick={() => { setSelectedProject(proj); if (proj.sheets?.length > 0) setSelectedSheet(proj.sheets[0]); }}
              className={`p-2.5 rounded-lg border text-xs cursor-pointer transition flex items-center justify-between ${selectedProject?.id === proj.id ? 'bg-indigo-950/40 border-indigo-700 text-zinc-100' : 'bg-zinc-950 border-zinc-850 text-zinc-400 hover:text-zinc-200'}`}
            >
              <div className="flex flex-col space-y-0.5">
                <span className="font-semibold text-zinc-200">{proj.name}</span>
                <span className="text-[10px] text-zinc-500 max-w-[180px] truncate">{proj.description}</span>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handleDeleteProject(proj.id); }}
                className="text-zinc-500 hover:text-red-400 p-1 rounded"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        {/* CREATE WORKSPACE MODAL */}
        <div className="bg-zinc-950 border border-zinc-850 p-3 rounded-xl flex flex-col space-y-2.5 pt-4">
          <span className="text-[10px] font-bold text-zinc-400 uppercase font-mono">Create Workspace Project</span>
          <input
            type="text"
            value={newProjName}
            onChange={(e) => setNewProjName(e.target.value)}
            placeholder="Workspaces Name"
            className="bg-zinc-900 border border-zinc-800 p-2 text-xs rounded text-zinc-200 focus:outline-none focus:border-indigo-500"
          />
          <input
            type="text"
            value={newProjDesc}
            onChange={(e) => setNewProjDesc(e.target.value)}
            placeholder="Descriptions"
            className="bg-zinc-900 border border-zinc-800 p-2 text-xs rounded text-zinc-200 focus:outline-none focus:border-indigo-500"
          />
          <button
            onClick={handleCreateProject}
            disabled={!newProjName}
            className="bg-indigo-600 hover:bg-indigo-500 text-zinc-100 p-1.5 rounded text-xs font-semibold cursor-pointer disabled:bg-indigo-800/20 disabled:text-zinc-600 transition"
          >
            Create
          </button>
        </div>
      </div>

      {/* DETAILED ACTIVE CALCULATOR SPREADSHEET CARD */}
      <div className="md:col-span-8 bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex flex-col space-y-4 shadow-xl">
        {selectedProject && selectedSheet ? (
          <>
            <div className="flex justify-between items-center border-b border-zinc-850 pb-2.5 flex-wrap gap-2">
              <div className="flex items-center space-x-2">
                <Sheet className="w-4 h-4 text-emerald-500 animate-pulse" />
                <span className="text-xs font-bold text-zinc-200 font-mono">{selectedProject.name} ⇒ {selectedSheet.name}</span>
              </div>
              <div className="text-[10px] bg-zinc-950/70 p-1 px-2.5 rounded border border-zinc-900 font-mono text-zinc-500">
                Formula support: Type `=A1+B1` to link dependencies cell-wise
              </div>
            </div>

            {/* SPREADSHEET TABLE GRID CONTAINER */}
            <div className="overflow-x-auto bg-zinc-950 p-4 border border-zinc-850 rounded-xl">
              <table className="w-full text-left border-collapse min-w-[360px]">
                <thead>
                  <tr>
                    <th className="bg-zinc-900 border border-zinc-800 p-1 text-center font-mono text-xs text-zinc-500 w-12">CELL</th>
                    {columns.map(col => (
                      <th key={col} className="bg-zinc-900 border border-zinc-850 p-2 text-center font-mono text-xs text-zinc-400 font-bold">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rowNumbers.map(rowNum => (
                    <tr key={rowNum}>
                      <td className="bg-zinc-900 border border-zinc-850 text-center font-mono text-xs text-zinc-500 font-bold p-1">{rowNum}</td>
                      {columns.map(col => {
                        const cellId = `${col}${rowNum}`;
                        const raw = selectedSheet.cells[cellId] || '';
                        const evaluated = evaluateCellVal(selectedSheet.cells, cellId);

                        return (
                          <td key={cellId} className="border border-zinc-850 p-1.5 relative group">
                            <input
                              type="text"
                              value={raw}
                              onChange={(e) => handleCellBlur(cellId, e.target.value)}
                              className="w-full bg-transparent p-1 text-xs text-indigo-400 font-mono focus:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded transition placeholder:text-zinc-800"
                              placeholder="0.00"
                            />
                            {raw.startsWith('=') && (
                              <div className="absolute top-1 right-2 text-[8px] font-bold text-amber-500 pointer-events-none select-none font-mono">
                                val: {evaluated}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-zinc-500">
            <Sheet className="w-12 h-12 text-zinc-700 mb-2 animate-bounce" />
            <span className="text-xs font-semibold">Select or build a scientific workspace project file directory on the left sidebar directory index.</span>
          </div>
        )}
      </div>
    </div>
  );
}
