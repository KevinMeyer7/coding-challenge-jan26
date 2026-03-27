#!/usr/bin/env -S deno run --allow-net --allow-read

/**
 * Seed SurrealDB with initial fruit data from raw_apples_and_oranges.json
 *
 * Usage:
 *   deno run --allow-net --allow-read scripts/seed-surrealdb.ts
 *
 * Prerequisites:
 *   SurrealDB running at http://localhost:8000
 */

const SURREAL_URL = Deno.env.get("SURREAL_URL") || "http://localhost:8001";
const SURREAL_NS = "matchmaking";
const SURREAL_DB = "fruits";
const SURREAL_USER = "root";
const SURREAL_PASS = "root";

async function surrealQuery(sql: string): Promise<unknown[]> {
  // Prepend USE statement to set namespace and database context
  const fullSql = `USE NS ${SURREAL_NS} DB ${SURREAL_DB};\n${sql}`;
  const response = await fetch(`${SURREAL_URL}/sql`, {
    method: "POST",
    headers: {
      "Content-Type": "application/surql",
      Accept: "application/json",
      Authorization: `Basic ${btoa(`${SURREAL_USER}:${SURREAL_PASS}`)}`,
    },
    body: fullSql,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`SurrealDB error (${response.status}): ${text}`);
  }

  const results = await response.json();
  // Skip the first result (USE statement)
  return results.slice(1);
}

async function main() {
  console.log("🌱 Seeding SurrealDB...");
  console.log(`   URL: ${SURREAL_URL}`);
  console.log(`   Namespace: ${SURREAL_NS}`);
  console.log(`   Database: ${SURREAL_DB}`);

  // Read the JSON data
  const dataPath = new URL("../data/raw_apples_and_oranges.json", import.meta.url).pathname;
  const rawData = await Deno.readTextFile(dataPath);
  const fruits = JSON.parse(rawData) as Array<{
    type: "apple" | "orange";
    attributes: Record<string, unknown>;
    preferences: Record<string, unknown>;
  }>;

  console.log(`\n📦 Found ${fruits.length} fruits in seed data`);

  // Set up namespace and database
  console.log("\n🔧 Setting up schema...");
  // Use SCHEMALESS tables for flexibility with SurrealDB 3.x
  await surrealQuery(`
    DEFINE TABLE apple SCHEMALESS;
    DEFINE TABLE orange SCHEMALESS;
    DEFINE TABLE match SCHEMALESS;
    DEFINE INDEX match_mutual_score ON TABLE match FIELDS mutualScore;
    DEFINE INDEX match_created_at ON TABLE match FIELDS createdAt;
  `);

  console.log("✅ Schema created");

  // Clear existing data
  await surrealQuery("DELETE apple; DELETE orange; DELETE match;");
  console.log("🗑️  Cleared existing data");

  // Insert fruits
  let appleCount = 0;
  let orangeCount = 0;

  for (const fruit of fruits) {
    const table = fruit.type;
    const attrs = JSON.stringify(fruit.attributes);
    const prefs = JSON.stringify(fruit.preferences);

    await surrealQuery(
      `CREATE ${table} CONTENT {
        attributes: ${attrs},
        preferences: ${prefs},
        attributeDescription: NONE,
        preferenceDescription: NONE,
        createdAt: time::now()
      }`
    );

    if (fruit.type === "apple") appleCount++;
    else orangeCount++;
  }

  console.log(`\n🍎 Inserted ${appleCount} apples`);
  console.log(`🍊 Inserted ${orangeCount} oranges`);

  // Verify
  const verifyResult = await surrealQuery(
    "SELECT count() AS count FROM apple GROUP ALL; SELECT count() AS count FROM orange GROUP ALL;"
  );
  console.log("\n✅ Verification:", JSON.stringify(verifyResult, null, 2));
  console.log("\n🎉 Seeding complete!");
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  Deno.exit(1);
});
