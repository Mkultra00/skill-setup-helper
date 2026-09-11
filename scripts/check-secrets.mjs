/** Scan distributable/tracked source without ever printing a matched secret. */
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
const files = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { encoding: "utf8" },
)
  .split("\0")
  .filter(Boolean);
const patterns = [
  /ydc-sk-[A-Za-z0-9_-]{20,}/,
  /dtn_[a-f0-9]{40,}/,
  /sk_live_[A-Za-z0-9]{20,}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
];
const hits = [];
for (const file of files) {
  if (!existsSync(file) || file === "scripts/check-secrets.mjs") continue;
  const content = readFileSync(file, "utf8");
  if (patterns.some((p) => p.test(content))) hits.push(file);
}
if (hits.length) {
  console.error("Potential secrets in: " + hits.join(", "));
  process.exitCode = 1;
} else console.log(`Secret scan passed (${files.length} non-ignored files).`);
