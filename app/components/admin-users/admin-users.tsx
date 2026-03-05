import { useState, useEffect, useRef } from "react";
import { useFetcher } from "react-router";
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

  // Watch fetcher completion to mark user as saved or show error
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

  // Watch fetcher for completion
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
        // Clear "saved" indicator after 2 seconds
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
            {organizations.map((org) => (
              <th key={org.id}>{org.name}</th>
            ))}
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
                <td>
                  <input
                    type="checkbox"
                    checked={row.isExample}
                    onChange={() => toggleExample(mission.id)}
                    style={{ cursor: "pointer", width: 16, height: 16 }}
                  />
                </td>
                {organizations.map((org) => (
                  <td key={org.id}>
                    <input
                      type="checkbox"
                      checked={row.orgIds.has(org.id)}
                      onChange={() => toggleOrg(mission.id, org.id)}
                      style={{ cursor: "pointer", width: 16, height: 16 }}
                    />
                  </td>
                ))}
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
