import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { resolve, join } from "node:path";
import { DEMO_ENTITLEMENTS, type Workspace } from "../lib/claimant-data";

export const privateRoot = resolve(process.env["CLAIMANT_DATA_DIR"] || ".claimant");
export const integrations = () => ({
  you: !!process.env["YOU_API_KEY"],
  daytona: !!process.env["DAYTONA_API_KEY"],
  crewai: !!process.env["CREWAI_SERVICE_URL"],
  conduit: !!process.env["ONE_SECRET"] && !!process.env["ONE_GMAIL_CONNECTION_KEY"],
});
export function initialWorkspace(): Workspace {
  return {
    entitlements: [],
    claims: [],
    evidence: [],
    memories: [],
    dismissed: [],
    saved: [],
    events: [],
    minimumPayout: 0,
    researchConsent: false,
    run: null,
    integrations: integrations(),
  };
}
export async function readWorkspace(id: string): Promise<Workspace> {
  try {
    const state = JSON.parse(
      await readFile(join(privateRoot, id, "workspace.json"), "utf8"),
    ) as Workspace;
    state.entitlements = state.entitlements.filter(
      (e) => !e.demo || e.id.startsWith("guided-demo-"),
    );
    state.claims = state.claims.filter((c) =>
      state.entitlements.some((e) => e.id === c.entitlementId),
    );
    return { ...state, integrations: integrations() };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return initialWorkspace();
  }
}
export async function writeWorkspace(id: string, state: Workspace) {
  const dir = join(privateRoot, id);
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const temp = join(dir, `${randomUUID()}.tmp`);
  await writeFile(temp, JSON.stringify(state), { mode: 0o600 });
  await rename(temp, join(dir, "workspace.json"));
}
const locks = new Map<string, Promise<unknown>>();
export async function mutate<T>(id: string, fn: (state: Workspace) => Promise<T> | T): Promise<T> {
  const previous = locks.get(id) || Promise.resolve();
  const next = previous
    .catch(() => {})
    .then(async () => {
      const state = await readWorkspace(id);
      const result = await fn(state);
      await writeWorkspace(id, state);
      return result;
    });
  locks.set(id, next);
  try {
    return await next;
  } finally {
    if (locks.get(id) === next) locks.delete(id);
  }
}
export function event(
  state: Workspace,
  agent: "SCOUT" | "FILER" | "CONDUIT" | "YOU",
  message: string,
) {
  state.events.unshift({ id: randomUUID(), agent, message, at: new Date().toISOString() });
  state.events = state.events.slice(0, 100);
}
