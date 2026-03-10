import type { CheckStatus } from "./types";

const checkStyles: Record<CheckStatus, { box: string; icon: string }> = {
  done: { box: "bg-green-500 text-white", icon: "✓" },
  partial: { box: "bg-yellow-400 text-white", icon: "½" },
  na: { box: "bg-slate-200 text-slate-500", icon: "N/A" },
  none: { box: "bg-slate-200 text-slate-400", icon: "–" },
};

function Check({ status }: { status: CheckStatus }) {
  const style = checkStyles[status];
  return (
    <div
      className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${
        status === "na" ? "text-[9px] font-medium" : "text-xs"
      } ${style.box}`}
    >
      {style.icon}
    </div>
  );
}

function renderMultiline(text: string) {
  const lines = text.split(/\r?\n/);
  return (
    <>
      {lines.map((line, index) => (
        <span key={`${line}-${index}`}>
          {line}
          {index < lines.length - 1 ? <br /> : null}
        </span>
      ))}
    </>
  );
}

export function ChecklistRow({ label, status, comments }: { label: string; status: CheckStatus; comments?: string[] }) {
  const hasComments = comments && comments.length > 0;

  return (
    <div className="flex gap-3 py-2 px-3 rounded-md hover:bg-slate-50 transition-colors">
      <Check status={status} />
      <div className="flex-1 min-w-0">
        <span
          className={`text-sm ${
            status === "none"
              ? "text-slate-400"
              : status === "na"
                ? "text-slate-500 line-through"
                : "text-slate-600"
          }`}
        >
          {label}
        </span>
        {hasComments && (
          <div className="mt-1">
            {comments.length === 1 ? (
              <p className="text-xs text-slate-400 leading-relaxed">{renderMultiline(comments[0])}</p>
            ) : (
              <ul className="space-y-0.5">
                {comments.map((c, i) => (
                  <li key={i} className="text-xs text-slate-400 flex gap-1.5">
                    <span className="text-slate-300">·</span>
                    <span>{renderMultiline(c)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
