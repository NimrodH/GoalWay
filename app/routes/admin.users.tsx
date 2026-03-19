import { useLoaderData } from "react-router";
import { AdminLayout } from "~/components/admin-layout/admin-layout";
import { AdminUsers } from "~/components/admin-users/admin-users";
import { loader as adminLoader, action as adminAction } from "~/routes/admin";

export const loader = adminLoader;
export const action = adminAction;

export default function AdminUsersPage() {
  const loaderData = useLoaderData<typeof loader>();

  return (
    <AdminLayout loaderData={loaderData} activeSection="users">
      {({ sessionAccessToken }) => (
        <AdminUsers
          users={loaderData.users}
          organizations={loaderData.organizations}
          missions={loaderData.missionsWithAccess}
          accessToken={sessionAccessToken}
        />
      )}
    </AdminLayout>
  );
}
