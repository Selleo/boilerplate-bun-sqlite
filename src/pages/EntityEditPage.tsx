import { Save } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { logoutAndRedirectToLogin } from "../auth-guard";
import { Breadcrumbs } from "../components/Breadcrumbs";

type EntityDetail = {
  id: number;
  type: string;
  name: string;
  description: string;
  updatedAt: string;
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

export function EntityEditPage() {
  const navigate = useNavigate();
  const { entityId } = useParams<{ entityId: string }>();
  const id = Number(entityId);

  const [entity, setEntity] = useState<EntityDetail | null>(null);
  const [type, setType] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!Number.isFinite(id) || id <= 0) {
        setError("Invalid entity id.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/entities/${id}`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });

        if (response.status === 401) {
          await logoutAndRedirectToLogin();
          return;
        }

        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(payload.error ?? "Failed to load entity.");
        }

        const data = (await response.json()) as { entity: EntityDetail };
        if (!cancelled) {
          setEntity(data.entity);
          setType(data.entity.type);
          setName(data.entity.name);
          setDescription(data.entity.description);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load entity.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const save = async () => {
    if (saving || !entity) return;
    const trimmedType = type.trim();
    const trimmedName = name.trim();
    if (!trimmedType) {
      setError("Entity type is required.");
      return;
    }
    if (!trimmedName) {
      setError("Entity name is required.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/entities/${entity.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: trimmedType,
          name: trimmedName,
          description,
        }),
      });

      if (response.status === 401) {
        await logoutAndRedirectToLogin();
        return;
      }

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Failed to save entity.");
      }

      const data = (await response.json()) as { entity: EntityDetail };
      setEntity(data.entity);
      setType(data.entity.type);
      setName(data.entity.name);
      setDescription(data.entity.description);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save entity.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Entities", to: "/entities" },
          { label: entity ? `${entity.type}/${entity.name}` : "Edit" },
        ]}
      />

      <section className="rounded-2xl border border-[#d9d4c8] bg-white p-6 space-y-4">
        {loading ? <p className="text-sm text-[#7a7468]">Loading entity...</p> : null}
        {!loading && !entity ? <p className="text-sm text-[#8a5648]">{error ?? "Entity not found."}</p> : null}

        {!loading && entity ? (
          <>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold">Edit Entity #{entity.id}</h1>
                <p className="mt-1 text-sm text-[#6b665b]">
                  Last updated {formatDateLabel(entity.updatedAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving || !type.trim() || !name.trim()}
                className="inline-flex items-center gap-2 rounded-lg bg-[#1f6feb] px-4 py-2 text-sm font-medium text-white hover:bg-[#1b63d6] disabled:opacity-50"
              >
                <Save size={14} />
                {saving ? "Saving..." : "Save"}
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="text-[#5f594d]">Type</span>
                <input
                  value={type}
                  onChange={(event) => setType(event.target.value)}
                  className="w-full rounded-lg border border-[#d4cec0] bg-white px-3 py-2 placeholder:text-[#bcb6a8]"
                  placeholder="Type"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-[#5f594d]">Name</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="w-full rounded-lg border border-[#d4cec0] bg-white px-3 py-2 placeholder:text-[#bcb6a8]"
                  placeholder="Name"
                />
              </label>
            </div>

            <label className="space-y-1 text-sm block">
              <span className="text-[#5f594d]">Description</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="min-h-28 w-full rounded-lg border border-[#d4cec0] bg-white px-3 py-2 placeholder:text-[#bcb6a8]"
                placeholder="Optional description"
              />
            </label>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => navigate("/entities")}
                className="rounded-lg border border-[#d4cec0] px-4 py-2 text-sm hover:bg-[#f6f3ec]"
              >
                Back to entities
              </button>
            </div>

            {error ? <p className="text-sm text-[#8a5648]">{error}</p> : null}
          </>
        ) : null}
      </section>
    </div>
  );
}
