import { useState, useEffect, useRef } from "react";
import { useFetcher } from "react-router";
import { Trash2, Plus, Building2, ChevronDown, Check } from "lucide-react";
import type { Organization, PendingUser } from "~/services/organizations.server";
import type { Mission } from "~/services/missions.server";
import styles from "./admin-users.module.css";

interface MissionWithAccess extends Mission {
  isExample: boolean;
  allowedOrgIds: string[];
}

interface AdminUsersProps {
  users: PendingUser[];
  organizations: Organization[];
  missions: MissionWithAccess[];
  accessToken: string | null;
}

export function AdminUsers({ users, organizations, missions, accessToken }: AdminUsersProps) {
  const pendingUsers = users.filter((u) => !u.organization_id && u.role !== "admin");

  return (
    <div className={styles.section}>
      <OrganizationsManager organizations={organizations} accessToken={accessToken} />

      <hr className={styles.divider} />

      <PendingUsersSection
        pendingUsers={pendingUsers}
        organizations={organizations}
        accessToken={accessToken}
      />

      <hr className={styles.divider} />

      <MissionAccessMatrix
        missions={missions}
        organizations={organizations}
        accessToken={accessToken}
      />
    </div>
  );
}

// ─── Organizations Manager ────────────────────────────────────────────────────

function OrganizationsManager({
  organizations,
  accessToken,
}: {
  organizations: Organization[];
  accessToken: string | null;
}) {
  const fetcher = useFetcher<{ success: boolean; error?: string }>();
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const lastAction = useRef<"add" | "delete" | null>(null);

  // Clear inputs after a successful add; show error on failure
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      if (fetcher.data.success) {
        if (lastAction.current === "add") {
          setNewName("");
          setNewSlug("");
        }
      } else {
        alert(`Failed: ${fetcher.data.error}`);
      }
      lastAction.current = null;
    }
  }, [fetcher.state, fetcher.data]);

  const handleAdd = () => {
    const name = newName.trim();
    const slug = newSlug.trim() || name.toLowerCase().replace(/\s+/g, "-");
    if (!name || !accessToken) return;

    lastAction.current = "add";
    const fd = new FormData();
    fd.append("actionType", "createOrganization");
    fd.append("name", name);
    fd.append("slug", slug);
    fd.append("accessToken", accessToken);
    fetcher.submit(fd, { method: "POST", action: "/admin" });
  };

  const handleDelete = (org: Organization) => {
    if (!confirm(`Delete organization "${org.name}"? This cannot be undone.`)) return;
    if (!accessToken) return;

    lastAction.current = "delete";
    const fd = new FormData();
    fd.append("actionType", "deleteOrganization");
    fd.append("organizationId", org.id);
    fd.append("accessToken", accessToken);
    fetcher.submit(fd, { method: "POST", action: "/admin" });
  };

  const isSubmitting = fetcher.state !== "idle";

  return (
    <div>
      <h2 className={styles.sectionTitle}>
        <Building2 size={18} style={{ verticalAlign: "middle", marginRight: "var(--space-2)" }} />
        Organizations
      </h2>

      <div className={styles.orgList}>
        {organizations.map((org) => (
          <div key={org.id} className={styles.orgRow}>
            <span className={styles.orgName}>{org.name}</span>
            <span className={styles.orgSlug}>{org.slug}</span>
            <button
              className={styles.deleteOrgButton}
              onClick={() => handleDelete(org)}
              disabled={isSubmitting || !accessToken}
              title="Delete organization"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      <div className={styles.addOrgRow}>
        <input
          className={styles.orgInput}
          placeholder="Organization name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <input
          className={styles.orgInput}
          placeholder="Slug (auto-generated if empty)"
          value={newSlug}
          onChange={(e) => setNewSlug(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <button
          className={styles.addOrgButton}
          onClick={handleAdd}
          disabled={!newName.trim() || isSubmitting || !accessToken}
        >
          <Plus size={14} />
          Add
        </button>
      </div>
    </div>
  );
}

// ─── Pending Users ────────────────────────────────────────────────────────────

function PendingUsersSection({
  pendingUsers,
  organizations,
  accessToken,
}: {
  pendingUsers: PendingUser[];
  organizations: Organization[];
  accessToken: string | null;
}) {
  const [selectedOrgs, setSelectedOrgs] = useState<Record<string, string>>({});
  const [savedUsers, setSavedUsers] = useState<Set<string>>(new Set());
  const fetcher = useFetcher<{ success: boolean; error?: string }>();
  const pendingUserId = useRef<string | null>(null);

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data && pendingUserId.current) {
      if (fetcher.data.success) {
        setSavedUsers((prev) => new Set([...prev, pendingUserId.current!]));
      } else {
        alert(`Failed to assign: ${fetcher.data.error}`);
      }
      pendingUserId.current = null;
    }
  }, [fetcher.state, fetcher.data]);

  const handleAssign = (userId: string) => {
    const orgId = selectedOrgs[userId];
    if (!orgId || !accessToken) return;

    pendingUserId.current = userId;

    const formData = new FormData();
    formData.append("actionType", "assignUserOrg");
    formData.append("userId", userId);
    formData.append("organizationId", orgId);
    formData.append("accessToken", accessToken);

    fetcher.submit(formData, { method: "POST", action: "/admin" });
  };

  const visiblePending = pendingUsers.filter((u) => !savedUsers.has(u.id));

  return (
    <div>
      <h2 className={styles.sectionTitle}>
        Pending Users
        {visiblePending.length > 0 && (
          <span className={styles.pendingBadge}>{visiblePending.length}</span>
        )}
      </h2>

      {visiblePending.length === 0 ? (
        <div className={styles.emptyState}>No pending users. Everyone has been assigned an organization.</div>
      ) : (
        <div className={styles.userList}>
          {visiblePending.map((user) => {
            const isSaving = fetcher.state !== "idle" && pendingUserId.current === user.id;
            return (
              <div key={user.id} className={styles.userCard}>
                <div className={styles.userInfo}>
                  <div className={styles.userEmail}>{user.email || "(no email)"}</div>
                  <div className={styles.userMeta}>
                    {user.display_name && <span>{user.display_name} · </span>}
                    Registered {new Date(user.created_at).toLocaleDateString()}
                    <span className={styles.pendingTag} style={{ marginLeft: "var(--space-2)" }}>
                      Pending
                    </span>
                  </div>
                </div>

                <select
                  className={styles.assignSelect}
                  value={selectedOrgs[user.id] || ""}
                  onChange={(e) => setSelectedOrgs((prev) => ({ ...prev, [user.id]: e.target.value }))}
                >
                  <option value="">Select organization…</option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>

                <button
                  className={styles.assignButton}
                  onClick={() => handleAssign(user.id)}
                  disabled={!selectedOrgs[user.id] || isSaving || !accessToken}
                >
                  {isSaving ? "Saving…" : "Assign"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Org Multi-Select Popover ─────────────────────────────────────────────────

function OrgMultiSelect({
  organizations,
  selectedIds,
  onChange,
}: {
  organizations: Organization[];
  selectedIds: Set<string>;
  onChange: (orgId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const selectedCount = selectedIds.size;
  const label =
    selectedCount === 0
      ? "None"
      : selectedCount === organizations.length
        ? "All"
        : organizations
            .filter((o) => selectedIds.has(o.id))
            .map((o) => o.name)
            .join(", ");

  return (
    <div className={styles.multiSelectWrapper} ref={ref}>
      <button
        className={styles.multiSelectTrigger}
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        <span className={styles.multiSelectLabel}>{label}</span>
        <ChevronDown size={14} className={open ? styles.chevronOpen : undefined} />
      </button>

      {open && (
        <div className={styles.multiSelectDropdown}>
          {organizations.map((org) => (
            <label key={org.id} className={styles.multiSelectOption}>
              <span className={styles.multiSelectCheckbox}>
                {selectedIds.has(org.id) && <Check size={11} />}
              </span>
              <input
                type="checkbox"
                checked={selectedIds.has(org.id)}
                onChange={() => onChange(org.id)}
                style={{ display: "none" }}
              />
              {org.name}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Mission Access Matrix ────────────────────────────────────────────────────

function MissionAccessMatrix({
  missions,
  organizations,
  accessToken,
}: {
  missions: MissionWithAccess[];
  organizations: Organization[];
  accessToken: string | null;
}) {
  const [changes, setChanges] = useState<
    Record<string, { isExample: boolean; orgIds: Set<string> }>
  >(() => {
    const init: Record<string, { isExample: boolean; orgIds: Set<string> }> = {};
    for (const m of missions) {
      init[m.id] = {
        isExample: m.isExample,
        orgIds: new Set(m.allowedOrgIds),
      };
    }
    return init;
  });

  const fetcher = useFetcher<{ success: boolean; error?: string }>();
  const savingMissionId = useRef<string | null>(null);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (fetcher.state === "idle" && savingMissionId.current) {
      const missionId = savingMissionId.current;
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(missionId);
        return next;
      });
      if (fetcher.data?.success) {
        setSavedIds((prev) => new Set([...prev, missionId]));
        setTimeout(() => {
          setSavedIds((prev) => {
            const next = new Set(prev);
            next.delete(missionId);
            return next;
          });
        }, 2000);
      } else if (fetcher.data && !fetcher.data.success) {
        alert(`Failed to save: ${fetcher.data.error}`);
      }
      savingMissionId.current = null;
    }
  }, [fetcher.state, fetcher.data]);

  const toggleOrg = (missionId: string, orgId: string) => {
    setChanges((prev) => {
      const current = prev[missionId];
      const next = new Set(current.orgIds);
      if (next.has(orgId)) next.delete(orgId);
      else next.add(orgId);
      return { ...prev, [missionId]: { ...current, orgIds: next } };
    });
  };

  const toggleExample = (missionId: string) => {
    setChanges((prev) => {
      const current = prev[missionId];
      return { ...prev, [missionId]: { ...current, isExample: !current.isExample } };
    });
  };

  const saveRow = (missionId: string) => {
    if (!accessToken || savingIds.has(missionId)) return;
    const row = changes[missionId];

    savingMissionId.current = missionId;
    setSavingIds((prev) => new Set([...prev, missionId]));

    const formData = new FormData();
    formData.append("actionType", "setMissionAccess");
    formData.append("missionId", missionId);
    formData.append("isExample", String(row.isExample));
    formData.append("organizationIds", JSON.stringify([...row.orgIds]));
    formData.append("accessToken", accessToken);

    fetcher.submit(formData, { method: "POST", action: "/admin" });
  };

  const visibleMissions = missions.filter((m) => m.status !== "Hide");

  return (
    <div>
      <h2 className={styles.sectionTitle}>Mission Access</h2>
      <p style={{ marginBottom: "var(--space-4)", fontSize: "0.875rem", color: "var(--color-neutral-10)" }}>
        Configure which organizations can see each mission. Example missions are visible to everyone
        (including non-logged-in users).
      </p>

      <table className={styles.matrixTable}>
        <thead>
          <tr>
            <th>Mission</th>
            <th>Example (Public)</th>
            <th>Organizations</th>
            <th>Save</th>
          </tr>
        </thead>
        <tbody>
          {visibleMissions.map((mission) => {
            const row = changes[mission.id] ?? { isExample: false, orgIds: new Set() };
            const isSaving = savingIds.has(mission.id);
            const isSaved = savedIds.has(mission.id);
            return (
              <tr key={mission.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{mission.title}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--color-neutral-10)" }}>
                    ID: {mission.id}
                  </div>
                </td>
                <td style={{ textAlign: "center" }}>
                  <input
                    type="checkbox"
                    checked={row.isExample}
                    onChange={() => toggleExample(mission.id)}
                    style={{ cursor: "pointer", width: 16, height: 16 }}
                  />
                </td>
                <td>
                  <OrgMultiSelect
                    organizations={organizations}
                    selectedIds={row.orgIds}
                    onChange={(orgId) => toggleOrg(mission.id, orgId)}
                  />
                </td>
                <td>
                  <button
                    className={styles.saveRowButton}
                    onClick={() => saveRow(mission.id)}
                    disabled={isSaving || !accessToken}
                  >
                    {isSaving ? "…" : isSaved ? "✓ Saved" : "Save"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
