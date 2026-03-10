import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { logoutAndRedirectToLogin } from "../auth-guard";
import { Breadcrumbs } from "../components/Breadcrumbs";

type ImportResponse = {
  audit: {
    id: number;
  };
};

export function AuditImportPage() {
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (submitting) return;
    const value = input.trim();
    if (value.length < 20) {
      setError("Provide at least 20 characters so AI can infer the audit structure.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/audits/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: value }),
      });

      if (response.status === 401) {
        await logoutAndRedirectToLogin();
        return;
      }

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Failed to import audit.");
      }

      const payload = (await response.json()) as ImportResponse;
      navigate(`/audits/${payload.audit.id}/edit`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import audit.");
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Breadcrumbs items={[{ label: "Audit templates", to: "/audits" }, { label: "Generate with AI" }]} />
      </div>

      <section className="rounded-2xl border border-[#d9d4c8] bg-white p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Generate Audit with AI</h1>
        <p className="text-sm text-[#6b665b]">
          Paste your audit specification. We will analyze the structure and generate dimensions,
          criteria, and checklist items.
        </p>

        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Paste audit requirements, framework sections, expected controls, and evidence expectations..."
          className="min-h-[360px] w-full rounded-xl border border-[#d4cec0] bg-white px-4 py-3 text-sm placeholder:text-[#bcb6a8]"
          disabled={submitting}
        />

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void submit()}
            disabled={submitting || input.trim().length < 20}
            className="inline-flex items-center gap-2 rounded-lg bg-[#1f6feb] px-4 py-2 text-sm font-medium text-white hover:bg-[#1b63d6] disabled:opacity-50"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
            {submitting ? "AI is analyzing structure and building audit..." : "Next"}
          </button>
          {submitting ? <span className="text-xs text-[#7a7468]">This can take a few seconds.</span> : null}
        </div>

        {error ? <p className="text-sm text-[#8a5648]">{error}</p> : null}
      </section>
    </div>
  );
}
