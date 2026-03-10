import { useEffect, useRef } from "react";
import { Search } from "lucide-react";

export function SearchInput() {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="flex h-9 items-center rounded-xl border border-[#dfe5f0] border-b-2 border-b-[#dfe5f0] bg-white px-3 text-[#8990a3]">
      <Search size={15} />
      <input
        ref={inputRef}
        type="text"
        placeholder="Search anything"
        className="ml-2 w-52 bg-transparent text-[14px] text-[#4f566f] outline-none placeholder:text-[#8f97ab]"
      />
      <span className="ml-6 text-[12px] text-[#4f566f]">⌘ K</span>
    </div>
  );
}
