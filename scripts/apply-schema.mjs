import "dotenv/config";
import { readFile } from "node:fs/promises";
import { Client } from "pg";

const connectionString =
  process.env.SUPABASE_DB_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL;

if (!connectionString) {
  console.error(
    [
      "Faltou SUPABASE_DB_URL no .env.",
      "Coloque localmente a connection string do Supabase em SUPABASE_DB_URL.",
      "Nao cole senha ou connection string no chat.",
    ].join("\n"),
  );
  process.exit(1);
}

const schemaSql = await readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8");
const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  await client.query(schemaSql);
  console.log("Schema aplicado com sucesso no Supabase.");
} catch (error) {
  console.error("Falha ao aplicar schema:");
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
