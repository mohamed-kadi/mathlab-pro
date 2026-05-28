import fs from 'fs';
import path from 'path';

function getDbFile() {
  return process.env.MATHLAB_DB_FILE
    ? path.resolve(process.env.MATHLAB_DB_FILE)
    : path.join(process.cwd(), 'data', 'db.json');
}

export interface DatabaseSchema {
  users: UserRecord[];
  savedExpressions: SavedExpressionRecord[];
  calculationHistory: CalculationHistoryRecord[];
  projects: ProjectRecord[];
  graphConfigurations: any[];
  sharedWorkspaces: any[];
}

export interface UserRecord {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}

export interface SavedExpressionRecord {
  id: string;
  userId: string;
  name: string;
  rawExpression: string;
  latexExpression: string;
  createdAt: string;
}

export interface CalculationHistoryRecord {
  id: string;
  userId?: string;
  type: string;
  input: string;
  output: string;
  latexInput?: string;
  latexOutput?: string;
  steps?: string[];
  explanation?: string;
  createdAt: string;
}

export interface ProjectRecord {
  id: string;
  userId: string;
  name: string;
  description: string;
  sheets: Array<{
    id: string;
    name: string;
    cells: Record<string, string>;
  }>;
  createdAt: string;
  updatedAt: string;
}

const defaultDatabase: DatabaseSchema = {
  users: [
    {
      id: "admin",
      username: "Guest Professor",
      email: "guest@mathlab.edu",
      passwordHash: "$2b$12$ldBaTl5N1pY9/J2mwwJRs.kzms5oID4uYGph.x1p.t/M3IOyvhboe",
      createdAt: new Date().toISOString()
    }
  ],
  savedExpressions: [
    {
      id: "exp-1",
      userId: "admin",
      name: "Gaussian Density",
      rawExpression: "1 / (sigma * sqrt(2 * pi)) * exp(-1/2 * ((x - mu)/sigma)^2)",
      latexExpression: "\\frac{1}{\\sigma \\sqrt{2\\pi}} e^{-\\frac{1}{2}\\left(\\frac{x-\\mu}{\\sigma}\\right)^2}",
      createdAt: new Date().toISOString()
    }
  ],
  calculationHistory: [
    {
      id: "hist-1",
      userId: "admin",
      type: "calculus",
      input: "derivative of sin(x)*x",
      output: "x * cos(x) + sin(x)",
      latexInput: "\\frac{d}{dx}[\\sin(x) \\cdot x]",
      latexOutput: "x \\cos(x) + \\sin(x)",
      createdAt: new Date().toISOString()
    }
  ],
  projects: [
    {
      id: "proj-1",
      userId: "admin",
      name: "Quantum Mechanics Harmonic Oscillator",
      description: "Analytic and numeric calculations for the quantum harmonic oscillator potential and Hermite polynomials.",
      sheets: [
        {
          id: "sheet-1",
          name: "Standard Parameters",
          cells: {
            "A1": "hbar", "B1": "1.054e-34",
            "A2": "mass", "B2": "9.109e-31",
            "A3": "omega", "B3": "1e15",
            "A4": "E_0", "B4": "0.5 * hbar * omega"
          }
        }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ],
  graphConfigurations: [],
  sharedWorkspaces: []
};

function ensureDirExists() {
  const dbDir = path.dirname(getDbFile());
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
}

export function readDb(): DatabaseSchema {
  ensureDirExists();
  const dbFile = getDbFile();
  if (!fs.existsSync(dbFile)) {
    fs.writeFileSync(dbFile, JSON.stringify(defaultDatabase, null, 2), 'utf-8');
    return JSON.parse(JSON.stringify(defaultDatabase));
  }
  try {
    const data = fs.readFileSync(dbFile, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error("Failed to read database file, reverting to default:", error);
    return JSON.parse(JSON.stringify(defaultDatabase));
  }
}

export function writeDb(db: DatabaseSchema) {
  ensureDirExists();
  try {
    fs.writeFileSync(getDbFile(), JSON.stringify(db, null, 2), 'utf-8');
  } catch (error) {
    console.error("Failed to write to database file:", error);
  }
}
