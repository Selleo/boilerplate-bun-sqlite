import type { Grade } from "./types";

function gradeColors(grade: Grade): { bg: string; text: string; border: string } {
  if (grade === "N/A") {
    return { bg: "bg-slate-300", text: "text-slate-700", border: "border-slate-400" };
  }

  const palette = [
    { bg: "bg-green-500", text: "text-white", border: "border-green-600" }, // A
    { bg: "bg-lime-500", text: "text-white", border: "border-lime-600" }, // B
    { bg: "bg-yellow-400", text: "text-white", border: "border-yellow-500" }, // C
    { bg: "bg-orange-500", text: "text-white", border: "border-orange-600" }, // D
    { bg: "bg-red-500", text: "text-white", border: "border-red-600" }, // E
    { bg: "bg-red-700", text: "text-white", border: "border-red-800" }, // F+
  ];

  const firstChar = grade.trim().toUpperCase().charCodeAt(0);
  if (Number.isNaN(firstChar)) {
    return palette[5];
  }

  const offset = Math.max(0, Math.min(5, firstChar - "A".charCodeAt(0)));
  return palette[offset] ?? palette[5];
}

export function ScoreBadge({ grade, size = "md" }: { grade: Grade; size?: "sm" | "md" | "lg" | "xl" }) {
  const colors = gradeColors(grade);
  const sizeClasses = {
    sm: "w-7 h-7 text-xs font-bold",
    md: "w-9 h-9 text-sm font-bold",
    lg: "w-12 h-12 text-lg font-bold",
    xl: "w-20 h-20 text-3xl font-extrabold",
  };

  return (
    <div
      className={`${sizeClasses[size]} ${colors.bg} ${colors.text} border ${colors.border} rounded-lg flex items-center justify-center shrink-0`}
    >
      {grade}
    </div>
  );
}
