import type { Workspace } from "./claimant-data";
export async function api<T = Workspace>(action = "", data?: unknown): Promise<T> {
  const response = await fetch(`/api/claimant${action ? `/${action}` : ""}`, {
    method: data === undefined ? "GET" : "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "The request could not be completed.");
  return result as T;
}
