import type {
  Snapshot,
  SnapshotFile,
  Table,
  Target,
  TargetCapabilities,
  TargetOptions,
} from "@supawatch/core";
import { exportBaseName, isMultiSchema } from "@supawatch/core";

// Emits schema.erd.md: a Mermaid erDiagram inside a fenced block, which
// GitHub renders natively. Regenerated on every schema change, so the
// diagram is correct forever instead of correct once.
//
// Mermaid's grammar only accepts word-safe tokens for entity and
// attribute names, and database identifiers are free-form ("Order Log",
// "users; drop table users--", unicode). Entities therefore use a safe
// identifier with the real name as a quoted display alias, and
// attributes sanitize their tokens, keeping the real column name in the
// attribute comment. Verified by actually parsing the output with
// mermaid in the repo's suite.

export interface ErdTargetOptions extends TargetOptions {
  // "all" every column, "keys" only primary and foreign keys, "none"
  // relationships only. Default: the largest that fits maxTextSize.
  attributes?: "all" | "keys" | "none";
  // Mermaid refuses to RENDER a diagram longer than this and shows
  // "Maximum text size in diagram exceeded" instead; its own default is
  // 50000 characters (MAX_TEXTLENGTH in mermaid's source). Raise it here
  // only if your renderer is configured with a matching maxTextSize.
  maxTextSize?: number;
}

// Mermaid's own default. Verified against mermaid 11: the check lives in
// the render path, so a diagram over the limit PARSES fine and then
// renders as an error box, which is why size is asserted separately.
const MERMAID_DEFAULT_MAX_TEXT_SIZE = 50000;

// Mermaid tokens must not start with a digit or a hyphen.
const WORD_SAFE = /^[A-Za-z_][A-Za-z0-9_-]*$/;

function safeToken(s: string): string {
  const t = s.replace(/[^A-Za-z0-9_-]/g, "_");
  const led = /^[0-9]/.test(t) ? `_${t}` : t;
  return led === "" ? "_" : led;
}

// Mermaid quoted strings cannot carry a double quote.
function quotable(s: string): string {
  return s.replace(/"/g, "'").replace(/[\n\r\t]/g, " ");
}

function attrLines(table: Table, mode: "all" | "keys"): string[] {
  const used = new Map<string, number>();
  const columns =
    mode === "all"
      ? table.columns
      : table.columns.filter(
          (c) =>
            table.primaryKey.includes(c.name) ||
            table.foreignKeys.some((fk) => fk.columns.includes(c.name)),
        );
  return columns.map((col) => {
    const markers: string[] = [];
    if (table.primaryKey.includes(col.name)) markers.push("PK");
    if (table.foreignKeys.some((fk) => fk.columns.includes(col.name))) {
      markers.push("FK");
    }
    const marker = markers.length > 0 ? ` ${markers.join(",")}` : "";
    const type = safeToken(col.pgTypeName);
    let name = WORD_SAFE.test(col.name) ? col.name : safeToken(col.name);
    // sanitized names can collide inside one entity ("a b" and "a-b")
    const n = used.get(name) ?? 0;
    used.set(name, n + 1);
    if (n > 0) name = `${name}_${n + 1}`;
    const comment =
      name === col.name ? "" : ` "column: ${quotable(col.name)}"`;
    return `    ${type} ${name}${marker}${comment}`;
  });
}

export class ErdTarget implements Target<ErdTargetOptions> {
  readonly name = "erd";
  readonly fileExtension = ".md";
  readonly barrel = false;
  readonly capabilities: TargetCapabilities = {
    strictObjects: false,
    brandedTypes: false,
    dateInstances: false,
  };

  renderTable(): never {
    throw new Error("erd is a snapshot-level target");
  }

  renderSnapshot(snapshot: Snapshot, opts: ErdTargetOptions): SnapshotFile[] {
    const multi = isMultiSchema(snapshot);
    const identFor = (t: Table): string => exportBaseName(t, snapshot);
    const displayFor = (t: Table): string =>
      multi ? `${t.schema}.${t.name}` : t.name;
    const budget = opts.maxTextSize ?? MERMAID_DEFAULT_MAX_TEXT_SIZE;

    const relationshipLines: string[] = [];
    for (const table of snapshot.tables) {
      // A nullable FK column means the relationship itself is optional.
      for (const fk of table.foreignKeys) {
        const optional = fk.columns.every((c) => {
          const col = table.columns.find((x) => x.name === c);
          return col?.nullable === true;
        });
        const cardinality = optional ? "}o--o|" : "}o--||";
        // Resolve the parent by schema AND name: two schemas can hold
        // same-named tables, and a bare name would wire the wrong one.
        const parent = snapshot.tables.find(
          (x) => x.schema === fk.referencedSchema && x.name === fk.referencedTable,
        );
        const parentIdent = parent ? identFor(parent) : safeToken(fk.referencedTable);
        relationshipLines.push(
          `  ${identFor(table)} ${cardinality} ${parentIdent} : "${quotable(fk.name)}"`,
        );
      }
    }

    const bodyFor = (mode: "all" | "keys" | "none"): string => {
      const lines = ["erDiagram", ...relationshipLines];
      for (const table of snapshot.tables) {
        const ident = identFor(table);
        const display = displayFor(table);
        const label = ident === display ? ident : `${ident}["${quotable(display)}"]`;
        if (mode === "none") {
          // An entity with no attribute block still needs a declaration
          // so its display name and isolated entities survive.
          lines.push(`  ${label} {`, "  }");
          continue;
        }
        lines.push(`  ${label} {`, ...attrLines(table, mode), "  }");
      }
      return lines.join("\n");
    };

    // Mermaid renders an error box instead of the diagram once the source
    // passes maxTextSize, so pick the richest form that actually renders
    // rather than emitting something that cannot be displayed.
    const requested = opts.attributes;
    const order: ("all" | "keys" | "none")[] = requested
      ? [requested]
      : ["all", "keys", "none"];
    let mode = order[order.length - 1];
    let body = bodyFor(mode);
    for (const candidate of order) {
      const text = bodyFor(candidate);
      if (text.length <= budget || candidate === order[order.length - 1]) {
        mode = candidate;
        body = text;
        break;
      }
    }

    const notes: string[] = [];
    if (!requested && mode !== "all") {
      notes.push(
        `> [!NOTE]`,
        `> The full diagram exceeds Mermaid's ${budget} character render limit,`,
        `> so this one shows ${mode === "keys" ? "key columns only" : "relationships only"}.`,
        `> For every column, raise the renderer's \`maxTextSize\` and set`,
        `> \`{ kind: "erd", attributes: "all", maxTextSize: <larger> }\`.`,
        "",
      );
    }
    if (body.length > budget) {
      notes.push(
        `> [!WARNING]`,
        `> This diagram is ${body.length} characters, past the ${budget} character`,
        `> limit, so Mermaid will show "Maximum text size in diagram exceeded"`,
        `> until the renderer is configured with a larger \`maxTextSize\`.`,
        "",
      );
    }

    const content = [
      "<!-- Generated by supawatch. Do not edit. -->",
      ...notes,
      "```mermaid",
      body,
      "```",
      "",
    ].join("\n");
    return [{ file: "schema.erd.md", content }];
  }
}

export default ErdTarget;
