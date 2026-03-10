import { Link2, Link2Off, Save, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { logoutAndRedirectToLogin } from "../auth-guard";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { getEntityTypeBadgeClass } from "../entity-type-color";

type AvailableUser = {
  id: string;
  name: string;
  email: string;
  gravatarUrl: string;
};

type WorkspaceDetail = {
  workspace: {
    id: number;
    name: string;
    createdAt: string;
    updatedAt: string;
  };
  members: Array<{
    userId: string;
    name: string;
    email: string;
    gravatarUrl: string;
    role: "workspace_manager";
    createdAt: string;
  }>;
  availableUsers: AvailableUser[];
  availableEntities: Array<{
    id: number;
    type: string;
    name: string;
  }>;
  availableAudits: Array<{
    id: number;
    name: string;
    description: string;
  }>;
  entities: Array<{
    id: number;
    type: string;
    name: string;
    linkedAt: string;
  }>;
  audits: Array<{
    id: number;
    name: string;
    description: string;
    linkedAt: string;
  }>;
};

function formatDateLabel(value: string | null | undefined): string {
  if (!value) return "None";
  const normalized = value.includes(" ") ? `${value.replace(" ", "T")}Z` : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return "None";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Warsaw",
  }).format(date);
}

export function WorkspaceEditPage() {
  const { workspaceId: workspaceIdParam } = useParams<{ workspaceId: string }>();
  const workspaceId = Number(workspaceIdParam);
  const [meRole, setMeRole] = useState<"admin" | "audit_manager" | "user" | null>(null);
  const [loadingMe, setLoadingMe] = useState(true);

  const [workspaceDetail, setWorkspaceDetail] = useState<WorkspaceDetail | null>(null);
  const [workspaceDetailLoading, setWorkspaceDetailLoading] = useState(true);
  const [workspaceDetailError, setWorkspaceDetailError] = useState<string | null>(null);

  const [workspaceName, setWorkspaceName] = useState("");
  const [savingWorkspaceName, setSavingWorkspaceName] = useState(false);

  const [selectedNewMemberId, setSelectedNewMemberId] = useState("");
  const [addingMember, setAddingMember] = useState(false);
  const [selectedNewEntityId, setSelectedNewEntityId] = useState("");
  const [addingEntity, setAddingEntity] = useState(false);
  const [selectedNewAuditId, setSelectedNewAuditId] = useState("");
  const [addingAudit, setAddingAudit] = useState(false);
  const [workspaceActionError, setWorkspaceActionError] = useState<string | null>(null);

  const loadWorkspaceDetail = async () => {
    if (!Number.isFinite(workspaceId) || workspaceId <= 0) {
      setWorkspaceDetailError("Invalid workspace id.");
      setWorkspaceDetailLoading(false);
      return;
    }

    setWorkspaceDetailLoading(true);
    setWorkspaceDetailError(null);
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (response.status === 401) {
        await logoutAndRedirectToLogin();
        return;
      }
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Failed to load workspace details.");
      }

      const data = (await response.json()) as WorkspaceDetail;
      setWorkspaceDetail(data);
      setWorkspaceName(data.workspace.name);
      setWorkspaceActionError(null);
      setSelectedNewMemberId("");
      setSelectedNewEntityId("");
      setSelectedNewAuditId("");
    } catch (error) {
      setWorkspaceDetail(null);
      setWorkspaceDetailError(
        error instanceof Error ? error.message : "Failed to load workspace details."
      );
    } finally {
      setWorkspaceDetailLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/me", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    })
      .then(async (response) => {
        if (response.status === 401) {
          await logoutAndRedirectToLogin();
          return null;
        }
        if (!response.ok) return null;
        return (await response.json()) as { user?: { role?: string } };
      })
      .then((payload) => {
        if (cancelled) return;
        const role = payload?.user?.role;
        if (role === "admin" || role === "audit_manager" || role === "user") {
          setMeRole(role);
        } else {
          setMeRole("user");
        }
      })
      .finally(() => {
        if (cancelled) return;
        setLoadingMe(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (loadingMe || meRole !== "admin") return;
    void loadWorkspaceDetail();
  }, [workspaceIdParam, loadingMe, meRole]);

  const saveWorkspaceName = async () => {
    if (!workspaceDetail || savingWorkspaceName) return;
    const name = workspaceName.trim();
    if (!name) {
      setWorkspaceActionError("Workspace name is required.");
      return;
    }

    setSavingWorkspaceName(true);
    setWorkspaceActionError(null);
    try {
      const response = await fetch(`/api/workspaces/${workspaceDetail.workspace.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      if (response.status === 401) {
        await logoutAndRedirectToLogin();
        return;
      }
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Failed to update workspace.");
      }

      await loadWorkspaceDetail();
    } catch (error) {
      setWorkspaceActionError(
        error instanceof Error ? error.message : "Failed to update workspace."
      );
    } finally {
      setSavingWorkspaceName(false);
    }
  };

  const addMember = async () => {
    if (!workspaceDetail || !selectedNewMemberId || addingMember) return;

    setAddingMember(true);
    setWorkspaceActionError(null);
    try {
      const response = await fetch(`/api/workspaces/${workspaceDetail.workspace.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedNewMemberId, role: "workspace_manager" }),
      });
      if (response.status === 401) {
        await logoutAndRedirectToLogin();
        return;
      }
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Failed to add member.");
      }

      await loadWorkspaceDetail();
    } catch (error) {
      setWorkspaceActionError(error instanceof Error ? error.message : "Failed to add member.");
    } finally {
      setAddingMember(false);
    }
  };

  const removeMember = async (userId: string) => {
    if (!workspaceDetail) return;
    setWorkspaceActionError(null);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceDetail.workspace.id}/members/${encodeURIComponent(userId)}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
        }
      );
      if (response.status === 401) {
        await logoutAndRedirectToLogin();
        return;
      }
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Failed to remove member.");
      }

      await loadWorkspaceDetail();
    } catch (error) {
      setWorkspaceActionError(
        error instanceof Error ? error.message : "Failed to remove member."
      );
    }
  };

  const removeWorkspaceEntity = async (entityId: number) => {
    if (!workspaceDetail) return;
    setWorkspaceActionError(null);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceDetail.workspace.id}/entities/${entityId}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
        }
      );
      if (response.status === 401) {
        await logoutAndRedirectToLogin();
        return;
      }
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Failed to unlink entity.");
      }

      await loadWorkspaceDetail();
    } catch (error) {
      setWorkspaceActionError(
        error instanceof Error ? error.message : "Failed to unlink entity."
      );
    }
  };

  const addEntity = async () => {
    if (!workspaceDetail || !selectedNewEntityId || addingEntity) return;

    const entityId = Number(selectedNewEntityId);
    if (!Number.isFinite(entityId) || entityId <= 0) {
      setWorkspaceActionError("Select a valid entity.");
      return;
    }

    setAddingEntity(true);
    setWorkspaceActionError(null);
    try {
      const response = await fetch(`/api/workspaces/${workspaceDetail.workspace.id}/entities/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityIds: [entityId] }),
      });
      if (response.status === 401) {
        await logoutAndRedirectToLogin();
        return;
      }
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Failed to link entity.");
      }

      await loadWorkspaceDetail();
    } catch (error) {
      setWorkspaceActionError(error instanceof Error ? error.message : "Failed to link entity.");
    } finally {
      setAddingEntity(false);
    }
  };

  const removeWorkspaceAudit = async (auditId: number) => {
    if (!workspaceDetail) return;
    setWorkspaceActionError(null);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceDetail.workspace.id}/audits/${auditId}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
        }
      );
      if (response.status === 401) {
        await logoutAndRedirectToLogin();
        return;
      }
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Failed to unlink audit template.");
      }

      await loadWorkspaceDetail();
    } catch (error) {
      setWorkspaceActionError(
        error instanceof Error ? error.message : "Failed to unlink audit template."
      );
    }
  };

  const addAudit = async () => {
    if (!workspaceDetail || !selectedNewAuditId || addingAudit) return;

    const auditId = Number(selectedNewAuditId);
    if (!Number.isFinite(auditId) || auditId <= 0) {
      setWorkspaceActionError("Select a valid audit template.");
      return;
    }

    setAddingAudit(true);
    setWorkspaceActionError(null);
    try {
      const response = await fetch(`/api/workspaces/${workspaceDetail.workspace.id}/audits/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auditIds: [auditId] }),
      });
      if (response.status === 401) {
        await logoutAndRedirectToLogin();
        return;
      }
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Failed to link audit template.");
      }

      await loadWorkspaceDetail();
    } catch (error) {
      setWorkspaceActionError(
        error instanceof Error ? error.message : "Failed to link audit template."
      );
    } finally {
      setAddingAudit(false);
    }
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Workspaces", to: "/settings/workspaces" }, { label: "Edit" }]} />

      {loadingMe ? (
        <section className="rounded-2xl border border-[#d9d4c8] bg-white p-6 text-sm text-[#7a7468]">
          Loading workspace...
        </section>
      ) : null}

      {!loadingMe && meRole !== "admin" ? (
        <section className="rounded-2xl border border-[#d9d4c8] bg-white p-6 text-sm text-[#8a5648]">
          Admin access required.
        </section>
      ) : null}

      {meRole === "admin" && workspaceDetailLoading ? (
        <section className="rounded-2xl border border-[#d9d4c8] bg-white p-6 text-sm text-[#7a7468]">
          Loading workspace details...
        </section>
      ) : null}

      {meRole === "admin" && workspaceDetailError ? (
        <section className="rounded-2xl border border-[#d9d4c8] bg-white p-6 text-sm text-[#8a5648]">
          {workspaceDetailError}
        </section>
      ) : null}

      {!loadingMe && meRole === "admin" && !workspaceDetailLoading && workspaceDetail ? (
        <div className="space-y-6">
          <section className="rounded-2xl border border-[#d9d4c8] bg-white overflow-hidden">
            <div className="border-b border-[#ece7dd] px-4 py-3">
              <h2 className="text-lg font-semibold">Workspace</h2>
            </div>
            <div className="space-y-3 p-4">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#746d60]">
                Workspace name
              </label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  value={workspaceName}
                  onChange={(event) => setWorkspaceName(event.target.value)}
                  className="w-full rounded-lg border border-[#d4cec0] bg-white px-3 py-2 text-sm sm:max-w-md"
                />
                <button
                  type="button"
                  onClick={() => void saveWorkspaceName()}
                  disabled={
                    savingWorkspaceName ||
                    !workspaceName.trim() ||
                    workspaceName.trim() === workspaceDetail.workspace.name
                  }
                  className="inline-flex items-center gap-1 rounded-md border border-[#d4cec0] px-3 py-2 text-sm hover:bg-[#f8f5ef] disabled:opacity-50"
                >
                  <Save size={14} />
                  {savingWorkspaceName ? "Saving..." : "Save"}
                </button>
              </div>
              <p className="text-xs text-[#7a7468]">
                Created: {formatDateLabel(workspaceDetail.workspace.createdAt)} · Updated:{" "}
                {formatDateLabel(workspaceDetail.workspace.updatedAt)}
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-[#d9d4c8] bg-white overflow-hidden">
            <div className="border-b border-[#ece7dd] px-4 py-3">
              <h2 className="text-lg font-semibold">Members</h2>
            </div>
            <div className="space-y-3 p-4">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold">Linked users</h4>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedNewMemberId}
                    onChange={(event) => setSelectedNewMemberId(event.target.value)}
                    className="rounded-lg border border-[#d4cec0] bg-white px-2 py-1.5 text-sm"
                  >
                    <option value="">Select user</option>
                    {workspaceDetail.availableUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} ({user.email})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => void addMember()}
                    disabled={!selectedNewMemberId || addingMember}
                    className="inline-flex items-center gap-1 rounded-md border border-[#d4cec0] px-2 py-1.5 text-sm hover:bg-[#f8f5ef] disabled:opacity-50"
                  >
                    <UserPlus size={14} />
                    {addingMember ? "Adding..." : "Add"}
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-[#e2dccf]">
                <table className="min-w-full divide-y divide-[#e9e4d8] text-sm">
                  <thead className="bg-[#fcfbf8] text-left text-[#5f594d]">
                    <tr>
                      <th className="px-3 py-2 font-medium w-14"></th>
                      <th className="px-3 py-2 font-medium">Name</th>
                      <th className="px-3 py-2 font-medium">Email</th>
                      <th className="px-3 py-2 font-medium">Role</th>
                      <th className="px-3 py-2 font-medium">Joined</th>
                      <th className="px-3 py-2 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eee9de] bg-white text-[#2e2a24]">
                    {workspaceDetail.members.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-3 py-4 text-[#6b665b]">
                          No members.
                        </td>
                      </tr>
                    ) : (
                      workspaceDetail.members.map((member) => (
                        <tr key={member.userId}>
                          <td className="px-3 py-2">
                            <img
                              src={member.gravatarUrl}
                              alt={`${member.name} avatar`}
                              className="h-7 w-7 rounded-full border border-[#d4cec0]"
                            />
                          </td>
                          <td className="px-3 py-2">{member.name}</td>
                          <td className="px-3 py-2">{member.email}</td>
                          <td className="px-3 py-2">{member.role}</td>
                          <td className="px-3 py-2">{formatDateLabel(member.createdAt)}</td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => void removeMember(member.userId)}
                              className="inline-flex items-center rounded-md border border-[#d4cec0] p-1.5 hover:bg-[#f6f3ec]"
                              aria-label={`Unlink ${member.name}`}
                            >
                              <Link2Off size={13} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-[#d9d4c8] bg-white overflow-hidden">
            <div className="border-b border-[#ece7dd] px-4 py-3">
              <h2 className="text-lg font-semibold">Entities</h2>
            </div>
            <div className="p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold">Linked entities</h4>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedNewEntityId}
                    onChange={(event) => setSelectedNewEntityId(event.target.value)}
                    className="rounded-lg border border-[#d4cec0] bg-white px-2 py-1.5 text-sm"
                  >
                    <option value="">Select entity</option>
                    {workspaceDetail.availableEntities.map((entity) => (
                      <option key={entity.id} value={entity.id}>
                        {entity.type}/{entity.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => void addEntity()}
                    disabled={!selectedNewEntityId || addingEntity}
                    className="inline-flex items-center gap-1 rounded-md border border-[#d4cec0] px-2 py-1.5 text-sm hover:bg-[#f8f5ef] disabled:opacity-50"
                  >
                    <Link2 size={14} />
                    {addingEntity ? "Linking..." : "Link"}
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-[#e2dccf]">
                <table className="min-w-full divide-y divide-[#e9e4d8] text-sm">
                  <thead className="bg-[#fcfbf8] text-left text-[#5f594d]">
                    <tr>
                      <th className="px-3 py-2 font-medium">Type</th>
                      <th className="px-3 py-2 font-medium">Name</th>
                      <th className="px-3 py-2 font-medium">Linked</th>
                      <th className="px-3 py-2 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eee9de] bg-white text-[#2e2a24]">
                    {workspaceDetail.entities.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-4 text-[#6b665b]">
                          No entities linked.
                        </td>
                      </tr>
                    ) : (
                      workspaceDetail.entities.map((entity) => (
                        <tr key={entity.id}>
                          <td className="px-3 py-2">
                            <span className={getEntityTypeBadgeClass(entity.type)}>{entity.type}</span>
                          </td>
                          <td className="px-3 py-2">{entity.name}</td>
                          <td className="px-3 py-2">{formatDateLabel(entity.linkedAt)}</td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => void removeWorkspaceEntity(entity.id)}
                              className="inline-flex items-center rounded-md border border-[#d4cec0] p-1.5 hover:bg-[#f6f3ec]"
                              aria-label={`Unlink ${entity.type}/${entity.name}`}
                            >
                              <Link2Off size={13} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-[#d9d4c8] bg-white overflow-hidden">
            <div className="border-b border-[#ece7dd] px-4 py-3">
              <h2 className="text-lg font-semibold">Audit Templates</h2>
            </div>
            <div className="p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold">Linked audit templates</h4>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedNewAuditId}
                    onChange={(event) => setSelectedNewAuditId(event.target.value)}
                    className="rounded-lg border border-[#d4cec0] bg-white px-2 py-1.5 text-sm"
                  >
                    <option value="">Select audit template</option>
                    {workspaceDetail.availableAudits.map((audit) => (
                      <option key={audit.id} value={audit.id}>
                        {audit.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => void addAudit()}
                    disabled={!selectedNewAuditId || addingAudit}
                    className="inline-flex items-center gap-1 rounded-md border border-[#d4cec0] px-2 py-1.5 text-sm hover:bg-[#f8f5ef] disabled:opacity-50"
                  >
                    <Link2 size={14} />
                    {addingAudit ? "Linking..." : "Link"}
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-[#e2dccf]">
                <table className="min-w-full divide-y divide-[#e9e4d8] text-sm">
                  <thead className="bg-[#fcfbf8] text-left text-[#5f594d]">
                    <tr>
                      <th className="px-3 py-2 font-medium">Name</th>
                      <th className="px-3 py-2 font-medium">Description</th>
                      <th className="px-3 py-2 font-medium">Linked</th>
                      <th className="px-3 py-2 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eee9de] bg-white text-[#2e2a24]">
                    {workspaceDetail.audits.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-4 text-[#6b665b]">
                          No audit templates linked.
                        </td>
                      </tr>
                    ) : (
                      workspaceDetail.audits.map((audit) => (
                        <tr key={audit.id}>
                          <td className="px-3 py-2">{audit.name}</td>
                          <td className="px-3 py-2">{audit.description || "None"}</td>
                          <td className="px-3 py-2">{formatDateLabel(audit.linkedAt)}</td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => void removeWorkspaceAudit(audit.id)}
                              className="inline-flex items-center rounded-md border border-[#d4cec0] p-1.5 hover:bg-[#f6f3ec]"
                              aria-label={`Unlink ${audit.name}`}
                            >
                              <Link2Off size={13} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {workspaceActionError ? (
            <section className="rounded-xl border border-[#e7cfc7] bg-[#fff8f6] px-4 py-3 text-sm text-[#8a5648]">
              {workspaceActionError}
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
