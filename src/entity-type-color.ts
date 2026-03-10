const ENTITY_TYPE_PALETTE = [
  { bg: "bg-[#eef6ff]", text: "text-[#1f4b8f]", border: "border-[#c9dbf5]" },
  { bg: "bg-[#eefbf1]", text: "text-[#1f6b3b]", border: "border-[#c9e8d2]" },
  { bg: "bg-[#fff6ea]", text: "text-[#8a4b1f]", border: "border-[#f2d8bb]" },
  { bg: "bg-[#f5f0ff]", text: "text-[#5a3a8f]", border: "border-[#ded0f5]" },
  { bg: "bg-[#fff0f2]", text: "text-[#8c2d4a]", border: "border-[#f4c9d4]" },
  { bg: "bg-[#eefaf9]", text: "text-[#1f5f5a]", border: "border-[#c8e7e3]" },
  { bg: "bg-[#f6f5ef]", text: "text-[#5f594d]", border: "border-[#ddd8cb]" },
];

function hashText(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getEntityTypeColor(type: string) {
  const normalized = type.trim().toLowerCase();
  const index = hashText(normalized || "unknown") % ENTITY_TYPE_PALETTE.length;
  return ENTITY_TYPE_PALETTE[index]!;
}

export function getEntityTypeBadgeClass(type: string): string {
  const color = getEntityTypeColor(type);
  return `inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${color.bg} ${color.text} ${color.border}`;
}

