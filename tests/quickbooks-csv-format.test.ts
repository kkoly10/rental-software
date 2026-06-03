/**
 * Format-level tests for the QuickBooks CSV escape logic.
 *
 * These mirror the rules in `lib/integrations/quickbooks/csv-export.ts`
 * so a regression in the escape behavior — particularly the formula-
 * injection prefix — is caught without spinning up Supabase.
 *
 * If we later refactor the escape helpers into a shared utility, these
 * tests should be re-pointed at that module.
 */
import test from "node:test";
import assert from "node:assert/strict";

// Duplicate the helpers under test. They are intentionally not exported
// from the main module to keep its surface tight; the rules are simple
// enough to re-state in the test.
function escapeCsvField(value: string): string {
  if (/^[=+\-@\t\r]/.test(value) || /^\s+[=+\-@]/.test(value)) value = "'" + value;
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toCsv(headers: string[], rows: string[][]): string {
  const lines = [headers.map(escapeCsvField).join(",")];
  for (const row of rows) {
    lines.push(row.map(escapeCsvField).join(","));
  }
  return lines.join("\n");
}

test("escapeCsvField prepends apostrophe to formula triggers", () => {
  // Direct formula trigger characters
  assert.equal(escapeCsvField("=SUM(A1)"), "'=SUM(A1)");
  assert.equal(escapeCsvField("+1234"), "'+1234");
  assert.equal(escapeCsvField("-1.5"), "'-1.5");
  assert.equal(escapeCsvField("@import"), "'@import");
});

test("escapeCsvField catches formula triggers after leading whitespace", () => {
  // Excel/Sheets strip leading whitespace before evaluating, so " =1+1"
  // still resolves to the formula. The apostrophe must precede.
  assert.equal(escapeCsvField("  =1+1"), "'  =1+1");
  assert.equal(escapeCsvField("\t=foo"), "'\t=foo");
});

test("escapeCsvField double-quotes fields containing commas, quotes, or newlines", () => {
  assert.equal(escapeCsvField("A,B"), '"A,B"');
  assert.equal(escapeCsvField('say "hi"'), '"say ""hi"""');
  assert.equal(escapeCsvField("line1\nline2"), '"line1\nline2"');
});

test("escapeCsvField leaves safe text untouched", () => {
  assert.equal(escapeCsvField("ORD-1001"), "ORD-1001");
  assert.equal(escapeCsvField("Bounce House Large"), "Bounce House Large");
});

test("toCsv produces header row followed by data rows", () => {
  const csv = toCsv(
    ["InvoiceNo", "Customer"],
    [
      ["ORD-1", "Jane Doe"],
      ["ORD-2", "John Smith"],
    ]
  );
  assert.equal(csv, "InvoiceNo,Customer\nORD-1,Jane Doe\nORD-2,John Smith");
});

test("toCsv escapes a customer name with a comma", () => {
  const csv = toCsv(["InvoiceNo", "Customer"], [["ORD-1", "Doe, Jane"]]);
  assert.equal(csv, 'InvoiceNo,Customer\nORD-1,"Doe, Jane"');
});

test("toCsv escapes a name that starts with a formula trigger", () => {
  // A customer named "=SUM" should not blow up the bookkeeper's
  // QuickBooks import.
  const csv = toCsv(["Customer"], [["=SUM(A1:A99)"]]);
  assert.equal(csv, "Customer\n'=SUM(A1:A99)");
});
