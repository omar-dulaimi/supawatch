import type {
  Snapshot,
  SnapshotFile,
  Target,
  TargetCapabilities,
  TargetOptions,
} from "@supawatch/core";

// Emits schema.lock.json: a canonical, committed snapshot of the schema.
// With the lockfile in the repo, `supawatch check` catches drift the same
// way it catches stale generated files, and the lockfile's diff in a pull
// request IS the schema changelog reviewers read.

export type SchemaLockTargetOptions = TargetOptions;

const FORMAT = 1;

// Canonicalize: sort every object's keys and every named collection, so
// the file is byte-stable for an unchanged schema regardless of catalog
// ordering.
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = canonical((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

function sortByName<T extends { schema?: string; name: string }>(xs: T[]): T[] {
  return [...xs].sort((a, b) =>
    `${a.schema ?? ""}.${a.name}`.localeCompare(`${b.schema ?? ""}.${b.name}`),
  );
}

export class SchemaLockTarget implements Target<SchemaLockTargetOptions> {
  readonly name = "schema-lock";
  readonly fileExtension = ".json";
  readonly barrel = false;
  readonly capabilities: TargetCapabilities = {
    strictObjects: false,
    brandedTypes: false,
    dateInstances: false,
  };

  renderTable(): never {
    throw new Error("schema-lock is a snapshot-level target");
  }

  renderSnapshot(snapshot: Snapshot, _opts: SchemaLockTargetOptions): SnapshotFile[] {
    const body = canonical({
      format: FORMAT,
      tables: sortByName(snapshot.tables),
      enums: sortByName(snapshot.enums),
      domains: sortByName(snapshot.domains),
      composites: sortByName(snapshot.composites),
    });
    return [
      { file: "schema.lock.json", content: JSON.stringify(body, null, 2) + "\n" },
    ];
  }
}

export default SchemaLockTarget;
