import { useState, useEffect } from 'react';
import {
  Binary,
  Cpu,
  Bookmark,
  Sigma,
  GitBranch,
  LineChart,
  Code2,
  Sparkles,
  Sheet,
  User,
  History,
  Trash2,
  Unlock,
  KeyRound,
  Eye,
  Plus,
  Compass,
  ArrowRight,
  RefreshCw,
  LogOut,
  HelpCircle
} from 'lucide-react';
import PolynomialPanel from './components/PolynomialPanel';
import SymbolicAlgebra from './components/SymbolicAlgebra';
import MatrixCalculator from './components/MatrixCalculator';
import NumericalMethods from './components/NumericalMethods';
import StatisticsLab from './components/StatisticsLab';
import CalculusSuite from './components/CalculusSuite';
import AiMathGround from './components/AiMathGround';
import WorkspaceSpreadsheet from './components/WorkspaceSpreadsheet';
import GraphingEngine from './components/GraphingEngine';
import { GraphEquation, HistoryItem, User as UserType } from './types';

export default function App() {
  // Navigation State
  const [activeTab, setActiveTab] = useState<'polynomial' | 'algebra' | 'matrix' | 'numerical' | 'statistics' | 'calculus' | 'ai-explain' | 'sheets'>('polynomial');

  // Auth / Session States
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('mathlab_token'));
  const [user, setUser] = useState<UserType | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [emailInput, setEmailInput] = useState("");
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);

  // Grapher plots state
  const [graphEquations, setGraphEquations] = useState<GraphEquation[]>([
    { id: 'eq-1', type: 'y=f(x)', expression: 'sin(x) * x', color: '#06b6d4', visible: true }, // cyan
    { id: 'eq-2', type: 'y=f(x)', expression: '3 * cos(x) - 1', color: '#10b981', visible: true } // emerald
  ]);
  const [customPoints, setCustomPoints] = useState<{ x: number; y: number }[]>([]);

  // Calculations past history
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Sync session profile on launch
  useEffect(() => {
    if (token) {
      fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => {
          if (res.ok) return res.json();
          throw new Error("Expired session");
        })
        .then(data => setUser(data.user))
        .catch(() => {
          setToken(null);
          localStorage.removeItem('mathlab_token');
        });
    }
  }, [token]);

  // Sync history list
  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/history', {
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch {
      console.error("Failed to sync past operations history.");
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [token]);

  // Core actions
  const handleAddGraphEquation = (expr: string) => {
    const nextId = 'eq-' + Math.random().toString(36).substring(2, 7);
    const colors = ['#f43f5e', '#3b82f6', '#ec4899', '#8b5cf6', '#eab308']; // rose, blue, pink, violet, amber
    const pickColor = colors[graphEquations.length % colors.length];

    const newEq: GraphEquation = {
      id: nextId,
      type: 'y=f(x)',
      expression: expr,
      color: pickColor,
      visible: true
    };
    setGraphEquations(prev => [...prev.map(e => ({ ...e, visible: false })), newEq]); // focus on the new plotted one
  };

  const clearPoints = () => {
    setCustomPoints([]);
  };

  const toggleEquationVisibility = (id: string) => {
    setGraphEquations(prev => prev.map(eq => eq.id === id ? { ...eq, visible: !eq.visible } : eq));
  };

  const deleteEquation = (id: string) => {
    setGraphEquations(prev => prev.filter(eq => eq.id !== id));
  };

  // Auth actions
  const handleAuthSubmit = async () => {
    setAuthError(null);
    try {
      const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body = authMode === 'login' 
        ? { email: emailInput, password: passwordInput }
        : { email: emailInput, username: usernameInput, password: passwordInput };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Authentication procedure failed.");
      }

      setToken(data.token);
      setUser(data.user);
      localStorage.setItem('mathlab_token', data.token);
      setIsAuthModalOpen(false);
      
      // Clear inputs
      setEmailInput("");
      setUsernameInput("");
      setPasswordInput("");
    } catch (err) {
      setAuthError((err as Error).message);
    }
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('mathlab_token');
    setHistory([]);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col uppercase-none antialiased">
      {/* MASTER TOP HEADER */}
      <header className="bg-white border-b border-slate-200 p-4 px-6 flex items-center justify-between shadow-sm sticky top-0 z-30 backdrop-blur-md">
        <div className="flex items-center space-x-3.5">
          <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-md shadow-indigo-600/15">
            <Binary className="w-5 h-5 text-indigo-100" />
          </div>
          <div className="flex flex-col">
            <span className="text-md font-bold tracking-tight text-slate-800 font-sans flex items-center">
              MathLab Pro
              <span className="ml-2 px-1.5 py-0.5 bg-slate-100 border border-slate-200 text-slate-600 text-[10px] font-mono rounded select-none uppercase tracking-wider">v4.0.0</span>
            </span>
            <span className="text-[10px] text-slate-400 font-mono tracking-wider font-semibold uppercase">ANALYTICAL & SYMBOLIC CAS COMPUTER</span>
          </div>
        </div>

        {/* PROFILE STATS HUD */}
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsHistoryOpen(!isHistoryOpen)}
            className="p-1 px-3 bg-white hover:bg-slate-50 text-xs border border-slate-200 text-slate-600 rounded-lg shadow-xs transition flex items-center space-x-1.5 cursor-pointer font-medium"
            title="Past calculation history"
          >
            <History className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-mono">Logs ({history.length})</span>
          </button>

          {user ? (
            <div className="flex items-center space-x-3 bg-white border border-slate-200 p-1 pl-3 pr-2.5 rounded-lg text-xs shadow-xs">
              <span className="font-mono text-slate-600">@ {user.username}</span>
              <button
                onClick={handleLogout}
                className="hover:text-red-500 hover:bg-red-50 text-slate-400 transition p-1.5 rounded-md cursor-pointer"
                title="Sign out of student account"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setAuthMode('login'); setIsAuthModalOpen(true); }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold p-1.5 px-4 rounded-lg transition flex items-center space-x-1.5 cursor-pointer shadow-sm shadow-indigo-600/10"
            >
              <User className="w-3.5 h-3.5" />
              <span>Connect Profile</span>
            </button>
          )}
        </div>
      </header>

      {/* THREE-PANEL MASTER SPLIT CANVAS */}
      <main className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden relative">
        {/* SIDEBAR NAVIGATION UTILITY RAIL */}
        <nav className="bg-slate-900 w-full lg:w-64 border-r border-slate-800 flex flex-col p-4 space-y-2 shrink-0 select-none overflow-y-auto">
          <span className="text-[10px] text-slate-500 font-mono font-bold tracking-widest uppercase pb-1 px-2 block border-b border-slate-800/60">
            COMPUTATION SUITES
          </span>

          <button
            onClick={() => setActiveTab('polynomial')}
            className={`p-2.5 rounded-lg flex items-center space-x-3 text-xs font-semibold tracking-wide transition cursor-pointer ${activeTab === 'polynomial' ? 'bg-slate-800 text-white border border-slate-700' : 'text-slate-450 hover:text-white hover:bg-slate-800/50'}`}
          >
            <LineChart className="w-4 h-4 text-indigo-400" />
            <span>Polynomial Calculus</span>
          </button>

          <button
            onClick={() => setActiveTab('algebra')}
            className={`p-2.5 rounded-lg flex items-center space-x-3 text-xs font-semibold tracking-wide transition cursor-pointer ${activeTab === 'algebra' ? 'bg-slate-800 text-white border border-slate-700' : 'text-slate-450 hover:text-white hover:bg-slate-800/50'}`}
          >
            <Cpu className="w-4 h-4 text-indigo-400" />
            <span>Symbolic Algebra (CAS)</span>
          </button>

          <button
            onClick={() => setActiveTab('matrix')}
            className={`p-2.5 rounded-lg flex items-center space-x-3 text-xs font-semibold tracking-wide transition cursor-pointer ${activeTab === 'matrix' ? 'bg-slate-800 text-white border border-slate-700' : 'text-slate-450 hover:text-white hover:bg-slate-800/50'}`}
          >
            <Binary className="w-4 h-4 text-indigo-400" />
            <span>Matrix Algebra Lab</span>
          </button>

          <button
            onClick={() => setActiveTab('numerical')}
            className={`p-2.5 rounded-lg flex items-center space-x-3 text-xs font-semibold tracking-wide transition cursor-pointer ${activeTab === 'numerical' ? 'bg-slate-800 text-white border border-slate-700' : 'text-slate-450 hover:text-white hover:bg-slate-800/50'}`}
          >
            <Compass className="w-4 h-4 text-indigo-400" />
            <span>Numerical Analysis</span>
          </button>

          <button
            onClick={() => setActiveTab('calculus')}
            className={`p-2.5 rounded-lg flex items-center space-x-3 text-xs font-semibold tracking-wide transition cursor-pointer ${activeTab === 'calculus' ? 'bg-slate-800 text-white border border-slate-700' : 'text-slate-450 hover:text-white hover:bg-slate-800/50'}`}
          >
            <GitBranch className="w-4 h-4 text-indigo-400" />
            <span>Approximative Calculus</span>
          </button>

          <button
            onClick={() => setActiveTab('statistics')}
            className={`p-2.5 rounded-lg flex items-center space-x-3 text-xs font-semibold tracking-wide transition cursor-pointer ${activeTab === 'statistics' ? 'bg-slate-800 text-white border border-slate-700' : 'text-slate-450 hover:text-white hover:bg-slate-800/50'}`}
          >
            <Sigma className="w-4 h-4 text-indigo-400" />
            <span>Descriptive Statistics</span>
          </button>

          <button
            onClick={() => setActiveTab('sheets')}
            className={`p-2.5 rounded-lg flex items-center space-x-3 text-xs font-semibold tracking-wide transition cursor-pointer ${activeTab === 'sheets' ? 'bg-slate-800 text-white border border-slate-700' : 'text-slate-450 hover:text-white hover:bg-slate-800/50'}`}
          >
            <Sheet className="w-4 h-4 text-indigo-400" />
            <span>Workspaces Notebooks</span>
          </button>

          <div className="pt-4 flex flex-col space-y-2">
            <span className="text-[10px] text-slate-500 font-mono font-bold tracking-widest uppercase pb-1 px-2 block border-b border-slate-800/60">
              AI EXPERIMENTAL AGENTS
            </span>
            <button
              onClick={() => setActiveTab('ai-explain')}
              className={`p-2.5 rounded-lg flex items-center space-x-3 text-xs font-bold tracking-wide transition cursor-pointer ${activeTab === 'ai-explain' ? 'bg-slate-800 text-white border border-slate-700' : 'text-slate-455 hover:text-white hover:bg-slate-800/50'}`}
            >
              <Sparkles className="w-4 h-4 text-violet-400" />
              <span>CAS Tutoring Board</span>
            </button>
          </div>
        </nav>

        {/* WORKSPACE INTERNAL CONTROLLER GRID */}
        <section className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
          
          {/* CLIENT ACTIVE TAB PANEL */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6" id="workspace-controls-tab">
            {activeTab === 'polynomial' && (
              <PolynomialPanel
                onAddGraphEquation={handleAddGraphEquation}
                onAddHistory={(item) => setHistory(prev => [item, ...prev])}
                token={token}
              />
            )}
            {activeTab === 'algebra' && (
              <SymbolicAlgebra
                onAddGraphEquation={handleAddGraphEquation}
                onAddHistory={(item) => setHistory(prev => [item, ...prev])}
                token={token}
              />
            )}
            {activeTab === 'matrix' && (
              <MatrixCalculator
                onAddHistory={(item) => setHistory(prev => [item, ...prev])}
                token={token}
              />
            )}
            {activeTab === 'numerical' && (
              <NumericalMethods
                onAddGraphEquation={handleAddGraphEquation}
                onSetPoints={(pts) => setCustomPoints(pts)}
                onAddHistory={(item) => setHistory(prev => [item, ...prev])}
                token={token}
              />
            )}
            {activeTab === 'calculus' && (
              <CalculusSuite
                onAddGraphEquation={handleAddGraphEquation}
                onSetPoints={(pts) => setCustomPoints(pts)}
                onAddHistory={(item) => setHistory(prev => [item, ...prev])}
                token={token}
              />
            )}
            {activeTab === 'statistics' && (
              <StatisticsLab
                onAddHistory={(item) => setHistory(prev => [item, ...prev])}
                token={token}
              />
            )}
            {activeTab === 'sheets' && (
              <WorkspaceSpreadsheet token={token} />
            )}
            {activeTab === 'ai-explain' && (
              <AiMathGround onAddGraphEquation={handleAddGraphEquation} token={token} />
            )}
          </div>

          {/* ACTIVE HIGH-FIDELITY GRAPHIC VISUALIZER CANVAS PANEL (SPLIT-SCREEN WORKSPACE) */}
          <div className="w-full md:w-[440px] xl:w-[500px] shrink-0 border-t md:border-t-0 md:border-l border-slate-200 p-4 bg-white flex flex-col space-y-4">
            <span className="text-xs text-slate-700 font-bold uppercase tracking-wide flex items-center space-x-1.5 font-mono border-b border-slate-100 pb-2">
              <Compass className="w-4 h-4 text-indigo-650 animate-pulse" />
              <span>Interactive Graphing System HUD</span>
            </span>

            {/* HIGH-FIDELITY CANVAS COMPONENT */}
            <div className="h-64 sm:h-80 md:h-[300px] xl:h-[350px]">
              <GraphingEngine
                equations={graphEquations}
                points={customPoints}
              />
            </div>

            {/* CURVES INVENTORY MANAGEMENT PANEL */}
            <div className="flex-1 flex flex-col space-y-2.5 overflow-y-auto max-h-[160px] md:max-h-full">
              <div className="flex justify-between items-center px-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase font-mono">Plotted functions inventory ({graphEquations.length})</span>
                {customPoints.length > 0 && (
                  <button
                    onClick={clearPoints}
                    className="text-[10px] text-red-500 hover:underline cursor-pointer transition font-mono"
                  >
                    Clear Path Coordinates
                  </button>
                )}
              </div>

              {graphEquations.length === 0 ? (
                <div className="p-4 bg-slate-50 border border-slate-200 border-dashed rounded-lg text-center text-xs text-slate-400">
                  No active coordinate lines loaded. Add a polynomial equation above!
                </div>
              ) : (
                <div className="flex flex-col space-y-1.5">
                  {graphEquations.map(eq => (
                    <div key={eq.id} className="bg-slate-50 p-2.5 border border-slate-200 rounded-lg flex items-center justify-between text-xs font-mono">
                      <div className="flex items-center space-x-2">
                        <span style={{ backgroundColor: eq.color }} className="w-2.5 h-2.5 rounded-full inline-block shrink-0" />
                        <span className="text-slate-700">y = {eq.expression}</span>
                      </div>
                      <div className="flex items-center space-x-2.5 text-[10px]">
                        <button
                          onClick={() => toggleEquationVisibility(eq.id)}
                          className={`hover:underline cursor-pointer ${eq.visible ? 'text-indigo-650' : 'text-slate-450'}`}
                        >
                          {eq.visible ? 'Hide' : 'Show'}
                        </button>
                        <span className="text-slate-300">|</span>
                        <button onClick={() => deleteEquation(eq.id)} className="text-red-500 hover:text-red-650 cursor-pointer">
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* PAST LOGS DRAWER SIDEBAR INDEX */}
      {isHistoryOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 backdrop-blur-xs flex justify-end animate-fadeIn">
          <div className="w-96 bg-zinc-900 border-l border-zinc-800 h-full p-5 flex flex-col space-y-4 shadow-2xl animate-slideLeft">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider font-mono flex items-center space-x-1.5">
                <History className="w-4 h-4 text-indigo-500" />
                <span>Past Calculations Logs</span>
              </span>
              <button
                onClick={() => setIsHistoryOpen(false)}
                className="text-xs text-zinc-500 hover:text-zinc-300 font-mono"
              >
                Close
              </button>
            </div>

            <div className="flex-1 overflow-y-auto flex flex-col space-y-2.5">
              {history.length === 0 ? (
                <div className="p-10 text-center text-zinc-500 text-xs">
                  No registered calculations in active session. All evaluations are persists in local files safely.
                </div>
              ) : (
                history.map(item => (
                  <div key={item.id} className="bg-zinc-950 p-3 border border-zinc-850 rounded-lg flex flex-col space-y-2 text-xs font-mono select-text relative group">
                    <span className="text-[9px] uppercase font-bold text-zinc-650 bg-zinc-900 p-0.5 px-2.5 rounded absolute top-2 right-2">
                      {item.type}
                    </span>
                    <label className="text-zinc-400 text-[10px] leading-relaxed break-all">In: {item.input}</label>
                    <div className="bg-zinc-900 p-2 rounded text-indigo-400 font-semibold border border-zinc-855 text-xs truncate">
                      Out: {item.output}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* AUTH SEAMLESS LOGIN REGISTRATION DIALOG MODAL */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 bg-black/70 z-50 backdrop-blur-sm flex items-center justify-center animate-fadeIn">
          <div className="w-80 bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col space-y-4 shadow-2xl relative">
            <button
              onClick={() => setIsAuthModalOpen(false)}
              className="absolute top-3 right-3 text-zinc-500 hover:text-zinc-300 font-mono text-xs"
            >
              Close
            </button>

            <div className="text-center">
              <span className="text-xs font-bold font-mono text-indigo-400 uppercase tracking-widest block mb-1">
                {authMode === 'login' ? 'Connect account' : 'Register Account'}
              </span>
              <span className="text-[10px] text-zinc-500">Sync projects workspaces, sheets parameters, and calculation history.</span>
            </div>

            <div className="flex flex-col space-y-3">
              {authMode === 'register' && (
                <div className="flex flex-col space-y-1">
                  <span className="text-[10px] font-bold font-mono text-zinc-500 uppercase">Username</span>
                  <input
                    type="text"
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    className="bg-zinc-950 border border-zinc-850 p-2 text-xs rounded text-zinc-200 focus:outline-none focus:border-indigo-500"
                    placeholder="student1"
                  />
                </div>
              )}
              <div className="flex flex-col space-y-1">
                <span className="text-[10px] font-bold font-mono text-zinc-500 uppercase">Email Address</span>
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="bg-zinc-950 border border-zinc-855 p-2 text-xs rounded text-zinc-200 focus:outline-none focus:border-indigo-500"
                  placeholder="student1@mathlab.edu"
                />
              </div>
              <div className="flex flex-col space-y-1">
                <span className="text-[10px] font-bold font-mono text-zinc-500 uppercase">Password</span>
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="bg-zinc-950 border border-zinc-855 p-2 text-xs rounded text-zinc-200 focus:outline-none focus:border-indigo-500"
                  placeholder="Secure string"
                />
              </div>
            </div>

            {authError && (
              <span className="text-[10px] text-red-400 font-mono break-words select-text">
                [Failure] {authError}
              </span>
            )}

            <button
              onClick={handleAuthSubmit}
              className="bg-indigo-600 hover:bg-indigo-500 text-zinc-100 p-2 text-xs font-semibold uppercase tracking-wider rounded-lg shadow-md transition"
            >
              {authMode === 'login' ? 'Sign In' : 'Sign Up'}
            </button>

            <div className="text-center font-mono text-[10px] text-zinc-500">
              {authMode === 'login' ? (
                <span>New here? <button onClick={() => setAuthMode('register')} className="text-indigo-400 underline hover:text-indigo-300">Create profile</button></span>
              ) : (
                <span>Have an account? <button onClick={() => setAuthMode('login')} className="text-indigo-400 underline hover:text-indigo-300">Sign in</button></span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
