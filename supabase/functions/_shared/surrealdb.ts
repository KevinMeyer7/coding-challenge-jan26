/**
 * SurrealDB Client for Edge Functions
 *
 * Uses the HTTP API directly (no SDK needed in Deno edge functions).
 * SurrealDB runs locally on the host machine.
 */

const SURREAL_URL = Deno.env.get("SURREAL_URL") || "http://localhost:8001";
const SURREAL_NS = Deno.env.get("SURREAL_NS") || "matchmaking";
const SURREAL_DB = Deno.env.get("SURREAL_DB") || "fruits";
const SURREAL_USER = Deno.env.get("SURREAL_USER") || "root";
const SURREAL_PASS = Deno.env.get("SURREAL_PASS") || "root";

interface SurrealResponse<T = unknown> {
  result: T;
  status: string;
  time: string;
}

/**
 * Safely serialize a value for inline SurrealQL embedding.
 * Uses JSON.stringify for the actual serialization, which produces
 * valid SurrealQL literals for strings, numbers, booleans, arrays, and objects.
 *
 * NOTE: This is safe because SurrealQL string literals use the same escaping
 * as JSON strings. JSON.stringify will escape all special characters including
 * quotes, backslashes, and control characters, preventing breakout.
 */
function toSurrealValue(value: unknown): string {
  if (value === null || value === undefined) return "NONE";
  return JSON.stringify(value);
}

/**
 * Execute a SurrealQL query against the database.
 *
 * For parameterized queries, variable placeholders ($name) are replaced
 * with safely serialized values in a single pass to prevent double-replacement.
 */
export async function query<T = unknown>(
  sql: string,
  vars?: Record<string, unknown>
): Promise<T[]> {
  // Prepend USE statement for SurrealDB 3.x compatibility
  const usePrefix = `USE NS ${SURREAL_NS} DB ${SURREAL_DB};\n`;

  let resolvedSql = sql;
  if (vars) {
    // Single-pass replacement to prevent double-substitution attacks:
    // sort keys longest-first so $attributeDescription is replaced before $attribute
    const sortedKeys = Object.keys(vars).sort((a, b) => b.length - a.length);
    const pattern = new RegExp(
      sortedKeys.map((k) => `\\$${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).join("|"),
      "g"
    );
    resolvedSql = sql.replace(pattern, (match) => {
      const key = match.slice(1); // remove leading $
      return toSurrealValue(vars[key]);
    });
  }

  const body = usePrefix + resolvedSql;

  const response = await fetch(`${SURREAL_URL}/sql`, {
    method: "POST",
    headers: {
      "Content-Type": "application/surql",
      Accept: "application/json",
      Authorization: `Basic ${btoa(`${SURREAL_USER}:${SURREAL_PASS}`)}`,
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`SurrealDB error (${response.status}): ${text}`);
  }

  const data: SurrealResponse<T[]>[] = await response.json();

  // Skip the first result (USE statement) and get the last query result
  const queryResults = data.slice(1);
  if (queryResults.length === 0) return [];

  const last = queryResults[queryResults.length - 1];
  if (last.status === "ERR") {
    throw new Error(`SurrealDB query error: ${JSON.stringify(last)}`);
  }

  return (last.result as T[]) ?? [];
}

/**
 * Store a fruit record in SurrealDB
 */
export async function storeFruit(fruit: {
  type: string;
  attributes: Record<string, unknown>;
  preferences: Record<string, unknown>;
  attributeDescription: string;
  preferenceDescription: string;
}): Promise<{ id: string }> {
  const table = fruit.type === "apple" ? "apple" : "orange";
  const results = await query<{ id: string }>(
    `CREATE ${table} CONTENT {
      attributes: $attributes,
      preferences: $preferences,
      attributeDescription: $attributeDescription,
      preferenceDescription: $preferenceDescription,
      createdAt: time::now()
    }`,
    {
      attributes: fruit.attributes,
      preferences: fruit.preferences,
      attributeDescription: fruit.attributeDescription,
      preferenceDescription: fruit.preferenceDescription,
    }
  );
  if (!results[0]) {
    throw new Error(`Failed to create ${table} record: empty result from SurrealDB`);
  }
  return results[0];
}

/**
 * Get all fruits of a given type from SurrealDB
 */
export async function getFruits(type: "apple" | "orange"): Promise<Array<{
  id: string;
  attributes: Record<string, unknown>;
  preferences: Record<string, unknown>;
  attributeDescription?: string;
  preferenceDescription?: string;
  createdAt?: string;
}>> {
  const table = type === "apple" ? "apple" : "orange";
  return await query(`SELECT * FROM ${table}`);
}

/**
 * Store a match result in SurrealDB
 */
export async function storeMatch(match: {
  appleId: string;
  orangeId: string;
  appleToOrangeScore: number;
  orangeToAppleScore: number;
  mutualScore: number;
  explanation: string;
}): Promise<{ id: string }> {
  const results = await query<{ id: string }>(
    `CREATE match CONTENT {
      appleId: $appleId,
      orangeId: $orangeId,
      appleToOrangeScore: $appleToOrangeScore,
      orangeToAppleScore: $orangeToAppleScore,
      mutualScore: $mutualScore,
      explanation: $explanation,
      createdAt: time::now()
    }`,
    match
  );
  if (!results[0]) {
    throw new Error("Failed to create match record: empty result from SurrealDB");
  }
  return results[0];
}

/**
 * Get recent matches from SurrealDB (limited for dashboard performance)
 */
export async function getMatches(limit = 50): Promise<Array<{
  id: string;
  appleId: string;
  orangeId: string;
  appleToOrangeScore: number;
  orangeToAppleScore: number;
  mutualScore: number;
  explanation: string;
  createdAt: string;
}>> {
  return await query(`SELECT * FROM match ORDER BY createdAt DESC LIMIT ${Math.min(limit, 500)}`);
}

/**
 * Get aggregate stats from SurrealDB
 */
export async function getStats(): Promise<{
  totalApples: number;
  totalOranges: number;
  totalMatches: number;
  avgMutualScore: number;
}> {
  const [appleCount] = await query<{ count: number }>(
    `SELECT count() AS count FROM apple GROUP ALL`
  );
  const [orangeCount] = await query<{ count: number }>(
    `SELECT count() AS count FROM orange GROUP ALL`
  );
  const [matchCount] = await query<{ count: number }>(
    `SELECT count() AS count FROM match GROUP ALL`
  );
  const [avgScore] = await query<{ avg: number }>(
    `SELECT math::mean(mutualScore) AS avg FROM match GROUP ALL`
  );

  return {
    totalApples: appleCount?.count ?? 0,
    totalOranges: orangeCount?.count ?? 0,
    totalMatches: matchCount?.count ?? 0,
    avgMutualScore: avgScore?.avg ?? 0,
  };
}
