import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const scannedDirs = ["server", "client", "shared"];
const allowedFiles = new Set([
  path.normalize("server/llm-client.ts"),
]);

const patterns = [
  "NVIDIA_BASE_URL",
  "NVIDIA_API_KEY",
  "/chat/completions",
  "chat/completions",
  "api.openai.com",
  "/responses",
  "responses.create",
];

const extensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      files.push(...walk(fullPath));
    } else if (extensions.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

const violations = [];

for (const dir of scannedDirs) {
  const absoluteDir = path.join(repoRoot, dir);
  if (!fs.existsSync(absoluteDir)) continue;

  for (const file of walk(absoluteDir)) {
    const relative = path.normalize(path.relative(repoRoot, file));
    if (allowedFiles.has(relative)) continue;

    const content = fs.readFileSync(file, "utf8");
    const lines = content.split(/\r?\n/);

    lines.forEach((line, index) => {
      for (const pattern of patterns) {
        if (line.includes(pattern)) {
          violations.push(`${relative}:${index + 1} contains "${pattern}"`);
        }
      }
    });
  }
}

if (violations.length > 0) {
  console.error("Direct LLM provider usage is only allowed in server/llm-client.ts.");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log("LLM provider usage guardrail passed.");
