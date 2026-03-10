import { Fragment, useEffect, useMemo, useState } from "react";
import { Plus, Settings } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { logoutAndRedirectToLogin } from "../auth-guard";
import { Breadcrumbs } from "../components/Breadcrumbs";

type SettingsTab = "users" | "workspaces";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "audit_manager" | "user";
  gravatarUrl: string;
};

type UserWorkspaceMembership = {
  workspaceId: number;
  workspaceName: string;
  role: "workspace_manager";
  assignedAt: string;
};

type WorkspaceRow = {
  id: number;
  name: string;
  memberCount: number;
  entityCount: number;
  auditTemplateCount: number;
  createdAt: string;
  updatedAt: string;
};

function getTabFromParam(value: string | undefined): SettingsTab {
  if (value === "workspaces") return "workspaces";
  return "users";
}

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

export function SettingsPage() {
  const { tab } = useParams<{ tab?: string }>();
  const selectedTab = getTabFromParam(tab);
  const [meRole, setMeRole] = useState<"admin" | "audit_manager" | "user" | null>(null);
  const [loadingMe, setLoadingMe] = useState(true);

  const [users, setUsers] = useState<UserRow[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [updatingUserRoleId, setUpdatingUserRoleId] = useState<string | null>(null);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [loadingUserMembershipId, setLoadingUserMembershipId] = useState<string | null>(null);
  const [userMembershipsById, setUserMembershipsById] = useState<
    Record<string, UserWorkspaceMembership[]>
  >({});
  const [userMembershipsError, setUserMembershipsError] = useState<string | null>(null);

  const [workspaces, setWorkspaces] = useState<WorkspaceRow[]>([]);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);
  const [workspacesError, setWorkspacesError] = useState<string | null>(null);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);
  const [workspaceActionError, setWorkspaceActionError] = useState<string | null>(null);

  const sortedUsers = useMemo(
    () =>
      [...users].sort((a, b) => {
        const nameCompare = a.name.localeCompare(b.name);
        if (nameCompare !== 0) return nameCompare;
        return a.email.localeCompare(b.email);
      }),
    [users]
  );

  const sortedWorkspaces = useMemo(
    () => [...workspaces].sort((a, b) => a.name.localeCompare(b.name)),
    [workspaces]
  );

  const loadUsers = async () => {
    setLoadingUsers(true);
    setUsersError(null);
    try {
      const response = await fetch("/api/users", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (response.status === 401) {
        await logoutAndRedirectToLogin();
        return;
      }
      if (!response.ok) {
        throw new Error("Failed to load users.");
      }

      const data = (await response.json()) as { users: UserRow[] };
      setUsers(data.users ?? []);
    } catch (error) {
      setUsersError(error instanceof Error ? error.message : "Failed to load users.");
    } finally {
      setLoadingUsers(false);
    }
  };

  const setUserRole = async (userId: string, role: "admin" | "audit_manager" | "user") => {
    if (updatingUserRoleId) return;

    setUpdatingUserRoleId(userId);
    setUsersError(null);
    try {
      const response = await fetch(`/api/users/${encodeURIComponent(userId)}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });

      if (response.status === 401) {
        await logoutAndRedirectToLogin();
        return;
      }
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Failed to update role.");
      }

      setUsers((current) =>
        current.map((user) => (user.id === userId ? { ...user, role } : user))
      );
    } catch (error) {
      setUsersError(error instanceof Error ? error.message : "Failed to update role.");
    } finally {
      setUpdatingUserRoleId(null);
    }
  };

  const toggleUserMemberships = async (userId: string) => {
    if (expandedUserId === userId) {
      setExpandedUserId(null);
      setUserMembershipsError(null);
      return;
    }

    setExpandedUserId(userId);
    setUserMembershipsError(null);

    if (userMembershipsById[userId]) {
      return;
    }

    setLoadingUserMembershipId(userId);
    try {
      const response = await fetch(`/api/users/${encodeURIComponent(userId)}/workspaces`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (response.status === 401) {
        await logoutAndRedirectToLogin();
        return;
      }
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Failed to load user workspaces.");
      }

      const data = (await response.json()) as { workspaces: UserWorkspaceMembership[] };
      setUserMembershipsById((current) => ({
        ...current,
        [userId]: data.workspaces ?? [],
      }));
    } catch (error) {
      setUserMembershipsError(
        error instanceof Error ? error.message : "Failed to load user workspaces."
      );
    } finally {
      setLoadingUserMembershipId(null);
    }
  };

  const loadWorkspaces = async () => {
    setLoadingWorkspaces(true);
    setWorkspacesError(null);
    try {
      const response = await fetch("/api/workspaces", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (response.status === 401) {
        await logoutAndRedirectToLogin();
        return;
      }
      if (!response.ok) {
        throw new Error("Failed to load workspaces.");
      }

      const data = (await response.json()) as { workspaces: WorkspaceRow[] };
      setWorkspaces(data.workspaces ?? []);
    } catch (error) {
      setWorkspacesError(error instanceof Error ? error.message : "Failed to load workspaces.");
    } finally {
      setLoadingWorkspaces(false);
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
        if (!response.ok) {
          return null;
        }
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
    if (selectedTab === "users") {
      void loadUsers();
    }
    if (selectedTab === "workspaces") {
      void loadWorkspaces();
    }
  }, [selectedTab, loadingMe, meRole]);

  const createWorkspace = async () => {
    const name = newWorkspaceName.trim();
    if (!name || creatingWorkspace) {
      return;
    }

    setCreatingWorkspace(true);
    setWorkspaceActionError(null);
    try {
      const response = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      if (response.status === 401) {
        await logoutAndRedirectToLogin();
        return;
      }
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Failed to create workspace.");
      }

      setNewWorkspaceName("");
      await loadWorkspaces();
    } catch (error) {
      setWorkspaceActionError(
        error instanceof Error ? error.message : "Failed to create workspace."
      );
    } finally {
      setCreatingWorkspace(false);
    }
  };

  if (loadingMe) {
    return <p className="text-sm text-[#7a7468]">Loading settings...</p>;
  }

  if (meRole !== "admin") {
    return (
      <section className="rounded-2xl border border-[#d9d4c8] bg-white p-6 text-sm text-[#8a5648]">
        Admin access required.
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: selectedTab === "users" ? "Users" : "Workspaces" }]} />

      {selectedTab === "users" ? (
        <section className="rounded-2xl border border-[#d9d4c8] bg-white overflow-hidden">
          <div className="border-b border-[#ece7dd] px-4 py-3">
            <h2 className="text-lg font-semibold">Users</h2>
          </div>

          {loadingUsers ? <p className="px-4 py-6 text-sm text-[#7a7468]">Loading users...</p> : null}
          {usersError ? <p className="px-4 py-6 text-sm text-[#8a5648]">{usersError}</p> : null}

          {!loadingUsers && !usersError ? (
            <table className="w-full table-fixed text-sm">
              <thead className="bg-[#f8f5ef] text-left text-[#5d584d]">
                <tr>
                  <th className="px-4 py-3 font-medium w-16 min-w-16 max-w-16" aria-label="User image"></th>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eee9de] bg-white text-[#2e2a24]">
                {sortedUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-[#6b665b]">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  sortedUsers.map((user) => {
                    const isExpanded = expandedUserId === user.id;
                    const memberships = userMembershipsById[user.id] ?? [];
                    return (
                      <Fragment key={user.id}>
                        <tr
                          onClick={() => void toggleUserMemberships(user.id)}
                          className="cursor-pointer hover:bg-[#fbf9f4]"
                          aria-expanded={isExpanded}
                        >
                          <td className="px-4 py-3 w-16 min-w-16 max-w-16">
                            <img
                              src={user.gravatarUrl}
                              alt={`${user.name} avatar`}
                              className="h-8 w-8 shrink-0 rounded-full border border-[#d4cec0] bg-[#f6f3ec] object-cover"
                              loading="lazy"
                            />
                          </td>
                          <td className="px-4 py-3">{user.name}</td>
                          <td className="px-4 py-3">{user.email}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                user.role === "admin"
                                  ? "bg-[#dbeafe] text-[#1d4ed8]"
                                  : user.role === "audit_manager"
                                    ? "bg-[#dcfce7] text-[#166534]"
                                    : "bg-[#ece7dd] text-[#5e584d]"
                              }`}
                            >
                              {user.role}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void setUserRole(user.id, "admin");
                                }}
                                disabled={updatingUserRoleId === user.id || user.role === "admin"}
                                className="rounded-md border border-[#d4cec0] px-2 py-1 text-xs hover:bg-[#f6f3ec] disabled:opacity-50"
                              >
                                Set admin role
                              </button>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void setUserRole(user.id, "audit_manager");
                                }}
                                disabled={
                                  updatingUserRoleId === user.id || user.role === "audit_manager"
                                }
                                className="rounded-md border border-[#d4cec0] px-2 py-1 text-xs hover:bg-[#f6f3ec] disabled:opacity-50"
                              >
                                Set audit manager role
                              </button>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void setUserRole(user.id, "user");
                                }}
                                disabled={updatingUserRoleId === user.id || user.role === "user"}
                                className="rounded-md border border-[#d4cec0] px-2 py-1 text-xs hover:bg-[#f6f3ec] disabled:opacity-50"
                              >
                                Set user role
                              </button>
                            </div>
                          </td>
                        </tr>
                        {isExpanded ? (
                          <tr className="bg-[#fcfbf8]">
                            <td colSpan={5} className="px-4 py-3">
                              <div className="rounded-lg border border-[#e3ddcf] bg-white p-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-[#746d60]">
                                  Workspace memberships
                                </p>
                                {loadingUserMembershipId === user.id ? (
                                  <p className="mt-2 text-sm text-[#7a7468]">Loading workspaces...</p>
                                ) : null}
                                {userMembershipsError ? (
                                  <p className="mt-2 text-sm text-[#8a5648]">{userMembershipsError}</p>
                                ) : null}
                                {loadingUserMembershipId !== user.id && !userMembershipsError ? (
                                  memberships.length === 0 ? (
                                    <p className="mt-2 text-sm text-[#7a7468]">
                                      No workspace assignments.
                                    </p>
                                  ) : (
                                    <div className="mt-2 flex flex-wrap gap-2">
                                      {memberships.map((membership) => (
                                        <span
                                          key={membership.workspaceId}
                                          className="inline-flex items-center overflow-hidden rounded-full border border-[#d8d2c4] text-xs text-[#4f493e]"
                                        >
                                          <span className="bg-[#f6f3ec] px-3 py-1">
                                            {membership.workspaceName}
                                          </span>
                                          <span className="bg-[#ece7dd] px-2.5 py-1 font-medium text-[#5e584d]">
                                            {membership.role}
                                          </span>
                                        </span>
                                      ))}
                                    </div>
                                  )
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          ) : null}
        </section>
      ) : null}

      {selectedTab === "workspaces" ? (
        <div className="space-y-6">
          <section className="rounded-2xl border border-[#d9d4c8] bg-white p-6 space-y-3">
            <h2 className="text-lg font-semibold">Create Workspace</h2>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                value={newWorkspaceName}
                onChange={(event) => setNewWorkspaceName(event.target.value)}
                placeholder="Workspace name"
                className="w-full rounded-lg border border-[#d4cec0] bg-white px-3 py-2 placeholder:text-[#bcb6a8] sm:max-w-sm"
              />
              <button
                type="button"
                onClick={() => void createWorkspace()}
                disabled={creatingWorkspace || !newWorkspaceName.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1f6feb] px-4 py-2 text-sm font-medium text-white hover:bg-[#1b63d6] disabled:opacity-50"
              >
                <Plus size={14} />
                {creatingWorkspace ? "Creating..." : "Create workspace"}
              </button>
            </div>
            {workspaceActionError ? (
              <p className="text-sm text-[#8a5648]">{workspaceActionError}</p>
            ) : null}
          </section>

          <section className="rounded-2xl border border-[#d9d4c8] bg-white overflow-hidden">
            <div className="border-b border-[#ece7dd] px-4 py-3">
              <h2 className="text-lg font-semibold">Workspaces</h2>
            </div>

            {loadingWorkspaces ? (
              <p className="px-4 py-6 text-sm text-[#7a7468]">Loading workspaces...</p>
            ) : null}
            {workspacesError ? <p className="px-4 py-6 text-sm text-[#8a5648]">{workspacesError}</p> : null}

            {!loadingWorkspaces && !workspacesError ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-[#e9e4d8] text-sm">
                  <thead className="bg-[#fcfbf8] text-left text-[#5f594d]">
                    <tr>
                      <th className="px-4 py-3 font-medium">ID</th>
                      <th className="px-4 py-3 font-medium">Name</th>
                      <th className="px-4 py-3 font-medium">Members</th>
                      <th className="px-4 py-3 font-medium">Entities</th>
                      <th className="px-4 py-3 font-medium">Audit templates</th>
                      <th className="px-4 py-3 font-medium text-right">Edit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eee9de] bg-white text-[#2e2a24]">
                    {sortedWorkspaces.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-6 text-[#6b665b]">
                          No workspaces yet.
                        </td>
                      </tr>
                    ) : (
                      sortedWorkspaces.map((workspace) => (
                        <tr key={workspace.id}>
                          <td className="px-4 py-3 font-mono text-xs">{workspace.id}</td>
                          <td className="px-4 py-3">{workspace.name}</td>
                          <td className="px-4 py-3">{workspace.memberCount}</td>
                          <td className="px-4 py-3">{workspace.entityCount}</td>
                          <td className="px-4 py-3">{workspace.auditTemplateCount ?? 0}</td>
                          <td className="px-4 py-3 text-right">
                            <Link
                              to={`/settings/workspaces/${workspace.id}/edit`}
                              className="inline-flex items-center rounded-md border border-[#d4cec0] p-1.5 hover:bg-[#f6f3ec]"
                              aria-label={`Edit workspace ${workspace.name}`}
                            >
                              <Settings size={13} />
                            </Link>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </div>
  );
}
