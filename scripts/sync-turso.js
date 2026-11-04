const { createClient } = require("@libsql/client");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// Load .env
const envPath = path.resolve(__dirname, "../.env");
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      process.env[key] = val;
    }
  }
}

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    console.error("TURSO_DATABASE_URL or TURSO_AUTH_TOKEN not found in .env");
    process.exit(1);
  }

  console.log("Connecting to Turso:", url);
  const client = createClient({ url, authToken });

  console.log("Generating Prisma migration DDL...");
  const ddl = execSync(
    "npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script",
    { encoding: "utf-8" }
  );

  console.log("Executing DDL migration on Turso...");
  const rawStatements = ddl.split(";");

  for (const raw of rawStatements) {
    const lines = raw.split("\n").filter((l) => !l.trim().startsWith("--"));
    const stmt = lines.join("\n").trim();
    if (!stmt) continue;

    try {
      await client.execute(stmt);
    } catch (err) {
      if (!err.message.includes("already exists")) {
        console.warn("Statement notice:", err.message);
      }
    }
  }

  console.log("✓ Turso schema migration successfully applied!");

  const tables = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';");
  console.log("Turso tables created:", tables.rows.map((r) => r.name).join(", "));

  client.close();
}

main().catch((err) => {
  console.error("Turso sync error:", err);
  process.exit(1);
});
