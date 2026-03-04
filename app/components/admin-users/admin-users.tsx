import { useState } from "react";
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
  const allUsers = users.filter((u) => u.role !== "admin" || u.organization_id);

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
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [savedUsers, setSavedUsers] = useState<Set<string>>(new Set());

  const handleAssign = async (userId: string) => {
    const orgId = selectedOrgs[userId];
    if (!orgId || !accessToken) return;

    setSaving((prev) => new Set([...prev, userId]));

    const formData = new FormData();
    formData.append("actionType", "assignUserOrg");
    formData.append("userId", userId);
    formData.append("organizationId", orgId);
    formData.append("accessToken", accessToken);

    const response = await fetch("/admin", { method: "POST", body: formData });
    const result = await response.json();

    setSaving((prev) => {
      const next = new Set(prev);
      next.delete(userId);
      return next;
    });

    if (result.success) {
      setSavedUsers((prev) => new Set([...prev, userId]));
    } else {
      alert(`Failed to assign: ${result.error}`);
    }
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
          {visiblePending.map((user) => (
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
                disabled={!selectedOrgs[user.id] || saving.has(user.id) || !accessToken}
              >
                {saving.has(user.id) ? "Saving…" : "Assign"}
              </button>
            </div>
          ))}
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
  // Local state: track pending changes per mission
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

  const [saving, setSaving] = useState<Set<string>>(new Set());

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

  const saveRow = async (missionId: string) => {
    if (!accessToken) return;
    const row = changes[missionId];
    setSaving((prev) => new Set([...prev, missionId]));

    const formData = new FormData();
    formData.append("actionType", "setMissionAccess");
    formData.append("missionId", missionId);
    formData.append("isExample", String(row.isExample));
    formData.append("organizationIds", JSON.stringify([...row.orgIds]));
    formData.append("accessToken", accessToken);

    const response = await fetch("/admin", { method: "POST", body: formData });
    const result = await response.json();

    setSaving((prev) => {
      const next = new Set(prev);
      next.delete(missionId);
      return next;
    });

    if (!result.success) {
      alert(`Failed to save: ${result.error}`);
    }
  };

  // Only show non-hidden missions
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
                    disabled={saving.has(mission.id) || !accessToken}
                  >
                    {saving.has(mission.id) ? "…" : "Save"}
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
