import { readFile, readdir, writeFile } from "node:fs/promises";
import { createHmac } from "node:crypto";
const folders = await readdir(".claimant", { withFileTypes: true });
let entry;
for (const folder of folders) {
  if (!folder.isDirectory() || folder.name === "test-results") continue;
  try {
    const state = JSON.parse(await readFile(`.claimant/${folder.name}/workspace.json`, "utf8"));
    entry = state.entitlements.find((e) => !e.demo);
    if (entry) break;
  } catch {}
}
if (!entry) throw new Error("Run live discovery in the UI first.");
const body = JSON.stringify({
  title: entry.title,
  classDefinition: entry.classDefinition,
  officialUrl: entry.officialUrl,
  proofRequired: entry.proofRequired,
});
const timestamp = String(Math.floor(Date.now() / 1000));
const signature = createHmac("sha256", process.env.CREWAI_HMAC_SECRET)
  .update(`${timestamp}.${body}`)
  .digest("hex");
console.log("Testing CrewAI preparation against a live public source.");
const response = await fetch("http://127.0.0.1:8001/prepare", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Claimant-Timestamp": timestamp,
    "X-Claimant-Signature": signature,
  },
  body,
});
const result = await response.json();
await writeFile(
  ".claimant/test-results/crewai-live.json",
  JSON.stringify({ httpStatus: response.status, ...result }, null, 2),
);
console.log(
  JSON.stringify({
    httpStatus: response.status,
    status: result.status,
    predicateCount: result.predicates?.length,
    events: result.events,
    error: result.detail,
  }),
);
if (!response.ok) process.exitCode = 1;
