import { Pencil, Plus, Trash2, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { logoutAndRedirectToLogin } from "../auth-guard";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { getEntityTypeBadgeClass } from "../entity-type-color";

type EntityRow = {
  id: number;
  type: string;
  name: string;
  description: string;
  updatedAt: string;
  assessmentsCount: number;
  workspacesCount: number;
};

type WorkspaceRow = {
  id: number;
  name: string;
};

type BulkAssignSummary = {
  requested: number;
  valid: number;
  assigned: number;
  alreadyLinked: number;
  invalid: number;
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

export function EntitiesPage() {
  const [entities, setEntities] = useState<EntityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceRow[]>([]);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(true);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [targetWorkspaceId, setTargetWorkspaceId] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignSummary, setAssignSummary] = useState<BulkAssignSummary | null>(null);

  const [newType, setNewType] = useState("");
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const sortedEntities = useMemo(
    () =>
      [...entities].sort((a, b) =>
        `${a.type}/${a.name}`.localeCompare(`${b.type}/${b.name}`)
      ),
    [entities]
  );
  const sortedWorkspaces = useMemo(
    () => [...workspaces].sort((a, b) => a.name.localeCompare(b.name)),
    [workspaces]
  );
  const distinctTypes = useMemo(
    () => Array.from(new Set(sortedEntities.map((entity) => entity.type))).sort((a, b) => a.localeCompare(b)),
    [sortedEntities]
  );
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredEntities = useMemo(
    () => {
      const byType =
        typeFilter === "all"
          ? sortedEntities
          : sortedEntities.filter((entity) => entity.type === typeFilter);
      if (!normalizedQuery) {
        return byType;
      }
      return byType.filter((entity) =>
        `${entity.type} ${entity.name} ${entity.description}`.toLowerCase().includes(normalizedQuery)
      );
    },
    [sortedEntities, typeFilter, normalizedQuery]
  );
  const allVisibleEntityIds = useMemo(
    () => filteredEntities.map((entity) => entity.id),
    [filteredEntities]
  );
  const selectedIdsSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allSelected = allVisibleEntityIds.length > 0 && allVisibleEntityIds.every((id) => selectedIdsSet.has(id));

  const loadEntities = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/entities", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (response.status === 401) {
        await logoutAndRedirectToLogin();
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to load entities.");
      }

      const data = (await response.json()) as { entities: EntityRow[] };
      setEntities(data.entities ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load entities.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadEntities();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadWorkspaces = async () => {
      setLoadingWorkspaces(true);
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

        const data = (await response.json()) as { workspaces: Array<{ id: number; name: string }> };
        if (!cancelled) {
          const list = (data.workspaces ?? []).map((workspace) => ({
            id: workspace.id,
            name: workspace.name,
          }));
          setWorkspaces(list);
          const firstWorkspace = list.at(0);
          if (firstWorkspace) {
            setTargetWorkspaceId(String(firstWorkspace.id));
          }
        }
      } catch (err) {
        if (!cancelled) {
          setAssignError(err instanceof Error ? err.message : "Failed to load workspaces.");
        }
      } finally {
        if (!cancelled) {
          setLoadingWorkspaces(false);
        }
      }
    };

    void loadWorkspaces();
    return () => {
      cancelled = true;
    };
  }, []);

  const createEntity = async () => {
    if (creating) return;
    const type = newType.trim();
    const name = newName.trim();
    const description = newDescription.trim();

    if (!type) {
      setError("Entity type is required.");
      return;
    }
    if (!name) {
      setError("Entity name is required.");
      return;
    }

    setCreating(true);
    setError(null);
    try {
      const response = await fetch("/api/entities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, name, description }),
      });

      if (response.status === 401) {
        await logoutAndRedirectToLogin();
        return;
      }

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Failed to create entity.");
      }

      const data = (await response.json()) as { entity: EntityRow };
      setEntities((current) => [...current, { ...data.entity, assessmentsCount: 0, workspacesCount: 0 }]);
      if (typeFilter !== "all" && data.entity.type !== typeFilter) {
        setTypeFilter("all");
      }
      setNewType("");
      setNewName("");
      setNewDescription("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create entity.");
    } finally {
      setCreating(false);
    }
  };

  const toggleEntity = (entityId: number) => {
    setSelectedIds((current) => {
      if (current.includes(entityId)) {
        return current.filter((id) => id !== entityId);
      }
      return [...current, entityId];
    });
    setAssignSummary(null);
    setAssignError(null);
  };

  const toggleSelectAll = () => {
    setSelectedIds((current) => {
      const currentSet = new Set(current);
      const shouldClear = allVisibleEntityIds.every((id) => currentSet.has(id));
      if (shouldClear) {
        return current.filter((id) => !allVisibleEntityIds.includes(id));
      }
      const merged = new Set([...current, ...allVisibleEntityIds]);
      return [...merged];
    });
    setAssignSummary(null);
    setAssignError(null);
  };

  const assignSelectedToWorkspace = async () => {
    if (assigning) return;
    if (selectedIds.length === 0) {
      setAssignError("Select at least one entity.");
      return;
    }
    const workspaceId = Number(targetWorkspaceId);
    if (!Number.isFinite(workspaceId) || workspaceId <= 0) {
      setAssignError("Select a workspace.");
      return;
    }

    setAssigning(true);
    setAssignError(null);
    setAssignSummary(null);
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/entities/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityIds: selectedIds }),
      });

      if (response.status === 401) {
        await logoutAndRedirectToLogin();
        return;
      }
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Failed to assign entities.");
      }

      const data = (await response.json()) as { summary: BulkAssignSummary };
      setAssignSummary(data.summary);
      setSelectedIds([]);
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : "Failed to assign entities.");
    } finally {
      setAssigning(false);
    }
  };

  const deleteEntity = async (entity: EntityRow) => {
    if (entity.assessmentsCount > 0) return;
    if (!window.confirm(`Delete ${entity.type}/${entity.name}?`)) {
      return;
    }

    setError(null);
    try {
      const response = await fetch(`/api/entities/${entity.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });

      if (response.status === 401) {
        await logoutAndRedirectToLogin();
        return;
      }
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Failed to delete entity.");
      }

      setEntities((current) => current.filter((row) => row.id !== entity.id));
      setSelectedIds((current) => current.filter((id) => id !== entity.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete entity.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <Breadcrumbs items={[{ label: "Entities" }]} />
        <Link
          to="/entities/import"
          className="inline-flex items-center gap-2 rounded-lg border border-[#d4cec0] bg-white px-3 py-2 text-sm hover:bg-[#f6f3ec]"
        >
          <Upload size={14} className="text-[#1f6feb]" />
          Import CSV
        </Link>
      </div>

      <section className="rounded-2xl border border-[#d9d4c8] bg-white p-6 space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Add Entity</h2>
          <p className="text-sm text-[#5f594d]">
            Entities are the business targets you assess, for example a project, system, vendor, or
            team. In practice, they answer the question: "what exactly are we auditing?"
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <input
            value={newType}
            onChange={(event) => setNewType(event.target.value)}
            placeholder="Type"
            required
            className="w-full rounded-lg border border-[#d4cec0] bg-white px-3 py-2 placeholder:text-[#bcb6a8]"
          />
          <input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="Name"
            required
            className="w-full rounded-lg border border-[#d4cec0] bg-white px-3 py-2 placeholder:text-[#bcb6a8]"
          />
          <input
            value={newDescription}
            onChange={(event) => setNewDescription(event.target.value)}
            placeholder="Description (optional)"
            className="w-full rounded-lg border border-[#d4cec0] bg-white px-3 py-2 placeholder:text-[#bcb6a8]"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void createEntity();
              }
            }}
          />
        </div>
        <button
          type="button"
          onClick={() => void createEntity()}
          disabled={creating || !newType.trim() || !newName.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1f6feb] px-4 py-2 text-sm font-medium text-white hover:bg-[#1b63d6] disabled:opacity-50"
        >
          <Plus size={14} />
          {creating ? "Creating..." : "Create entity"}
        </button>
        {error ? <p className="text-sm text-[#8a5648]">{error}</p> : null}
      </section>

      <div>
        <h2 className="text-lg font-semibold">Entities</h2>
        {loading ? <p className="mt-4 text-sm text-[#7a7468]">Loading entities...</p> : null}
        {!loading && distinctTypes.length > 0 ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setTypeFilter("all")}
              className={`rounded-full border px-3 py-1 text-xs ${
                typeFilter === "all"
                  ? "border-[#8f6b4f] bg-[#f2e9dc] text-[#4e3626]"
                  : "border-[#d4cec0] bg-white text-[#5f594d] hover:bg-[#f8f5ef]"
              }`}
            >
              All ({sortedEntities.length})
            </button>
            {distinctTypes.map((type) => {
              const count = sortedEntities.filter((entity) => entity.type === type).length;
              const active = typeFilter === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setTypeFilter(type)}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    active
                      ? "border-[#8f6b4f] bg-[#f2e9dc] text-[#4e3626]"
                      : "border-[#d4cec0] bg-white text-[#5f594d] hover:bg-[#f8f5ef]"
                  }`}
                >
                  {type} ({count})
                </button>
              );
            })}
          </div>
        ) : null}
        {!loading && sortedEntities.length === 0 ? (
          <p className="mt-4 text-sm text-[#7a7468]">No entities yet.</p>
        ) : null}
        {!loading && sortedEntities.length > 0 ? (
          <div className="mt-4 overflow-hidden rounded-lg border border-[#e2dccf] bg-white">
            {assignError ? <p className="px-4 pt-3 text-sm text-[#8a5648]">{assignError}</p> : null}
            {assignSummary ? (
              <p className="px-4 pt-3 text-sm text-[#335749]">
                Assigned {assignSummary.assigned} of {assignSummary.valid} valid entities
                ({assignSummary.alreadyLinked} already linked, {assignSummary.invalid} invalid).
              </p>
            ) : null}
            <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[#e9e4d8] text-sm">
              <thead className="bg-[#fcfbf8] text-left text-[#5f594d]">
                <tr>
                  <th colSpan={8} className="px-4 py-3 font-medium">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="w-full lg:max-w-md">
                        <input
                          value={searchQuery}
                          onChange={(event) => setSearchQuery(event.target.value)}
                          placeholder="Search entities by type, name, or description"
                          className="w-full rounded-lg border border-[#d4cec0] bg-white px-3 py-2 text-sm placeholder:text-[#bcb6a8]"
                        />
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <span className="text-sm text-[#5f594d]">
                          Selected: <span className="font-semibold">{selectedIds.length}</span>
                        </span>
                        <select
                          value={targetWorkspaceId}
                          onChange={(event) => setTargetWorkspaceId(event.target.value)}
                          disabled={loadingWorkspaces || sortedWorkspaces.length === 0}
                          className="min-w-48 rounded-lg border border-[#d4cec0] bg-white px-2 py-1.5 text-sm disabled:opacity-60"
                        >
                          {sortedWorkspaces.length === 0 ? <option value="">No workspaces</option> : null}
                          {sortedWorkspaces.map((workspace) => (
                            <option key={workspace.id} value={workspace.id}>
                              {workspace.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => void assignSelectedToWorkspace()}
                          disabled={assigning || selectedIds.length === 0 || !targetWorkspaceId}
                          className="inline-flex items-center justify-center rounded-lg border border-[#d4cec0] bg-white px-4 py-2 text-sm font-medium text-[#3f3a30] hover:bg-[#f6f3ec] disabled:opacity-50"
                        >
                          {assigning ? "Assigning..." : "Assign to workspace"}
                        </button>
                      </div>
                    </div>
                  </th>
                </tr>
                <tr>
                  <th className="px-4 py-3 font-medium w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      aria-label="Select all entities"
                    />
                  </th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Description</th>
                  <th className="px-4 py-3 font-medium">Workspaces</th>
                  <th className="px-4 py-3 font-medium">Assessments</th>
                  <th className="px-4 py-3 font-medium">Updated</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eee9de] bg-white text-[#2e2a24]">
                {filteredEntities.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-6 text-sm text-[#7a7468]">
                      No entities match current filters/search.
                    </td>
                  </tr>
                ) : (
                  filteredEntities.map((entity) => (
                    <tr key={entity.id}>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIdsSet.has(entity.id)}
                          onChange={() => toggleEntity(entity.id)}
                          aria-label={`Select ${entity.type}/${entity.name}`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <span className={getEntityTypeBadgeClass(entity.type)}>{entity.type}</span>
                      </td>
                      <td className="px-4 py-3">{entity.name}</td>
                      <td className="px-4 py-3">{entity.description || "None"}</td>
                      <td className="px-4 py-3">{entity.workspacesCount ?? 0}</td>
                      <td className="px-4 py-3">{entity.assessmentsCount ?? 0}</td>
                      <td className="px-4 py-3">{formatDateLabel(entity.updatedAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <Link
                            to={`/entities/${entity.id}/edit`}
                            className="inline-flex items-center justify-center rounded-md border border-[#d4cec0] p-2 hover:bg-[#f6f3ec]"
                            aria-label={`Edit ${entity.type}/${entity.name}`}
                          >
                            <Pencil size={14} />
                          </Link>
                          <button
                            type="button"
                            onClick={() => void deleteEntity(entity)}
                            disabled={entity.assessmentsCount > 0}
                            className="inline-flex items-center justify-center rounded-md border border-[#d4cec0] p-2 hover:bg-[#f6f3ec] disabled:cursor-not-allowed disabled:opacity-50"
                            aria-label={`Delete ${entity.type}/${entity.name}`}
                            title={
                              entity.assessmentsCount > 0
                                ? "Cannot delete entity with assessments."
                                : "Delete entity"
                            }
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
