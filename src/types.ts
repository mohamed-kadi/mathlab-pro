export interface User {
  id: string;
  email: string;
  username: string;
}

export interface MathExpression {
  id: string;
  rawExpression: string;
  simplifiedExpression?: string;
  latexExpression?: string;
  derivative?: string;
  integral?: string;
  description?: string;
  createdAt: string;
}

export interface HistoryItem {
  id: string;
  type: 'polynomial' | 'algebra' | 'matrix' | 'numerical' | 'statistics' | 'calculus' | 'ai-explain';
  input: string;
  latexInput?: string;
  output: string;
  latexOutput?: string;
  steps?: string[];
  explanation?: string;
  graphConfig?: string; // JSON string
  createdAt: string;
}

export interface Project {
  id: string;
  userId?: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  sheets: SpreadsheetData[];
  history?: HistoryItem[];
}

export interface SpreadsheetData {
  id: string;
  name: string;
  cells: Record<string, string>; // e.g. {"A1": "1.23", "B1": "A1 * 5"}
}

export interface GraphConfig {
  equations: GraphEquation[];
  viewport: {
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
  };
  gridVisible: boolean;
  theme: 'dark' | 'light' | 'blueprint' | 'monochrome';
}

export interface GraphEquation {
  id: string;
  type: 'y=f(x)' | 'parametric' | 'points' | 'polar';
  expression: string; // e.g. "sin(x) * x"
  paraX?: string; // for parametric
  paraY?: string; // for parametric
  color: string;
  visible: boolean;
}

export interface MatrixData {
  rows: number;
  cols: number;
  data: number[][];
}

export interface MatrixOperationResult {
  determinant?: number;
  inverse?: number[][];
  eigenvalues?: number[];
  eigenvectors?: number[][];
  lu?: { l: number[][]; u: number[][] };
  qr?: { q: number[][]; r: number[][] };
  solution?: number[];
  steps?: string[];
  latexResult?: string;
}

export interface SavedExpression {
  id: string;
  userId: string;
  name: string;
  rawExpression: string;
  latexExpression: string;
  createdAt: string;
}

export interface GraphConfigurationRecord {
  id: string;
  userId: string;
  projectId?: string;
  name: string;
  config: {
    equations?: GraphEquation[];
    viewport?: Record<string, unknown>;
    [key: string]: unknown;
  };
  createdAt: string;
  updatedAt: string;
}

export interface SharedWorkspace {
  id: string;
  projectId: string;
  ownerUserId: string;
  sharedWithUserId: string;
  role: 'viewer' | 'editor';
  createdAt: string;
  projectName?: string;
  ownerEmail?: string;
  ownerUsername?: string;
  sharedWithEmail?: string;
  sharedWithUsername?: string;
}

export interface AuditLog {
  id: string;
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  metadata: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

export interface CacheStatus {
  provider: 'memory' | 'redis';
  enabled: boolean;
  ttlSeconds: number;
  redisUrl?: string;
}
