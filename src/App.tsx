import "./index.css";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ClipboardList,
  ChevronDown,
  ExternalLink,
  Fingerprint,
  FileChartColumnIncreasing,
  Hash,
  HatGlasses,
  LogOut,
  Search,
  Shield,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { logoutAndRedirectToLogin } from "./auth-guard";
import logoSmall from "./assets/logo_small.png";
import { WORKSPACE_CONTEXT_EVENT, WORKSPACE_CONTEXT_KEY, withWorkspaceQuery } from "./workspace-context";
import { AssessmentsPage } from "./pages/AssessmentsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { Dashboard2Page } from "./pages/Dashboard2Page";
import { AuditsPage } from "./pages/AuditsPage";
import { AuditReportPage } from "./pages/AuditReportPage";
import { AuditEditPage } from "./pages/AuditEditPage";
import { AuditImportPage } from "./pages/AuditImportPage";
import { AuditDeletePage } from "./pages/AuditDeletePage";
import { LoginPage } from "./pages/LoginPage";
import { SharedAuditReportPage } from "./pages/SharedAuditReportPage";
import { EntitiesPage } from "./pages/EntitiesPage";
import { EntitiesImportPage } from "./pages/EntitiesImportPage";
import { EntityEditPage } from "./pages/EntityEditPage";
import { SettingsPage } from "./pages/SettingsPage";
import { WorkspaceEditPage } from "./pages/WorkspaceEditPage";
import { NoWorkspaceAccessPage } from "./pages/NoWorkspaceAccessPage";
import { getEntityTypeBadgeClass } from "./entity-type-color";

type SearchResultAudit = {
  id: number;
  publicId: string;
  name: string;
};

type SearchResultAssessment = {
  id: number;
  auditId: number;
  auditPublicId: string;
  auditName: string;
  entityType: string;
  entityName: string;
  status: "draft" | "submitted";
  reportShareHash: string | null;
};

type SearchResultEntity = {
  id: number;
  type: string;
  name: string;
};

type SearchResponse = {
  audits: SearchResultAudit[];
  assessments: SearchResultAssessment[];
  entities: SearchResultEntity[];
};

type SearchEntry =
  | { key: string; section: "audits"; audit: SearchResultAudit }
  | { key: string; section: "assessments"; assessment: SearchResultAssessment }
  | { key: string; section: "entities"; entity: SearchResultEntity };

type WorkspaceContextRow = {
  id: number;
  name: string;
};

type AppRole = "admin" | "audit_manager" | "user";

function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isNoWorkspaceAccessPage = location.pathname === "/no-workspace-access";
  const isMinimalLayoutPage = location.pathname === "/login" || location.pathname.startsWith("/share/");
  const [userRole, setUserRole] = useState<AppRole>("user");
  const [userRoleLoading, setUserRoleLoading] = useState(true);
  const [workspaceOptions, setWorkspaceOptions] = useState<WorkspaceContextRow[]>([]);
  const [workspaceOptionsLoading, setWorkspaceOptionsLoading] = useState(true);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(WORKSPACE_CONTEXT_KEY);
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  });
  const searchRef = useRef<HTMLDivElement | null>(null);
  const workspaceDesktopPickerRef = useRef<HTMLDivElement | null>(null);
  const workspaceMobilePickerRef = useRef<HTMLDivElement | null>(null);
  const [workspacePickerOpen, setWorkspacePickerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchActiveIndex, setSearchActiveIndex] = useState(-1);
  const [searchResults, setSearchResults] = useState<SearchResponse>({
    audits: [],
    assessments: [],
    entities: [],
  });
  const [searchError, setSearchError] = useState<string | null>(null);

  const hasSearchResults = useMemo(
    () =>
      searchResults.audits.length > 0 ||
      searchResults.assessments.length > 0 ||
      searchResults.entities.length > 0,
    [searchResults]
  );

  const searchEntries = useMemo<SearchEntry[]>(() => {
    const audits = searchResults.audits.map((audit) => ({
      key: `audit-${audit.id}`,
      section: "audits" as const,
      audit,
    }));
    const assessments = searchResults.assessments.map((assessment) => ({
      key: `assessment-${assessment.id}`,
      section: "assessments" as const,
      assessment,
    }));
    const entities = searchResults.entities.map((entity) => ({
      key: `entity-${entity.id}`,
      section: "entities" as const,
      entity,
    }));
    return [...audits, ...assessments, ...entities];
  }, [searchResults]);
  const activeWorkspaceName = useMemo(() => {
    if (!activeWorkspaceId) return "Select workspace";
    return (
      workspaceOptions.find((workspace) => workspace.id === activeWorkspaceId)?.name ??
      "Select workspace"
    );
  }, [activeWorkspaceId, workspaceOptions]);

  const mobileNavClass = ({ isActive }: { isActive: boolean }) =>
    `inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
      isActive
        ? "bg-[#4e3626] text-[#fffdf9]"
        : "text-[#3f3a30] hover:bg-[#ede9df] hover:text-[#1f1f1f]"
    }`;
  const sidebarNavClass = ({ isActive }: { isActive: boolean }) =>
    `inline-flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
      isActive
        ? "bg-[#4e3626] text-[#fffdf9]"
        : "text-[#3f3a30] hover:bg-[#ede9df] hover:text-[#1f1f1f]"
    }`;

  const isAdminUser = userRole === "admin";
  const canManageGlobalResources = userRole === "admin" || userRole === "audit_manager";
  const searchHidden = true;

  useEffect(() => {
    if (isMinimalLayoutPage) return;

    let cancelled = false;
    setUserRoleLoading(true);
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
          setUserRole(role);
          return;
        }
        setUserRole("user");
      })
      .catch(() => {
        if (cancelled) return;
        setUserRole("user");
      })
      .finally(() => {
        if (cancelled) return;
        setUserRoleLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isMinimalLayoutPage]);

  useEffect(() => {
    if (isMinimalLayoutPage) return;

    let cancelled = false;
    setWorkspaceOptionsLoading(true);
    void fetch("/api/workspaces?scope=member", {
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
        return (await response.json()) as { workspaces?: Array<{ id: number; name: string }> };
      })
      .then((payload) => {
        if (cancelled || !payload) return;
        const nextOptions = (payload.workspaces ?? []).map((workspace) => ({
          id: workspace.id,
          name: workspace.name,
        }));
        setWorkspaceOptions(nextOptions);
        setActiveWorkspaceId((current) => {
          if (current && nextOptions.some((workspace) => workspace.id === current)) {
            return current;
          }
          return nextOptions.at(0)?.id ?? null;
        });
      })
      .catch(() => {
        if (cancelled) return;
        setWorkspaceOptions([]);
      })
      .finally(() => {
        if (cancelled) return;
        setWorkspaceOptionsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isMinimalLayoutPage]);

  useEffect(() => {
    if (isMinimalLayoutPage || userRoleLoading) return;

    const path = location.pathname;
    if (path.startsWith("/settings") && !isAdminUser) {
      navigate("/assessments", { replace: true });
      return;
    }
    if ((path.startsWith("/audits") || path.startsWith("/entities")) && !canManageGlobalResources) {
      navigate("/assessments", { replace: true });
    }
  }, [
    location.pathname,
    isMinimalLayoutPage,
    userRoleLoading,
    isAdminUser,
    canManageGlobalResources,
    navigate,
  ]);

  useEffect(() => {
    if (isMinimalLayoutPage || userRoleLoading || workspaceOptionsLoading) return;

    if (userRole !== "user") {
      if (isNoWorkspaceAccessPage) {
        navigate("/", { replace: true });
      }
      return;
    }

    const hasWorkspaceAccess = workspaceOptions.length > 0;
    if (!hasWorkspaceAccess && !isNoWorkspaceAccessPage) {
      navigate("/no-workspace-access", { replace: true });
      return;
    }
    if (hasWorkspaceAccess && isNoWorkspaceAccessPage) {
      navigate("/", { replace: true });
    }
  }, [
    isMinimalLayoutPage,
    isNoWorkspaceAccessPage,
    navigate,
    userRole,
    userRoleLoading,
    workspaceOptions.length,
    workspaceOptionsLoading,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!activeWorkspaceId) {
      window.localStorage.removeItem(WORKSPACE_CONTEXT_KEY);
      return;
    }
    window.localStorage.setItem(WORKSPACE_CONTEXT_KEY, String(activeWorkspaceId));
    window.dispatchEvent(
      new CustomEvent(WORKSPACE_CONTEXT_EVENT, {
        detail: { workspaceId: activeWorkspaceId },
      })
    );
  }, [activeWorkspaceId]);

  useEffect(() => {
    if (isMinimalLayoutPage) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (!(event.target instanceof Node)) return;

      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setSearchOpen(false);
        setSearchActiveIndex(-1);
      }
      const isInsideDesktopPicker = Boolean(
        workspaceDesktopPickerRef.current?.contains(event.target)
      );
      const isInsideMobilePicker = Boolean(
        workspaceMobilePickerRef.current?.contains(event.target)
      );
      if (!isInsideDesktopPicker && !isInsideMobilePicker) {
        setWorkspacePickerOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMinimalLayoutPage]);

  useEffect(() => {
    if (isMinimalLayoutPage) return;

    const query = searchQuery.trim();
    if (query.length < 2) {
      setSearchLoading(false);
      setSearchError(null);
      setSearchResults({ audits: [], assessments: [], entities: [] });
      setSearchActiveIndex(-1);
      return;
    }
    if (!activeWorkspaceId) {
      setSearchLoading(false);
      setSearchResults({ audits: [], assessments: [], entities: [] });
      setSearchActiveIndex(-1);
      setSearchError("Select a workspace to search.");
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      setSearchLoading(true);
      setSearchError(null);

      const endpoint = withWorkspaceQuery(
        `/api/search?q=${encodeURIComponent(query)}`,
        activeWorkspaceId
      );
      void fetch(endpoint, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      })
        .then(async (response) => {
          if (response.status === 401) {
            await logoutAndRedirectToLogin();
            return null;
          }
          if (!response.ok) {
            const payload = (await response.json().catch(() => ({}))) as { error?: string };
            throw new Error(payload.error ?? "Search failed.");
          }
          return (await response.json()) as SearchResponse;
        })
        .then((payload) => {
          if (cancelled || !payload) return;
          setSearchResults({
            audits: payload.audits ?? [],
            assessments: payload.assessments ?? [],
            entities: payload.entities ?? [],
          });
          setSearchOpen(true);
          setSearchActiveIndex(0);
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          setSearchResults({ audits: [], assessments: [], entities: [] });
          setSearchError(error instanceof Error ? error.message : "Search failed.");
          setSearchActiveIndex(-1);
        })
        .finally(() => {
          if (cancelled) return;
          setSearchLoading(false);
        });
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [isMinimalLayoutPage, searchQuery, activeWorkspaceId]);

  useEffect(() => {
    if (!searchOpen || searchEntries.length === 0) {
      setSearchActiveIndex(-1);
      return;
    }

    if (searchActiveIndex < 0 || searchActiveIndex >= searchEntries.length) {
      setSearchActiveIndex(0);
    }
  }, [searchOpen, searchEntries, searchActiveIndex]);

  const openAssessmentResult = (assessment: SearchResultAssessment) => {
    setSearchOpen(false);
    setSearchActiveIndex(-1);
    if (assessment.status === "submitted" && assessment.reportShareHash) {
      window.open(
        `/share/${assessment.auditPublicId}/${assessment.reportShareHash}`,
        "_blank",
        "noopener,noreferrer"
      );
      return;
    }
    navigate(`/assessments/${assessment.auditId}/${assessment.id}`);
  };

  const openSearchEntry = (entry: SearchEntry) => {
    if (entry.section === "audits") {
      setSearchOpen(false);
      setSearchActiveIndex(-1);
      navigate(`/audits/${entry.audit.id}/edit`);
      return;
    }

    if (entry.section === "assessments") {
      openAssessmentResult(entry.assessment);
      return;
    }

    setSearchOpen(false);
    setSearchActiveIndex(-1);
    navigate(`/entities/${entry.entity.id}/edit`);
  };

  const selectWorkspace = (workspaceId: number) => {
    setActiveWorkspaceId(workspaceId);
    setWorkspacePickerOpen(false);
  };

  if (isMinimalLayoutPage) {
    return <div className="min-h-screen bg-[#f4f1ea] text-[#1f1f1f]">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-[#f4f1ea] text-[#1f1f1f] md:flex">
      <aside className="hidden md:flex md:w-72 md:flex-col md:border-r md:border-[#d9d4c8] md:bg-[#fbf9f4]">
        <div className="border-b border-[#e3ddd0] px-4 py-4">
          <Link to="/" className="inline-flex items-center gap-2">
            <img src={logoSmall} alt="Auditor Console logo" className="h-10 w-10 rounded-md object-cover" />
            <span className="font-semibold tracking-wide">Auditor Console</span>
          </Link>
          <div ref={workspaceDesktopPickerRef} className="relative mt-4">
            {workspaceOptions.length > 0 ? (
              <>
                <button
                  type="button"
                  onClick={() => setWorkspacePickerOpen((open) => !open)}
                  className="inline-flex w-full items-center justify-between gap-2 rounded-lg border border-[#e2dccf] bg-[#f6f2e9] px-2.5 py-2 text-xs text-[#4a453b] transition-colors hover:bg-[#f1ecdf]"
                  aria-label="Workspace context"
                >
                  <span className="inline-flex min-w-0 items-center gap-2">
                    <span className="font-medium">#</span>
                    <span className="truncate">{activeWorkspaceName}</span>
                  </span>
                  <ChevronDown size={13} />
                </button>
                {workspacePickerOpen ? (
                  <div className="absolute left-0 right-0 z-40 mt-2 max-h-64 overflow-auto rounded-lg border border-[#ddd7ca] bg-[#fbf8f2] p-1 shadow-sm">
                    {workspaceOptions.map((workspace) => (
                      <button
                        type="button"
                        key={workspace.id}
                        onClick={() => selectWorkspace(workspace.id)}
                        className={`block w-full rounded-md px-2 py-1.5 text-left text-xs ${
                          workspace.id === activeWorkspaceId
                            ? "bg-[#ece6d9] text-[#2e2a24]"
                            : "text-[#4a453b] hover:bg-[#f2ede2]"
                        }`}
                      >
                        {workspace.name}
                      </button>
                    ))}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="inline-flex w-full items-center justify-between gap-2 rounded-lg border border-[#e2dccf] bg-[#f6f2e9] px-2.5 py-2 text-xs text-[#8a8478] opacity-90">
                <span className="inline-flex min-w-0 items-center gap-2">
                  <span className="font-medium">#</span>
                  <span className="truncate">No workspace</span>
                </span>
                <ChevronDown size={13} />
              </div>
            )}
          </div>
        </div>
        <nav className="flex-1 p-3">
          {activeWorkspaceId ? (
            <>
              <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8c8577]">
                Operations
              </p>
              <div className="space-y-2">
                <NavLink to="/assessments" className={sidebarNavClass}>
                  <Shield size={14} />
                  Assessments
                </NavLink>
              </div>
              <div className="my-4 border-t border-[#e3ddd0]" />
            </>
          ) : null}

          {canManageGlobalResources || isAdminUser ? (
            <>
              <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8c8577]">
                Administration
              </p>
              <div className="space-y-2">
                {canManageGlobalResources ? (
                  <NavLink to="/entities" className={sidebarNavClass}>
                    <Fingerprint size={14} />
                    Entities
                  </NavLink>
                ) : null}
                {canManageGlobalResources ? (
                  <NavLink to="/audits" className={sidebarNavClass}>
                    <ClipboardList size={14} />
                    Audit templates
                  </NavLink>
                ) : null}
                {isAdminUser ? (
                  <NavLink to="/settings/users" className={sidebarNavClass} aria-label="Users">
                    <Users size={14} />
                    Users
                  </NavLink>
                ) : null}
                {isAdminUser ? (
                  <NavLink
                    to="/settings/workspaces"
                    className={sidebarNavClass}
                    aria-label="Workspaces"
                  >
                    <Hash size={14} />
                    Workspaces
                  </NavLink>
                ) : null}
              </div>
            </>
          ) : null}
        </nav>
        <div className="border-t border-[#e3ddd0] p-3">
          <button
            type="button"
            onClick={() => void logoutAndRedirectToLogin()}
            className="inline-flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#7a3f32] transition-colors hover:bg-[#f4e7e3]"
          >
            <LogOut size={14} />
            Log out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-[#d9d4c8] bg-[#fbf9f4] px-4 py-3 md:hidden">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link to="/" className="inline-flex items-center gap-2">
              <ShieldCheck size={20} className="text-[#1f6feb]" />
              <span className="font-semibold tracking-wide">Auditor Console</span>
            </Link>
            <div ref={workspaceMobilePickerRef} className="relative min-w-[180px]">
              {workspaceOptions.length > 0 ? (
                <>
                  <button
                    type="button"
                    onClick={() => setWorkspacePickerOpen((open) => !open)}
                    className="inline-flex w-full items-center justify-between gap-2 rounded-lg border border-[#e2dccf] bg-[#f6f2e9] px-2 py-1 text-xs text-[#4a453b] transition-colors hover:bg-[#f1ecdf]"
                    aria-label="Workspace context"
                  >
                    <span className="inline-flex min-w-0 items-center gap-2">
                      <span className="font-medium">#</span>
                      <span className="truncate">{activeWorkspaceName}</span>
                    </span>
                    <ChevronDown size={13} />
                  </button>
                  {workspacePickerOpen ? (
                    <div className="absolute left-0 right-0 z-40 mt-2 max-h-64 overflow-auto rounded-lg border border-[#ddd7ca] bg-[#fbf8f2] p-1 shadow-sm">
                      {workspaceOptions.map((workspace) => (
                        <button
                          type="button"
                          key={workspace.id}
                          onClick={() => selectWorkspace(workspace.id)}
                          className={`block w-full rounded-md px-2 py-1.5 text-left text-xs ${
                            workspace.id === activeWorkspaceId
                              ? "bg-[#ece6d9] text-[#2e2a24]"
                              : "text-[#4a453b] hover:bg-[#f2ede2]"
                          }`}
                        >
                          {workspace.name}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="inline-flex w-full items-center justify-between gap-2 rounded-lg border border-[#e2dccf] bg-[#f6f2e9] px-2 py-1 text-xs text-[#8a8478] opacity-90">
                  <span className="inline-flex min-w-0 items-center gap-2">
                    <span className="font-medium">#</span>
                    <span className="truncate">No workspace</span>
                  </span>
                  <ChevronDown size={13} />
                </div>
              )}
            </div>
          </div>
          <nav className="mt-3 flex flex-wrap items-center gap-2">
            {activeWorkspaceId ? (
              <NavLink to="/assessments" className={mobileNavClass}>
                <Shield size={14} />
                Assessments
              </NavLink>
            ) : null}
            {canManageGlobalResources ? (
              <NavLink to="/entities" className={mobileNavClass}>
                <Fingerprint size={14} />
                Entities
              </NavLink>
            ) : null}
            {canManageGlobalResources ? (
              <NavLink to="/audits" className={mobileNavClass}>
                <ClipboardList size={14} />
                Audit templates
              </NavLink>
            ) : null}
            {isAdminUser ? (
              <NavLink to="/settings/users" className={mobileNavClass} aria-label="Users">
                <Users size={14} />
                Users
              </NavLink>
            ) : null}
            {isAdminUser ? (
              <NavLink
                to="/settings/workspaces"
                className={mobileNavClass}
                aria-label="Workspaces"
              >
                <Hash size={14} />
                Workspaces
              </NavLink>
            ) : null}
          </nav>
        </header>

        <main className="w-full p-4 md:p-6">
          {!searchHidden ? (
            <div
              ref={searchRef}
              className="relative mb-4 hidden md:block md:mx-auto md:w-full md:max-w-3xl"
            >
              <div className="flex items-center gap-2 rounded-xl border border-[#d9d4c8] bg-white px-3 py-2">
                <Search size={14} className="text-[#7a7468]" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onFocus={() => {
                    if (searchQuery.trim().length >= 2) {
                      setSearchOpen(true);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (searchQuery.trim().length < 2) return;

                    if (event.key === "Escape") {
                      event.preventDefault();
                      setSearchOpen(false);
                      setSearchActiveIndex(-1);
                      return;
                    }

                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      if (!searchOpen) {
                        setSearchOpen(true);
                        setSearchActiveIndex(searchEntries.length > 0 ? 0 : -1);
                        return;
                      }
                      setSearchActiveIndex((current) => {
                        if (searchEntries.length === 0) return -1;
                        if (current < 0) return 0;
                        return Math.min(searchEntries.length - 1, current + 1);
                      });
                      return;
                    }

                    if (event.key === "ArrowUp") {
                      event.preventDefault();
                      if (!searchOpen) {
                        setSearchOpen(true);
                        setSearchActiveIndex(searchEntries.length > 0 ? 0 : -1);
                        return;
                      }
                      setSearchActiveIndex((current) => {
                        if (searchEntries.length === 0) return -1;
                        if (current < 0) return 0;
                        return Math.max(0, current - 1);
                      });
                      return;
                    }

                    if (event.key === "Enter") {
                      if (!searchOpen || searchEntries.length === 0) return;
                      event.preventDefault();
                      const entry =
                        searchEntries[searchActiveIndex] ??
                        searchEntries[0];
                      if (entry) {
                        openSearchEntry(entry);
                      }
                    }
                  }}
                  className="bg-transparent outline-none text-sm w-full placeholder:text-[#9f998c]"
                  placeholder="Search audit or assessment"
                />
              </div>

              {searchOpen && searchQuery.trim().length >= 2 ? (
                <div className="absolute left-0 right-0 z-50 mt-2 rounded-xl border border-[#d9d4c8] bg-white shadow-lg">
                {searchLoading ? (
                  <p className="px-3 py-3 text-sm text-[#7a7468]">Searching...</p>
                ) : null}
                {searchError ? (
                  <p className="px-3 py-3 text-sm text-[#8a5648]">{searchError}</p>
                ) : null}

                {!searchLoading && !searchError && !hasSearchResults ? (
                  <p className="px-3 py-3 text-sm text-[#7a7468]">No results.</p>
                ) : null}

                {!searchLoading && !searchError && hasSearchResults ? (
                  <div className="max-h-[420px] overflow-auto py-2">
                    {searchResults.audits.length > 0 ? (
                      <div>
                        <p className="px-3 pb-1 text-xs uppercase tracking-[0.14em] text-[#8a8478]">
                          Audit templates
                        </p>
                        {searchResults.audits.map((audit) => (
                          <button
                            key={`audit-${audit.id}`}
                            type="button"
                            onClick={() => {
                              openSearchEntry({
                                key: `audit-${audit.id}`,
                                section: "audits",
                                audit,
                              });
                            }}
                            className={`flex w-full items-center justify-between px-3 py-2 text-left hover:bg-[#f8f5ef] ${
                              searchEntries[searchActiveIndex]?.key === `audit-${audit.id}`
                                ? "bg-[#f0ece3]"
                                : ""
                            }`}
                          >
                            <span className="inline-flex items-center gap-2 text-sm">
                              <ClipboardList size={14} className="text-[#5a3d2d]" />
                              {audit.publicId} - {audit.name}
                            </span>
                            <span className="inline-flex items-center gap-1 text-xs text-[#7a7468]">
                              Edit
                              <ExternalLink size={12} />
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : null}

                    {searchResults.assessments.length > 0 ? (
                      <div className="mt-2">
                        <p className="px-3 pb-1 text-xs uppercase tracking-[0.14em] text-[#8a8478]">
                          Assessments
                        </p>
                        {searchResults.assessments.map((assessment) => {
                          const isSubmitted =
                            assessment.status === "submitted" && Boolean(assessment.reportShareHash);
                          return (
                            <button
                              key={`assessment-${assessment.id}`}
                              type="button"
                              onClick={() =>
                                openSearchEntry({
                                  key: `assessment-${assessment.id}`,
                                  section: "assessments",
                                  assessment,
                                })
                              }
                              className={`flex w-full items-center justify-between px-3 py-2 text-left hover:bg-[#f8f5ef] ${
                                searchEntries[searchActiveIndex]?.key ===
                                `assessment-${assessment.id}`
                                  ? "bg-[#f0ece3]"
                                  : ""
                              }`}
                            >
                              <span className="inline-flex items-center gap-2 text-sm">
                                {isSubmitted ? (
                                  <FileChartColumnIncreasing size={14} className="text-[#1e6a3b]" />
                                ) : (
                                  <HatGlasses size={14} className="text-[#1f4ea8]" />
                                )}
                                #{assessment.id} {assessment.auditName} - {assessment.entityType}/
                                {assessment.entityName}
                              </span>
                              <span
                                className={`inline-flex items-center gap-1 text-xs ${
                                  isSubmitted ? "text-[#1e6a3b]" : "text-[#1f4ea8]"
                                }`}
                              >
                                {isSubmitted ? "Report (new tab)" : "Assess"}
                                <ExternalLink size={12} />
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ) : null}

                    {searchResults.entities.length > 0 ? (
                      <div className="mt-2">
                        <p className="px-3 pb-1 text-xs uppercase tracking-[0.14em] text-[#8a8478]">
                          Entities
                        </p>
                        {searchResults.entities.map((entity) => (
                          <button
                            key={`entity-${entity.id}`}
                            type="button"
                            onClick={() => {
                              openSearchEntry({
                                key: `entity-${entity.id}`,
                                section: "entities",
                                entity,
                              });
                            }}
                            className={`flex w-full items-center justify-between px-3 py-2 text-left hover:bg-[#f8f5ef] ${
                              searchEntries[searchActiveIndex]?.key ===
                              `entity-${entity.id}`
                                ? "bg-[#f0ece3]"
                                : ""
                            }`}
                            >
                              <span className="inline-flex items-center gap-2 text-sm">
                                <Fingerprint size={14} className="text-[#5a3d2d]" />
                                <span className={getEntityTypeBadgeClass(entity.type)}>
                                  {entity.type}
                                </span>
                                <span>{entity.name}</span>
                              </span>
                              <span className="inline-flex items-center gap-1 text-xs text-[#7a7468]">
                                Edit
                              <ExternalLink size={12} />
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
          {children}
        </main>
      </div>
    </div>
  );
}

export function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/no-workspace-access" element={<NoWorkspaceAccessPage />} />
        <Route path="/" element={<DashboardPage />} />
        <Route path="/dashboard2" element={<Dashboard2Page />} />
        <Route path="/audits" element={<AuditsPage />} />
        <Route path="/audits/import" element={<AuditImportPage />} />
        <Route path="/audits/:auditId/edit" element={<AuditEditPage />} />
        <Route path="/audits/:auditId/delete" element={<AuditDeletePage />} />
        <Route path="/assessments" element={<AssessmentsPage />} />
        <Route path="/entities" element={<EntitiesPage />} />
        <Route path="/entities/import" element={<EntitiesImportPage />} />
        <Route path="/entities/:entityId/edit" element={<EntityEditPage />} />
        <Route path="/settings" element={<Navigate to="/settings/users" replace />} />
        <Route path="/settings/:tab" element={<SettingsPage />} />
        <Route path="/settings/workspaces/:workspaceId/edit" element={<WorkspaceEditPage />} />
        <Route path="/assessments/:audit_id/:id" element={<AuditReportPage />} />
        <Route path="/share/:auditPublicId/:reportShareHash" element={<SharedAuditReportPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}

export default App;
