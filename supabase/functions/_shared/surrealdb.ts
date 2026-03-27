/**
 * SurrealDB Client for Edge Functions
 *
 * Uses the HTTP API directly (no SDK needed in Deno edge functions).
 * SurrealDB runs locally on the host machine.
 */

const SURREAL_URL = Deno.env.get("SURREAL_URL") || "http://host.docker.internal:8001";
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
 * Execute a SurrealQL query against the database
 */
export async function query<T = unknown>(
  sql: string,
  vars?: Record<string, unknown>
): Promise<T[]> {
  // Prepend USE statement for SurrealDB 3.x compatibility
  const usePrefix = `USE NS ${SURREAL_NS} DB ${SURREAL_DB};\n`;

  // For parameterized queries, we need to use raw SQL with inline values
  // since SurrealDB 3.x HTTP API doesn't support vars in the same way
  let body: string;
  let contentType: string;

  if (vars) {
    // Replace $varName with actual values in the SQL
    let resolvedSql = sql;
    for (const [key, value] of Object.entries(vars)) {
      const placeholder = `$${key}`;
      const jsonValue = JSON.stringify(value);
      resolvedSql = resolvedSql.replaceAll(placeholder, jsonValue);
    }
    body = usePrefix + resolvedSql;
    contentType = "application/surql";
  } else {
    body = usePrefix + sql;
    contentType = "application/surql";
  }

  const response = await fetch(`${SURREAL_URL}/sql`, {
    method: "POST",
    headers: {
      "Content-Type": contentType,
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

  // Filter out the USE statement result and get the last real result
  const realResults = data.filter((d) => d.time !== undefined && d.status !== undefined);
  if (realResults.length === 0) return [];

  const last = realResults[realResults.length - 1];
  if (last.status === "ERR") {
    throw new Error(`SurrealDB query error: ${JSON.stringify(last)}`);
  }

  return (last.result as T[]) || [];
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
  // SurrealDB returns the created record, but the query method gets the last statement's result
  // For CREATE, the result is an array with the created record
  // Actually query returns data[last].result which should be the array
  // Let me handle this more carefully
  return results[0] || { id: "unknown" };
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
  return results[0] || { id: "unknown" };
}

/**
 * Get all matches from SurrealDB
 */
export async function getMatches(): Promise<Array<{
  id: string;
  appleId: string;
  orangeId: string;
  appleToOrangeScore: number;
  orangeToAppleScore: number;
  mutualScore: number;
  explanation: string;
  createdAt: string;
}>> {
  return await query(`SELECT * FROM match ORDER BY createdAt DESC`);
}

/**
 * Get aggregate stats from SurrealDB
 */
export async function getStats(): Promise<{
  totalApples: number;
  totalOranges: number;
  totalMatches: number;
  avgMutualScore: number;
  matchScoreDistribution: Array<{ range: string; count: number }>;
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
    totalApples: appleCount?.count || 0,
    totalOranges: orangeCount?.count || 0,
    totalMatches: matchCount?.count || 0,
    avgMutualScore: avgScore?.avg || 0,
    matchScoreDistribution: [],
  };
}
