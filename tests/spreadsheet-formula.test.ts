import assert from "node:assert/strict";
import { evaluateCellValue } from "../src/lib/spreadsheetFormula.ts";

assert.equal(evaluateCellValue({ A1: "2", B1: "3", C1: "=A1+B1*2" }, "C1"), "8.000");
assert.equal(evaluateCellValue({ A1: "=process.exit()" }, "A1"), "#VALUE!");
assert.equal(evaluateCellValue({ A1: "=Z9+1" }, "A1"), "#REF!");

console.log("spreadsheet formula unit tests passed");
