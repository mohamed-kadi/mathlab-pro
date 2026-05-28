import { create, all } from 'mathjs';

const math = create(all);
const CELL_PATTERN = /^[A-D][1-5]$/;

export function evaluateCellValue(cells: Record<string, string>, currentCell: string, visited = new Set<string>()): string {
  const rawValue = cells[currentCell] || '';
  if (!rawValue.startsWith('=')) return rawValue;
  if (visited.has(currentCell)) return "#CYCLE!";

  try {
    visited.add(currentCell);
    const formula = rawValue.substring(1);
    const tokens = formula.match(/[A-Z]\d+|\d+(?:\.\d+)?|[+\-*/^%()]|\s+/g) || [];
    if (tokens.join('') !== formula) return "#VALUE!";

    const variablesScope: Record<string, number> = {};
    const referencedCells = Array.from(new Set(tokens.filter(token => /^[A-Z]\d+$/.test(token))));
    for (const cellId of referencedCells) {
      if (!CELL_PATTERN.test(cellId)) return "#REF!";
      const dep = evaluateCellValue(cells, cellId, new Set(visited));
      const numericValue = Number(dep);
      if (!Number.isFinite(numericValue)) return "#REF!";
      variablesScope[cellId] = numericValue;
    }

    const result = math.evaluate(formula, variablesScope);
    return typeof result === 'number' && Number.isFinite(result) ? result.toFixed(3) : "Err eval";
  } catch {
    return "#REF!";
  }
}
