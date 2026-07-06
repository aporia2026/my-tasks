"use client";

import { AdminDashboard } from "@/components/admin-dashboard";
import { RequesterDashboard } from "@/components/requester-dashboard";
import { useUser } from "@/components/user-provider";

export default function DashboardPage() {
  const { user, loading } = useUser();

  if (loading || !user) {
    return <p className="mt-10 text-center text-sm text-muted">Loading...</p>;
  }

  return user.role === "admin" ? <AdminDashboard /> : <RequesterDashboard />;
}
