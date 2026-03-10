export const WORKSPACE_CONTEXT_KEY = "auditor.activeWorkspaceId";
export const WORKSPACE_CONTEXT_EVENT = "auditor:workspace-context-change";

export function getActiveWorkspaceId(): number | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(WORKSPACE_CONTEXT_KEY);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function withWorkspaceQuery(path: string, workspaceId?: number | null): string {
  if (!workspaceId || !Number.isFinite(workspaceId) || workspaceId <= 0) {
    return path;
  }

  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}workspaceId=${workspaceId}`;
}
