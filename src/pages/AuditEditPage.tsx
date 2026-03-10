import { GripVertical, Trash2 } from "lucide-react";
import { Fragment, useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { logoutAndRedirectToLogin } from "../auth-guard";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { type Audit, type ChecklistItem, type Criterion, type Dimension } from "./auditData";

const sortByPosition = <T extends { position: number }>(values: T[]) => {
  return [...values].sort((a, b) => a.position - b.position);
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

function InlineSpinner({ className }: { className?: string }) {
  return (
    <span
      className={`inline-block h-3.5 w-3.5 shrink-0 aspect-square animate-spin rounded-full border-2 border-[#1f6feb] border-t-transparent ${className ?? ""}`}
      aria-hidden
    />
  );
}

function InlineEditableText({
  value,
  onSave,
  className,
  inputClassName,
  placeholder = "Click to edit",
  showSavingState = false,
  fakeDelayMs = 0,
  savingClassName,
}: {
  value: string;
  onSave: (nextValue: string) => void | Promise<void>;
  className?: string;
  inputClassName?: string;
  placeholder?: string;
  showSavingState?: boolean;
  fakeDelayMs?: number;
  savingClassName?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [savingValue, setSavingValue] = useState(value);
  const [saveError, setSaveError] = useState<string | null>(null);

  const commit = async () => {
    const next = draft.trim();
    const hasChanged = next && next !== value;
    try {
      setSaveError(null);
      if (hasChanged && showSavingState) {
        setSavingValue(next);
        setSaving(true);
        if (fakeDelayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, fakeDelayMs));
        }
      }
      if (hasChanged) await onSave(next);
      setDraft(next || value);
      setSaving(false);
      setEditing(false);
    } catch (error) {
      setSaving(false);
      setEditing(true);
      setSaveError(error instanceof Error ? error.message : "Failed to save.");
    }
  };

  if (saving && showSavingState) {
    return (
      <span className="inline-flex w-full items-center gap-2 opacity-70">
        <span className={`min-w-0 flex-1 ${savingClassName ?? className ?? "truncate"}`}>
          {savingValue}
        </span>
        <InlineSpinner />
      </span>
    );
  }

  if (editing) {
    return (
      <span className="block w-full">
        <input
          autoFocus
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (saveError) setSaveError(null);
          }}
          onBlur={() => void commit()}
          onKeyDown={(e) => {
            if (e.key === "Enter") void commit();
            if (e.key === "Escape") {
              setDraft(value);
              setSaveError(null);
              setEditing(false);
            }
          }}
          className={inputClassName ?? "rounded border border-[#d4cec0] px-2 py-1 text-sm"}
          placeholder={placeholder}
        />
        {saveError ? <span className="mt-1 block text-xs text-red-700">{saveError}</span> : null}
      </span>
    );
  }

  const hasValue = value.trim().length > 0;

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      className={`${className ?? "text-left hover:underline decoration-dotted"} ${
        hasValue ? "" : "text-[#9a9386]"
      }`}
    >
      {hasValue ? value : placeholder}
    </button>
  );
}

function InlineEditableTextarea({
  value,
  onSave,
  className,
  inputClassName,
  placeholder = "Click to edit",
  showSavingState = false,
  fakeDelayMs = 0,
}: {
  value: string;
  onSave: (nextValue: string) => void | Promise<void>;
  className?: string;
  inputClassName?: string;
  placeholder?: string;
  showSavingState?: boolean;
  fakeDelayMs?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [savingValue, setSavingValue] = useState(value);
  const [saveError, setSaveError] = useState<string | null>(null);

  const commit = async () => {
    const next = draft.trim();
    const hasChanged = next && next !== value;
    try {
      setSaveError(null);
      if (hasChanged && showSavingState) {
        setSavingValue(next);
        setSaving(true);
        if (fakeDelayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, fakeDelayMs));
        }
      }
      if (hasChanged) await onSave(next);
      setDraft(next || value);
      setSaving(false);
      setEditing(false);
    } catch (error) {
      setSaving(false);
      setEditing(true);
      setSaveError(error instanceof Error ? error.message : "Failed to save.");
    }
  };

  if (saving && showSavingState) {
    return (
      <span className="inline-flex w-full items-center gap-2 text-[#4d4a42] opacity-70">
        <span className="min-w-0 flex-1 truncate">{savingValue}</span>
        <InlineSpinner />
      </span>
    );
  }

  if (editing) {
    return (
      <span className="block w-full">
        <textarea
          autoFocus
          rows={2}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (saveError) setSaveError(null);
          }}
          onBlur={() => void commit()}
          onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => {
            if ((e.key === "Enter" && (e.metaKey || e.ctrlKey)) || e.key === "Escape") {
              if (e.key === "Escape") {
                setDraft(value);
                setSaveError(null);
              }
              void commit();
            }
          }}
          className={
            inputClassName ?? "w-full rounded border border-[#d4cec0] px-2 py-1 text-sm resize-none"
          }
          placeholder={placeholder}
        />
        {saveError ? <span className="mt-1 block text-xs text-red-700">{saveError}</span> : null}
      </span>
    );
  }

  const hasValue = value.trim().length > 0;

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      className={`${className ?? "text-left hover:underline decoration-dotted"} ${
        hasValue ? "" : "text-[#9a9386]"
      }`}
    >
      {hasValue ? value : placeholder}
    </button>
  );
}

function DangerDeleteButton({
  dangerMode,
  onClick,
  label,
  size = 14,
  compact = false,
}: {
  dangerMode: boolean;
  onClick: () => void;
  label: string;
  size?: number;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!dangerMode}
      className={`inline-flex items-center justify-center rounded-md border transition-opacity ${
        compact ? "p-1.5" : "p-2"
      } ${
        dangerMode
          ? "border-red-300 bg-red-50 text-red-700 hover:bg-red-100 opacity-100"
          : "border-transparent bg-transparent text-transparent opacity-0 pointer-events-none"
      }`}
      aria-label={label}
    >
      <Trash2 size={size} />
    </button>
  );
}

function EditableChecklistItem({
  item,
  dangerMode,
  onRename,
  onDelete,
  draggable = false,
  reordering = false,
  isDragging = false,
  onDragStart,
  onDragEnd,
}: {
  item: ChecklistItem;
  dangerMode: boolean;
  onRename: (name: string) => void | Promise<void>;
  onDelete: () => void | Promise<void>;
  draggable?: boolean;
  reordering?: boolean;
  isDragging?: boolean;
  onDragStart?: (event: DragEvent<HTMLButtonElement>) => void;
  onDragEnd?: (event: DragEvent<HTMLButtonElement>) => void;
}) {
  return (
    <li
      className={`rounded-lg border px-3 py-2 text-sm flex items-center justify-between gap-3 transition-colors ${
        isDragging
          ? "border-[#1f6feb] bg-[#e8f1ff] ring-1 ring-[#1f6feb]/30"
          : "border-[#f0ece3] bg-[#fcfbf8]"
      }`}
    >
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className="text-[#9a9386] text-xs shrink-0">{item.position}.</span>
        <span className="flex-1 min-w-0">
          <InlineEditableText
            value={item.name}
            onSave={onRename}
            className="block w-full text-left hover:underline decoration-dotted truncate"
            inputClassName="text-sm rounded border border-[#d4cec0] px-2 py-1 w-full"
            showSavingState
          />
        </span>
      </div>

      <div className="w-8 shrink-0 flex items-center justify-end">
        {dangerMode ? (
          <DangerDeleteButton
            dangerMode
            onClick={() => void onDelete()}
            label={`Delete item ${item.name}`}
            compact
            size={13}
          />
        ) : (
          <button
            type="button"
            tabIndex={-1}
            draggable={draggable && !reordering}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onFocus={(event) => event.currentTarget.blur()}
            className={`inline-flex items-center justify-center rounded-md p-1.5 text-[#9a9386] ${
              draggable && !reordering ? "cursor-grab active:cursor-grabbing" : "cursor-default"
            }`}
            aria-label={`Drag item ${item.name}`}
          >
            <GripVertical size={14} />
          </button>
        )}
      </div>
    </li>
  );
}

function EditableCriterion({
  dimensionId,
  criterion,
  dangerMode,
  onRename,
  onDescription,
  onDelete,
  onAddItem,
  onRenameItem,
  onDeleteItem,
  onReorderItems,
  draggable = false,
  reordering = false,
  isDragging = false,
  onDragStart,
  onDragEnd,
  compactView = false,
}: {
  dimensionId: string;
  criterion: Criterion;
  dangerMode: boolean;
  onRename: (name: string) => void | Promise<void>;
  onDescription: (description: string) => void | Promise<void>;
  onDelete: () => void | Promise<void>;
  onAddItem: (name: string) => void | Promise<void>;
  onRenameItem: (itemId: string, name: string) => void | Promise<void>;
  onDeleteItem: (itemId: string) => void | Promise<void>;
  onReorderItems: (sourceItemId: string, dropIndex: number) => void | Promise<void>;
  draggable?: boolean;
  reordering?: boolean;
  isDragging?: boolean;
  onDragStart?: (event: DragEvent<HTMLButtonElement>) => void;
  onDragEnd?: (event: DragEvent<HTMLButtonElement>) => void;
  compactView?: boolean;
}) {
  const [itemDraft, setItemDraft] = useState("");
  const [addingItem, setAddingItem] = useState(false);
  const [addingItemLabel, setAddingItemLabel] = useState("");
  const itemInputRef = useRef<HTMLInputElement | null>(null);
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [reorderingItems, setReorderingItems] = useState(false);
  const sortedItems = sortByPosition(criterion.items);

  const handleDrop = async (targetDropIndex: number) => {
    if (!draggingItemId || reorderingItems) {
      setDropIndex(null);
      return;
    }

    const sourceItemId = draggingItemId;
    setDraggingItemId(null);
    setDropIndex(null);
    setReorderingItems(true);
    try {
      await onReorderItems(sourceItemId, targetDropIndex);
    } finally {
      setReorderingItems(false);
    }
  };

  return (
    <div
      className={`rounded-xl border p-4 transition-colors ${
        isDragging
          ? "border-[#1f6feb] bg-[#eef5ff] ring-1 ring-[#1f6feb]/30"
          : "border-[#ece7dd]"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-medium flex-1 min-w-0 flex items-center gap-2">
          <span className="text-[#9a9386] text-sm font-normal shrink-0">{criterion.position}.</span>
          <span className="flex-1 min-w-0">
            <InlineEditableText
              value={criterion.name}
              onSave={onRename}
              className="block w-full text-left hover:underline decoration-dotted truncate"
              inputClassName="text-sm font-medium rounded border border-[#d4cec0] px-2 py-1 w-full"
              showSavingState
            />
          </span>
        </h3>
        <div className="flex items-center gap-1.5">
          <div className="w-8 shrink-0 flex items-center justify-end">
          {dangerMode ? (
            <DangerDeleteButton
              dangerMode
              onClick={() => void onDelete()}
              label={`Delete criterion ${criterion.name}`}
            />
          ) : (
            <button
              type="button"
              tabIndex={-1}
              draggable={draggable && !reordering}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onFocus={(event) => event.currentTarget.blur()}
              className={`inline-flex items-center justify-center rounded-md p-1.5 text-[#9a9386] ${
                draggable && !reordering ? "cursor-grab active:cursor-grabbing" : "cursor-default"
              }`}
              aria-label={`Drag criterion ${criterion.name}`}
            >
              <GripVertical size={14} />
            </button>
          )}
          </div>
        </div>
      </div>

      {!compactView ? (
        <>
          <div className="text-sm text-[#6b665b] mt-1">
            <InlineEditableTextarea
              value={criterion.description}
              onSave={onDescription}
              className="text-left hover:underline decoration-dotted"
              inputClassName="w-full rounded border border-[#d4cec0] px-2 py-1 text-sm"
              placeholder="Add criterion description"
              showSavingState
            />
          </div>

          <div className={`mt-3 ${reorderingItems ? "opacity-60 pointer-events-none" : ""}`}>
            <ul className="space-y-2">
              {sortedItems.map((item, index) => (
                <Fragment key={item.id}>
                  <li
                    className={`list-none transition-all ${
                      draggingItemId ? "h-5 opacity-100" : "h-0 overflow-hidden opacity-0"
                    }`}
                    onDragOver={(event) => {
                      if (!draggingItemId || reorderingItems) return;
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                      setDropIndex(index);
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      void handleDrop(index);
                    }}
                  >
                    <div
                      className={`h-4 rounded border-2 border-dashed ${
                        dropIndex === index
                          ? "border-[#1f6feb] bg-[#e8f1ff]"
                          : "border-[#b79f76] bg-[#faf1dd]"
                      }`}
                    />
                  </li>

                  <EditableChecklistItem
                    item={item}
                    dangerMode={dangerMode}
                    reordering={reorderingItems}
                    isDragging={draggingItemId === item.id}
                    draggable={sortedItems.length > 1}
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = "move";
                      setDraggingItemId(item.id);
                      setDropIndex(index);
                    }}
                    onDragEnd={() => {
                      setDraggingItemId(null);
                      setDropIndex(null);
                    }}
                    onRename={(name) => onRenameItem(item.id, name)}
                    onDelete={() => void onDeleteItem(item.id)}
                  />
                </Fragment>
              ))}

              <li
                className={`list-none transition-all ${
                  draggingItemId ? "h-5 opacity-100" : "h-0 overflow-hidden opacity-0"
                }`}
                onDragOver={(event) => {
                  if (!draggingItemId || reorderingItems) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  setDropIndex(sortedItems.length);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  void handleDrop(sortedItems.length);
                }}
              >
                <div
                  className={`h-4 rounded border-2 border-dashed ${
                    dropIndex === sortedItems.length
                      ? "border-[#1f6feb] bg-[#e8f1ff]"
                      : "border-[#b79f76] bg-[#faf1dd]"
                  }`}
                />
              </li>
            </ul>

            {reorderingItems ? (
              <div className="mt-2 inline-flex items-center gap-2 text-sm text-[#4d4a42]">
                <span>Reordering checklist items</span>
                <InlineSpinner />
              </div>
            ) : null}
          </div>

          <form
            className="mt-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const next = itemDraft.trim();
              if (!next || addingItem) return;

              setAddingItemLabel(next);
              setAddingItem(true);
              setItemDraft("");

              let added = false;
              try {
                await onAddItem(next);
                added = true;
              } finally {
                setAddingItem(false);
                setAddingItemLabel("");
                if (added) {
                  setTimeout(() => {
                    itemInputRef.current?.focus();
                  }, 0);
                }
              }
            }}
          >
            {addingItem ? (
              <div className="w-full rounded-xl border-2 border-dashed border-[#d4cec0] bg-[#fbf9f4] px-4 py-3 text-sm">
                <span className="inline-flex w-full items-center gap-2 text-[#4d4a42] opacity-70">
                  <span className="truncate">{addingItemLabel}</span>
                  <InlineSpinner />
                </span>
              </div>
            ) : (
              <input
                ref={itemInputRef}
                value={itemDraft}
                onChange={(e) => setItemDraft(e.target.value)}
                className="w-full rounded-xl border-2 border-dashed border-[#d4cec0] bg-[#fbf9f4] px-4 py-3 text-sm outline-none focus:border-[#1f6feb]"
                placeholder="Add checklist item and press Enter"
              />
            )}
          </form>
        </>
      ) : null}
    </div>
  );
}

function EditableDimension({
  dimension,
  dangerMode,
  onRename,
  onDelete,
  onAddCriterion,
  onRenameCriterion,
  onDescriptionCriterion,
  onDeleteCriterion,
  onAddItem,
  onRenameItem,
  onDeleteItem,
  onReorderItems,
  onReorderCriteria,
  draggable = false,
  reordering = false,
  isDragging = false,
  compactView = false,
  onDragStart,
  onDragEnd,
}: {
  dimension: Dimension;
  dangerMode: boolean;
  onRename: (name: string) => void | Promise<void>;
  onDelete: () => void | Promise<void>;
  onAddCriterion: (name: string) => void | Promise<void>;
  onRenameCriterion: (criterionId: string, name: string) => void | Promise<void>;
  onDescriptionCriterion: (criterionId: string, description: string) => void | Promise<void>;
  onDeleteCriterion: (criterionId: string) => void | Promise<void>;
  onAddItem: (criterionId: string, name: string) => void | Promise<void>;
  onRenameItem: (criterionId: string, itemId: string, name: string) => void | Promise<void>;
  onDeleteItem: (criterionId: string, itemId: string) => void | Promise<void>;
  onReorderItems: (criterionId: string, sourceItemId: string, dropIndex: number) => void | Promise<void>;
  onReorderCriteria: (sourceCriterionId: string, dropIndex: number) => void | Promise<void>;
  draggable?: boolean;
  reordering?: boolean;
  isDragging?: boolean;
  compactView?: boolean;
  onDragStart?: (event: DragEvent<HTMLButtonElement>) => void;
  onDragEnd?: (event: DragEvent<HTMLButtonElement>) => void;
}) {
  const [criterionDraft, setCriterionDraft] = useState("");
  const [addingCriterion, setAddingCriterion] = useState(false);
  const [addingCriterionLabel, setAddingCriterionLabel] = useState("");
  const criterionInputRef = useRef<HTMLInputElement | null>(null);
  const [draggingCriterionId, setDraggingCriterionId] = useState<string | null>(null);
  const [criterionDropIndex, setCriterionDropIndex] = useState<number | null>(null);
  const [reorderingCriteria, setReorderingCriteria] = useState(false);
  const sortedCriteria = sortByPosition(dimension.criteria);
  const compactCriteria = draggingCriterionId !== null || reorderingCriteria;

  const handleCriterionDrop = async (targetDropIndex: number) => {
    if (!draggingCriterionId || reorderingCriteria) {
      setCriterionDropIndex(null);
      return;
    }

    const sourceCriterionId = draggingCriterionId;
    setDraggingCriterionId(null);
    setCriterionDropIndex(null);
    setReorderingCriteria(true);
    try {
      await onReorderCriteria(sourceCriterionId, targetDropIndex);
    } finally {
      setReorderingCriteria(false);
    }
  };

  return (
    <article
      className={`rounded-2xl border bg-white p-5 transition-colors ${
        isDragging
          ? "border-[#1f6feb] bg-[#eef5ff] ring-1 ring-[#1f6feb]/30"
          : "border-[#d9d4c8]"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold flex-1 min-w-0 flex items-center gap-2">
          <span className="text-[#9a9386] text-sm font-normal shrink-0">{dimension.position}.</span>
          <span className="flex-1 min-w-0">
            <InlineEditableText
              value={dimension.name}
              onSave={onRename}
              className="block w-full text-left hover:underline decoration-dotted truncate"
              inputClassName="text-base font-semibold rounded border border-[#d4cec0] px-2 py-1 w-full"
              showSavingState
            />
          </span>
        </h2>
        <div className="w-8 shrink-0 flex items-center justify-end">
          {dangerMode ? (
            <DangerDeleteButton
              dangerMode
              onClick={() => void onDelete()}
              label={`Delete dimension ${dimension.name}`}
            />
          ) : (
            <button
              type="button"
              tabIndex={-1}
              draggable={draggable && !reordering}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onFocus={(event) => event.currentTarget.blur()}
              className={`inline-flex items-center justify-center rounded-md p-1.5 text-[#9a9386] ${
                draggable && !reordering ? "cursor-grab active:cursor-grabbing" : "cursor-default"
              }`}
              aria-label={`Drag dimension ${dimension.name}`}
            >
              <GripVertical size={14} />
            </button>
          )}
        </div>
      </div>

      {!compactView ? (
        <>
          <div className={`mt-4 ${reorderingCriteria ? "opacity-60 pointer-events-none" : ""}`}>
        <ul className="space-y-3">
          {sortedCriteria.map((criterion, index) => (
            <Fragment key={criterion.id}>
              <li
                className={`list-none transition-all ${
                  draggingCriterionId ? "h-6 opacity-100" : "h-0 overflow-hidden opacity-0"
                }`}
                onDragOver={(event) => {
                  if (!draggingCriterionId || reorderingCriteria) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  setCriterionDropIndex(index);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  void handleCriterionDrop(index);
                }}
              >
                <div
                  className={`h-5 rounded border-2 border-dashed ${
                    criterionDropIndex === index
                      ? "border-[#1f6feb] bg-[#e8f1ff]"
                      : "border-[#b79f76] bg-[#faf1dd]"
                  }`}
                />
              </li>

              <li className="list-none">
                <EditableCriterion
                  dimensionId={dimension.id}
                  criterion={criterion}
                  dangerMode={dangerMode}
                  draggable={sortedCriteria.length > 1}
                  reordering={reorderingCriteria}
                  isDragging={draggingCriterionId === criterion.id}
                  compactView={compactCriteria}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "move";
                    setDraggingCriterionId(criterion.id);
                    setCriterionDropIndex(index);
                  }}
                  onDragEnd={() => {
                    setDraggingCriterionId(null);
                    setCriterionDropIndex(null);
                  }}
                  onRename={(name) => onRenameCriterion(criterion.id, name)}
                  onDescription={(description) => onDescriptionCriterion(criterion.id, description)}
                  onDelete={() => void onDeleteCriterion(criterion.id)}
                  onAddItem={(name) => onAddItem(criterion.id, name)}
                  onRenameItem={(itemId, name) => onRenameItem(criterion.id, itemId, name)}
                  onDeleteItem={(itemId) => void onDeleteItem(criterion.id, itemId)}
                  onReorderItems={(sourceItemId, dropIndex) =>
                    onReorderItems(criterion.id, sourceItemId, dropIndex)
                  }
                />
              </li>
            </Fragment>
          ))}

          <li
            className={`list-none transition-all ${
              draggingCriterionId ? "h-6 opacity-100" : "h-0 overflow-hidden opacity-0"
            }`}
            onDragOver={(event) => {
              if (!draggingCriterionId || reorderingCriteria) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              setCriterionDropIndex(sortedCriteria.length);
            }}
            onDrop={(event) => {
              event.preventDefault();
              void handleCriterionDrop(sortedCriteria.length);
            }}
          >
            <div
              className={`h-5 rounded border-2 border-dashed ${
                criterionDropIndex === sortedCriteria.length
                  ? "border-[#1f6feb] bg-[#e8f1ff]"
                  : "border-[#b79f76] bg-[#faf1dd]"
              }`}
            />
          </li>
        </ul>

        {reorderingCriteria ? (
          <div className="mt-2 inline-flex items-center gap-2 text-sm text-[#4d4a42]">
            <span>Reordering criteria</span>
            <InlineSpinner />
          </div>
        ) : null}
          </div>

          <form
            className="mt-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const next = criterionDraft.trim();
              if (!next || addingCriterion) return;

              setAddingCriterionLabel(next);
              setAddingCriterion(true);
              setCriterionDraft("");

              let added = false;
              try {
                await onAddCriterion(next);
                added = true;
              } finally {
                setAddingCriterion(false);
                setAddingCriterionLabel("");
                if (added) {
                  setTimeout(() => {
                    criterionInputRef.current?.focus();
                  }, 0);
                }
              }
            }}
          >
            {addingCriterion ? (
              <div className="w-full rounded-xl border-2 border-dashed border-[#d4cec0] bg-[#fbf9f4] px-4 py-3 text-sm">
                <span className="inline-flex w-full items-center gap-2 text-[#4d4a42] opacity-70">
                  <span className="truncate">{addingCriterionLabel}</span>
                  <InlineSpinner />
                </span>
              </div>
            ) : (
              <input
                ref={criterionInputRef}
                value={criterionDraft}
                onChange={(e) => setCriterionDraft(e.target.value)}
                className="w-full rounded-xl border-2 border-dashed border-[#d4cec0] bg-[#fbf9f4] px-4 py-3 text-sm outline-none focus:border-[#1f6feb]"
                placeholder="Add criterion and press Enter"
              />
            )}
          </form>
        </>
      ) : null}
    </article>
  );
}

function EditableAuditHeader({
  audit,
  publicId,
  onRenameAuditPublicId,
  onRenameAudit,
  onRenameAuditDescription,
  onPublish,
}: {
  audit: Audit;
  publicId: string;
  onRenameAuditPublicId: (publicId: string) => void | Promise<void>;
  onRenameAudit: (name: string) => void | Promise<void>;
  onRenameAuditDescription: (description: string) => void | Promise<void>;
  onPublish: () => void | Promise<void>;
}) {
  const [publishing, setPublishing] = useState(false);
  const lastPublishedLabel = useMemo(
    () => formatDateLabel(audit.lastPublishedAt),
    [audit.lastPublishedAt]
  );

  return (
    <section className="rounded-2xl border border-[#d9d4c8] bg-white p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="mb-2 text-sm font-mono text-[#6b665b]">
            <InlineEditableText
              value={publicId}
              onSave={onRenameAuditPublicId}
              className="text-left hover:underline decoration-dotted"
              inputClassName="font-mono text-sm rounded border border-[#d4cec0] px-2 py-1 w-full"
              placeholder="Add public ID"
              showSavingState
            />
          </div>
          <InlineEditableText
            value={audit.name}
            onSave={onRenameAudit}
            className="text-2xl font-semibold text-left hover:underline decoration-dotted"
            inputClassName="text-2xl font-semibold w-full rounded border border-[#d4cec0] px-2 py-1"
            placeholder="Add audit name"
            showSavingState
            savingClassName="text-2xl font-semibold text-left"
          />
          <div className="mt-2 text-sm text-[#6b665b]">
            <InlineEditableTextarea
              value={audit.description}
              onSave={onRenameAuditDescription}
              className="text-left hover:underline decoration-dotted"
              inputClassName="w-full rounded border border-[#d4cec0] px-2 py-1 text-sm"
              placeholder="Add audit description"
              showSavingState
            />
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <p className="text-sm text-[#6b665b]">Last published {lastPublishedLabel}</p>
          <button
            type="button"
            disabled={publishing}
            onClick={async () => {
              if (publishing) return;
              setPublishing(true);
              try {
                await onPublish();
              } finally {
                setPublishing(false);
              }
            }}
            className="rounded-lg bg-[#1f6feb] px-4 py-2 text-sm font-medium text-white hover:bg-[#1b63d6]"
          >
            {publishing ? "Publishing..." : "Publish next version"}
          </button>
        </div>
      </div>
    </section>
  );
}

export function AuditEditPage() {
  const { auditId } = useParams();
  const navigate = useNavigate();
  const [workingAudit, setWorkingAudit] = useState<Audit | null>(null);
  const [auditLoading, setAuditLoading] = useState(() => {
    const id = Number(auditId);
    return Number.isFinite(id) && id > 0;
  });
  const [auditLoadError, setAuditLoadError] = useState<string | null>(null);
  const [dimensionDraft, setDimensionDraft] = useState("");
  const [addingDimension, setAddingDimension] = useState(false);
  const [addingDimensionLabel, setAddingDimensionLabel] = useState("");
  const [dangerMode, setDangerMode] = useState(false);
  const [draggingDimensionId, setDraggingDimensionId] = useState<string | null>(null);
  const [dimensionDropIndex, setDimensionDropIndex] = useState<number | null>(null);
  const [reorderingDimensions, setReorderingDimensions] = useState(false);
  const dimensionInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const id = Number(auditId);
    if (!Number.isFinite(id) || id <= 0) {
      setAuditLoading(false);
      setWorkingAudit(null);
      setAuditLoadError("Invalid audit id.");
      return;
    }

    let cancelled = false;

    const load = async () => {
      setAuditLoading(true);
      setAuditLoadError(null);
      setWorkingAudit(null);

      try {
        const response = await fetch(`/api/audits/${id}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (response.status === 401) {
          await logoutAndRedirectToLogin();
          return;
        }
        if (response.status === 404) {
          throw new Error("Audit not found.");
        }
        if (!response.ok) {
          throw new Error("Failed to load audit.");
        }

        const data = (await response.json()) as {
          audit: {
            id: number;
            name: string;
            description: string;
            version: number;
            dimensions: Array<{
              id: number;
              name: string;
              position: number;
              criteria: Array<{
                id: number;
                name: string;
                description: string;
                position: number;
                items: Array<{
                  id: number;
                  name: string;
                  position: number;
                }>;
              }>;
            }>;
          };
        };

        const mappedAudit: Audit = {
          id: String(data.audit.id),
          publicId: data.audit.publicId,
          lastPublishedAt: data.audit.lastPublishedAt,
          version: data.audit.version,
          name: data.audit.name,
          description: data.audit.description,
          owner: "",
          status: "",
          position: 1,
          dimensions: data.audit.dimensions.map((dimension) => ({
            id: String(dimension.id),
            name: dimension.name,
            position: dimension.position,
            criteria: dimension.criteria.map((criterion) => ({
              id: String(criterion.id),
              name: criterion.name,
              description: criterion.description,
              position: criterion.position,
              items: criterion.items.map((item) => ({
                id: String(item.id),
                name: item.name,
                position: item.position,
              })),
            })),
          })),
        };

        if (!cancelled) {
          setWorkingAudit(mappedAudit);
        }
      } catch (err) {
        if (!cancelled) {
          setAuditLoadError(err instanceof Error ? err.message : "Failed to load audit.");
        }
      } finally {
        if (!cancelled) {
          setAuditLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [auditId]);

  const dimensions = useMemo(
    () => sortByPosition(workingAudit?.dimensions ?? []),
    [workingAudit?.dimensions]
  );
  const compactDimensions = draggingDimensionId !== null || reorderingDimensions;

  if (auditLoading) {
    return (
      <div className="space-y-4">
        <Breadcrumbs items={[{ label: "Audit templates", to: "/audits" }, { label: "Edit Audit" }]} />
        <section className="rounded-2xl border border-[#d9d4c8] bg-white p-6 text-sm text-[#6b665b]">
          Loading audit...
        </section>
      </div>
    );
  }

  if (auditLoadError) {
    return (
      <div className="space-y-4">
        <Breadcrumbs items={[{ label: "Audit templates", to: "/audits" }, { label: "Edit Audit" }]} />
        <section className="rounded-2xl border border-[#d9d4c8] bg-white p-6 text-sm text-red-700">
          {auditLoadError}
        </section>
      </div>
    );
  }

  if (!workingAudit) {
    return (
      <div className="space-y-4">
        <Breadcrumbs items={[{ label: "Audit templates", to: "/audits" }, { label: "Edit Audit" }]} />
        <section className="rounded-2xl border border-[#d9d4c8] bg-white p-6">
          <h1 className="text-xl font-semibold">Audit not found</h1>
        </section>
      </div>
    );
  }

  const addDimension = (name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    const id = Number(auditId);
    if (!Number.isFinite(id) || id <= 0) {
      throw new Error("Invalid audit id.");
    }

    return fetch(`/api/audits/${id}/dimensions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: trimmedName }),
    }).then(async (response) => {
    if (!response.ok) {
      if (response.status === 401) {
        await logoutAndRedirectToLogin();
        return;
      }
      throw new Error("Failed to create dimension.");
    }

      const data = (await response.json()) as {
        dimension: {
          id: number;
          name: string;
          position: number;
        };
      };

      setWorkingAudit((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          dimensions: [
            ...prev.dimensions,
            {
              id: String(data.dimension.id),
              name: data.dimension.name,
              position: data.dimension.position,
              criteria: [],
            },
          ],
        };
      });
    });
  };

  const addCriterion = async (dimensionId: string, name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    const id = Number(dimensionId);
    if (!Number.isFinite(id) || id <= 0) {
      throw new Error("Invalid dimension id.");
    }

    const response = await fetch(`/api/dimensions/${id}/criteria`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: trimmedName }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        await logoutAndRedirectToLogin();
        return;
      }
      throw new Error("Failed to create criterion.");
    }

    const data = (await response.json()) as {
      criterion: {
        id: number;
        dimensionId: number;
        name: string;
        description: string;
        position: number;
      };
    };

    setWorkingAudit((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        dimensions: prev.dimensions.map((dimension) => {
          if (dimension.id !== String(data.criterion.dimensionId)) return dimension;
          return {
            ...dimension,
            criteria: [
              ...dimension.criteria,
              {
                id: String(data.criterion.id),
                name: data.criterion.name,
                description: data.criterion.description,
                position: data.criterion.position,
                items: [],
              },
            ],
          };
        }),
      };
    });
  };

  const addItem = async (dimensionId: string, criterionId: string, name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    const id = Number(criterionId);
    if (!Number.isFinite(id) || id <= 0) {
      throw new Error("Invalid criterion id.");
    }

    const response = await fetch(`/api/criteria/${id}/items`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: trimmedName }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        await logoutAndRedirectToLogin();
        return;
      }
      throw new Error("Failed to create checklist item.");
    }

    const data = (await response.json()) as {
      item: {
        id: number;
        criterionId: number;
        name: string;
        position: number;
      };
    };

    setWorkingAudit((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        dimensions: prev.dimensions.map((dimension) => {
          if (dimension.id !== dimensionId) return dimension;
          return {
            ...dimension,
            criteria: dimension.criteria.map((criterion) => {
              if (criterion.id !== String(data.item.criterionId)) return criterion;
              return {
                ...criterion,
                items: [
                  ...criterion.items,
                  {
                    id: String(data.item.id),
                    name: data.item.name,
                    position: data.item.position,
                  },
                ],
              };
            }),
          };
        }),
      };
    });
  };

  const deleteDimension = async (dimensionId: string) => {
    const id = Number(dimensionId);
    if (!Number.isFinite(id) || id <= 0) {
      throw new Error("Invalid dimension id.");
    }

    const response = await fetch(`/api/dimensions/${id}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        await logoutAndRedirectToLogin();
        return;
      }
      throw new Error("Failed to delete dimension.");
    }

    setWorkingAudit((prev) => {
      if (!prev) return prev;
      const nextDimensions = prev.dimensions
        .filter((dimension) => dimension.id !== dimensionId)
        .sort((a, b) => a.position - b.position)
        .map((dimension, index) => ({
          ...dimension,
          position: index + 1,
        }));
      return {
        ...prev,
        dimensions: nextDimensions,
      };
    });
  };

  const deleteCriterion = async (dimensionId: string, criterionId: string) => {
    const id = Number(criterionId);
    if (!Number.isFinite(id) || id <= 0) {
      throw new Error("Invalid criterion id.");
    }

    const response = await fetch(`/api/criteria/${id}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        await logoutAndRedirectToLogin();
        return;
      }
      throw new Error("Failed to delete criterion.");
    }

    setWorkingAudit((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        dimensions: prev.dimensions.map((dimension) => {
          if (dimension.id !== dimensionId) return dimension;
          const nextCriteria = dimension.criteria
            .filter((criterion) => criterion.id !== criterionId)
            .sort((a, b) => a.position - b.position)
            .map((criterion, index) => ({
              ...criterion,
              position: index + 1,
            }));
          return {
            ...dimension,
            criteria: nextCriteria,
          };
        }),
      };
    });
  };

  const deleteItem = async (dimensionId: string, criterionId: string, itemId: string) => {
    const id = Number(itemId);
    if (!Number.isFinite(id) || id <= 0) {
      throw new Error("Invalid item id.");
    }

    const response = await fetch(`/api/items/${id}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        await logoutAndRedirectToLogin();
        return;
      }
      throw new Error("Failed to delete checklist item.");
    }

    setWorkingAudit((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        dimensions: prev.dimensions.map((dimension) => {
          if (dimension.id !== dimensionId) return dimension;
          return {
            ...dimension,
            criteria: dimension.criteria.map((criterion) => {
              if (criterion.id !== criterionId) return criterion;
              const nextItems = criterion.items
                .filter((item) => item.id !== itemId)
                .sort((a, b) => a.position - b.position)
                .map((item, index) => ({
                  ...item,
                  position: index + 1,
                }));
              return {
                ...criterion,
                items: nextItems,
              };
            }),
          };
        }),
      };
    });
  };

  const updateAuditName = async (name: string) => {
    const id = Number(auditId);
    if (!Number.isFinite(id) || id <= 0) return;

    const response = await fetch(`/api/audits/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        await logoutAndRedirectToLogin();
        return;
      }
      throw new Error("Failed to update audit name.");
    }

    const data = (await response.json()) as {
          audit: {
            id: number;
            publicId: string;
            lastPublishedAt: string | null;
            name: string;
            description: string;
      };
    };

    setWorkingAudit((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        id: String(data.audit.id),
        publicId: data.audit.publicId,
        lastPublishedAt: data.audit.lastPublishedAt,
        name: data.audit.name,
        description: data.audit.description,
      };
    });
  };

  const updateAuditPublicId = async (publicId: string) => {
    const id = Number(auditId);
    if (!Number.isFinite(id) || id <= 0) return;

    const response = await fetch(`/api/audits/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ publicId }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        await logoutAndRedirectToLogin();
        return;
      }
      if (response.status === 409) {
        throw new Error("Public ID already exists.");
      }
      throw new Error("Failed to update public ID.");
    }

    const data = (await response.json()) as {
          audit: {
            id: number;
            publicId: string;
            lastPublishedAt: string | null;
            name: string;
            description: string;
      };
    };

    setWorkingAudit((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        id: String(data.audit.id),
        publicId: data.audit.publicId,
        lastPublishedAt: data.audit.lastPublishedAt,
        name: data.audit.name,
        description: data.audit.description,
      };
    });
  };

  const updateAuditDescription = async (description: string) => {
    const id = Number(auditId);
    if (!Number.isFinite(id) || id <= 0) return;

    const response = await fetch(`/api/audits/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ description }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        await logoutAndRedirectToLogin();
        return;
      }
      throw new Error("Failed to update audit description.");
    }

    const data = (await response.json()) as {
          audit: {
            id: number;
            publicId: string;
            lastPublishedAt: string | null;
            name: string;
            description: string;
      };
    };

    setWorkingAudit((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        id: String(data.audit.id),
        publicId: data.audit.publicId,
        lastPublishedAt: data.audit.lastPublishedAt,
        name: data.audit.name,
        description: data.audit.description,
      };
    });
  };

  const publishAudit = async () => {
    const id = Number(auditId);
    if (!Number.isFinite(id) || id <= 0) {
      throw new Error("Invalid audit id.");
    }

    const response = await fetch(`/api/audits/${id}/publish`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        await logoutAndRedirectToLogin();
        return;
      }
      throw new Error("Failed to publish audit.");
    }

    const data = (await response.json()) as {
      version: {
        versionNo: number;
        publishedAt: string;
      };
    };

    setWorkingAudit((prev) =>
      prev
        ? {
            ...prev,
            version: data.version.versionNo,
            lastPublishedAt: data.version.publishedAt,
          }
        : prev
    );
    navigate("/audits");
  };

  const updateDimensionName = async (dimensionId: string, name: string) => {
    const id = Number(dimensionId);
    if (!Number.isFinite(id) || id <= 0) {
      throw new Error("Invalid dimension id.");
    }

    const response = await fetch(`/api/dimensions/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        await logoutAndRedirectToLogin();
        return;
      }
      throw new Error("Failed to update dimension name.");
    }

    const data = (await response.json()) as {
      dimension: {
        id: number;
        name: string;
      };
    };

    setWorkingAudit((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        dimensions: prev.dimensions.map((dimension) =>
          dimension.id === String(data.dimension.id)
            ? { ...dimension, name: data.dimension.name }
            : dimension
        ),
      };
    });
  };

  const updateCriterionName = async (dimensionId: string, criterionId: string, name: string) => {
    const id = Number(criterionId);
    if (!Number.isFinite(id) || id <= 0) {
      throw new Error("Invalid criterion id.");
    }

    const response = await fetch(`/api/criteria/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        await logoutAndRedirectToLogin();
        return;
      }
      throw new Error("Failed to update criterion name.");
    }

    const data = (await response.json()) as {
      criterion: {
        id: number;
        name: string;
      };
    };

    setWorkingAudit((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        dimensions: prev.dimensions.map((dimension) => {
          if (dimension.id !== dimensionId) return dimension;
          return {
            ...dimension,
            criteria: dimension.criteria.map((criterion) =>
              criterion.id === String(data.criterion.id)
                ? { ...criterion, name: data.criterion.name }
                : criterion
            ),
          };
        }),
      };
    });
  };

  const updateCriterionDescription = (
    dimensionId: string,
    criterionId: string,
    description: string
  ) => {
    return fetch(`/api/criteria/${Number(criterionId)}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ description }),
    }).then(async (response) => {
      if (!response.ok) {
        if (response.status === 401) {
          await logoutAndRedirectToLogin();
          return;
        }
        throw new Error("Failed to update criterion description.");
      }

      const data = (await response.json()) as {
        criterion: {
          id: number;
          description: string;
        };
      };

      setWorkingAudit((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          dimensions: prev.dimensions.map((dimension) => {
            if (dimension.id !== dimensionId) return dimension;
            return {
              ...dimension,
              criteria: dimension.criteria.map((criterion) =>
                criterion.id === String(data.criterion.id)
                  ? { ...criterion, description: data.criterion.description }
                  : criterion
              ),
            };
          }),
        };
      });
    });
  };

  const updateItemName = async (
    dimensionId: string,
    criterionId: string,
    itemId: string,
    name: string
  ) => {
    const id = Number(itemId);
    if (!Number.isFinite(id) || id <= 0) {
      throw new Error("Invalid item id.");
    }

    const response = await fetch(`/api/items/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        await logoutAndRedirectToLogin();
        return;
      }
      throw new Error("Failed to update checklist item name.");
    }

    const data = (await response.json()) as {
      item: {
        id: number;
        name: string;
      };
    };

    setWorkingAudit((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        dimensions: prev.dimensions.map((dimension) => {
          if (dimension.id !== dimensionId) return dimension;
          return {
            ...dimension,
            criteria: dimension.criteria.map((criterion) => {
              if (criterion.id !== criterionId) return criterion;
              return {
                ...criterion,
                items: criterion.items.map((item) =>
                  item.id === String(data.item.id)
                    ? { ...item, name: data.item.name }
                    : item
                ),
              };
            }),
          };
        }),
      };
    });
  };

  const reorderItems = async (
    dimensionId: string,
    criterionId: string,
    sourceItemId: string,
    dropIndex: number
  ) => {
    if (!workingAudit) return;

    const sortedDimensions = sortByPosition(workingAudit.dimensions);
    const dimension = sortedDimensions.find((it) => it.id === dimensionId);
    if (!dimension) return;
    const criterion = dimension.criteria.find((it) => it.id === criterionId);
    if (!criterion) return;

    const sortedItems = sortByPosition(criterion.items);
    const sourceIndex = sortedItems.findIndex((item) => item.id === sourceItemId);
    if (sourceIndex < 0) return;

    const reorderedItems = [...sortedItems];
    const [movedItem] = reorderedItems.splice(sourceIndex, 1);
    if (!movedItem) return;
    const boundedDropIndex = Math.max(0, Math.min(dropIndex, sortedItems.length));
    const adjustedDropIndex = sourceIndex < boundedDropIndex ? boundedDropIndex - 1 : boundedDropIndex;
    reorderedItems.splice(adjustedDropIndex, 0, movedItem);

    const orderedItemIds = reorderedItems.map((item) => Number(item.id));
    if (orderedItemIds.some((id) => !Number.isFinite(id) || id <= 0)) {
      throw new Error("Invalid checklist item ids.");
    }

    const response = await fetch(`/api/criteria/${Number(criterionId)}/items/reorder`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ orderedItemIds }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        await logoutAndRedirectToLogin();
        return;
      }
      throw new Error("Failed to reorder checklist items.");
    }

    setWorkingAudit((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        dimensions: prev.dimensions.map((it) => {
          if (it.id !== dimensionId) return it;
          return {
            ...it,
            criteria: it.criteria.map((cr) => {
              if (cr.id !== criterionId) return cr;
              return {
                ...cr,
                items: reorderedItems.map((item, index) => ({
                  ...item,
                  position: index + 1,
                })),
              };
            }),
          };
        }),
      };
    });
  };

  const reorderCriteria = async (dimensionId: string, sourceCriterionId: string, dropIndex: number) => {
    if (!workingAudit) return;

    const dimension = workingAudit.dimensions.find((it) => it.id === dimensionId);
    if (!dimension) return;
    const sortedCriteria = sortByPosition(dimension.criteria);
    const sourceIndex = sortedCriteria.findIndex((criterion) => criterion.id === sourceCriterionId);
    if (sourceIndex < 0) return;

    const reorderedCriteria = [...sortedCriteria];
    const [movedCriterion] = reorderedCriteria.splice(sourceIndex, 1);
    if (!movedCriterion) return;
    const boundedDropIndex = Math.max(0, Math.min(dropIndex, sortedCriteria.length));
    const adjustedDropIndex = sourceIndex < boundedDropIndex ? boundedDropIndex - 1 : boundedDropIndex;
    reorderedCriteria.splice(adjustedDropIndex, 0, movedCriterion);

    const orderedCriterionIds = reorderedCriteria.map((criterion) => Number(criterion.id));
    if (orderedCriterionIds.some((id) => !Number.isFinite(id) || id <= 0)) {
      throw new Error("Invalid criterion ids.");
    }

    const response = await fetch(`/api/dimensions/${Number(dimensionId)}/criteria/reorder`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ orderedCriterionIds }),
    });
    if (!response.ok) {
      if (response.status === 401) {
        await logoutAndRedirectToLogin();
        return;
      }
      throw new Error("Failed to reorder criteria.");
    }

    setWorkingAudit((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        dimensions: prev.dimensions.map((it) => {
          if (it.id !== dimensionId) return it;
          return {
            ...it,
            criteria: reorderedCriteria.map((criterion, index) => ({
              ...criterion,
              position: index + 1,
            })),
          };
        }),
      };
    });
  };

  const reorderDimensions = async (sourceDimensionId: string, dropIndex: number) => {
    if (!workingAudit) return;

    const sortedDimensions = sortByPosition(workingAudit.dimensions);
    const sourceIndex = sortedDimensions.findIndex((dimension) => dimension.id === sourceDimensionId);
    if (sourceIndex < 0) return;

    const reorderedDimensions = [...sortedDimensions];
    const [movedDimension] = reorderedDimensions.splice(sourceIndex, 1);
    if (!movedDimension) return;
    const boundedDropIndex = Math.max(0, Math.min(dropIndex, sortedDimensions.length));
    const adjustedDropIndex = sourceIndex < boundedDropIndex ? boundedDropIndex - 1 : boundedDropIndex;
    reorderedDimensions.splice(adjustedDropIndex, 0, movedDimension);

    const orderedDimensionIds = reorderedDimensions.map((dimension) => Number(dimension.id));
    if (orderedDimensionIds.some((id) => !Number.isFinite(id) || id <= 0)) {
      throw new Error("Invalid dimension ids.");
    }

    const id = Number(auditId);
    if (!Number.isFinite(id) || id <= 0) {
      throw new Error("Invalid audit id.");
    }

    const response = await fetch(`/api/audits/${id}/dimensions/reorder`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ orderedDimensionIds }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        await logoutAndRedirectToLogin();
        return;
      }
      throw new Error("Failed to reorder dimensions.");
    }

    setWorkingAudit((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        dimensions: reorderedDimensions.map((dimension, index) => ({
          ...dimension,
          position: index + 1,
        })),
      };
    });
  };

  const handleDimensionDrop = async (targetDropIndex: number) => {
    if (!draggingDimensionId || reorderingDimensions) {
      setDimensionDropIndex(null);
      return;
    }

    const sourceDimensionId = draggingDimensionId;
    setDraggingDimensionId(null);
    setDimensionDropIndex(null);
    setReorderingDimensions(true);
    try {
      await reorderDimensions(sourceDimensionId, targetDropIndex);
    } finally {
      setReorderingDimensions(false);
    }
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Audit templates", to: "/audits" }, { label: `Audit #${workingAudit.id}` }]} />
      <div className="flex items-center justify-end gap-4">
        <button
          type="button"
          onClick={() => setDangerMode((v) => !v)}
          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
            dangerMode
              ? "border-red-300 bg-red-50 text-red-700"
              : "border-[#d4cec0] bg-white text-[#5f5a50] hover:bg-[#f6f3ec]"
          }`}
        >
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${
              dangerMode ? "bg-red-500" : "bg-[#9a9386]"
            }`}
          />
          {dangerMode ? "Danger mode ON" : "Danger mode OFF"}
        </button>
      </div>

      <EditableAuditHeader
        audit={workingAudit}
        publicId={workingAudit.publicId ?? ""}
        onRenameAuditPublicId={updateAuditPublicId}
        onRenameAudit={updateAuditName}
        onRenameAuditDescription={updateAuditDescription}
        onPublish={publishAudit}
      />

      <section className={`space-y-4 ${reorderingDimensions ? "opacity-60 pointer-events-none" : ""}`}>
        <ul className="space-y-4">
          {dimensions.map((dimension, index) => (
            <Fragment key={dimension.id}>
              <li
                className={`list-none transition-all ${
                  draggingDimensionId ? "h-7 opacity-100" : "h-0 overflow-hidden opacity-0"
                }`}
                onDragOver={(event) => {
                  if (!draggingDimensionId || reorderingDimensions) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  setDimensionDropIndex(index);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  void handleDimensionDrop(index);
                }}
              >
                <div
                  className={`h-6 rounded border-2 border-dashed ${
                    dimensionDropIndex === index
                      ? "border-[#1f6feb] bg-[#e8f1ff]"
                      : "border-[#b79f76] bg-[#faf1dd]"
                  }`}
                />
              </li>

              <li className="list-none">
                <EditableDimension
                  dimension={dimension}
                  dangerMode={dangerMode}
                  draggable={dimensions.length > 1}
                  reordering={reorderingDimensions}
                  isDragging={draggingDimensionId === dimension.id}
                  compactView={compactDimensions}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "move";
                    setDraggingDimensionId(dimension.id);
                    setDimensionDropIndex(index);
                  }}
                  onDragEnd={() => {
                    setDraggingDimensionId(null);
                    setDimensionDropIndex(null);
                  }}
                  onRename={(name) => updateDimensionName(dimension.id, name)}
                  onDelete={() => void deleteDimension(dimension.id)}
                  onAddCriterion={(name) => addCriterion(dimension.id, name)}
                  onRenameCriterion={(criterionId, name) =>
                    updateCriterionName(dimension.id, criterionId, name)
                  }
                  onDescriptionCriterion={(criterionId, description) =>
                    updateCriterionDescription(dimension.id, criterionId, description)
                  }
                  onDeleteCriterion={(criterionId) => deleteCriterion(dimension.id, criterionId)}
                  onAddItem={(criterionId, name) => addItem(dimension.id, criterionId, name)}
                  onRenameItem={(criterionId, itemId, name) =>
                    updateItemName(dimension.id, criterionId, itemId, name)
                  }
                  onDeleteItem={(criterionId, itemId) => deleteItem(dimension.id, criterionId, itemId)}
                  onReorderItems={(criterionId, sourceItemId, dropIndex) =>
                    reorderItems(dimension.id, criterionId, sourceItemId, dropIndex)
                  }
                  onReorderCriteria={(sourceCriterionId, dropIndex) =>
                    reorderCriteria(dimension.id, sourceCriterionId, dropIndex)
                  }
                />
              </li>
            </Fragment>
          ))}

          <li
            className={`list-none transition-all ${
              draggingDimensionId ? "h-7 opacity-100" : "h-0 overflow-hidden opacity-0"
            }`}
            onDragOver={(event) => {
              if (!draggingDimensionId || reorderingDimensions) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              setDimensionDropIndex(dimensions.length);
            }}
            onDrop={(event) => {
              event.preventDefault();
              void handleDimensionDrop(dimensions.length);
            }}
          >
            <div
              className={`h-6 rounded border-2 border-dashed ${
                dimensionDropIndex === dimensions.length
                  ? "border-[#1f6feb] bg-[#e8f1ff]"
                  : "border-[#b79f76] bg-[#faf1dd]"
              }`}
            />
          </li>
        </ul>

        {reorderingDimensions ? (
          <div className="mt-2 inline-flex items-center gap-2 text-sm text-[#4d4a42]">
            <span>Reordering dimensions</span>
            <InlineSpinner />
          </div>
        ) : null}

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const next = dimensionDraft.trim();
            if (!next || addingDimension) return;

            setAddingDimensionLabel(next);
            setAddingDimension(true);
            setDimensionDraft("");

            let added = false;
            try {
              await addDimension(next);
              added = true;
            } finally {
              setAddingDimension(false);
              setAddingDimensionLabel("");
              if (added) {
                setTimeout(() => {
                  dimensionInputRef.current?.focus();
                }, 0);
              }
            }
          }}
        >
          {addingDimension ? (
            <div className="w-full rounded-xl border-2 border-dashed border-[#d4cec0] bg-[#fbf9f4] px-4 py-3 text-sm">
              <span className="inline-flex w-full items-center gap-2 text-[#4d4a42] opacity-70">
                <span className="truncate">{addingDimensionLabel}</span>
                <InlineSpinner />
              </span>
            </div>
          ) : (
            <input
              ref={dimensionInputRef}
              value={dimensionDraft}
              onChange={(e) => setDimensionDraft(e.target.value)}
              className="w-full rounded-xl border-2 border-dashed border-[#d4cec0] bg-[#fbf9f4] px-4 py-3 text-sm outline-none focus:border-[#1f6feb]"
              placeholder="Add dimension and press Enter"
            />
          )}
        </form>
      </section>
    </div>
  );
}
