"use client";

import { useEffect, useState } from "react";
import { Users, CreditCard, Activity } from "lucide-react";

type DashboardData = {
  metrics: {
    totalUsers: number;
    activeSubscriptions: number;
    totalRevenue: string;
  };
  recentActivity: {
    id: string;
    createdAt: string;
    action: string;
    actorType: string;
    entityType: string;
    entityId: string | null;
  }[];
};

export default function AdminOverview() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/overview")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load overview");
        return res.json();
      })
      .then((data) => setData(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading dashboard...</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Overview</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow border border-gray-100 flex items-center">
          <div className="p-3 bg-blue-100 rounded-full text-blue-600 mr-4">
            <Users size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Total Users</p>
            <p className="text-2xl font-bold">{data?.metrics?.totalUsers || 0}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border border-gray-100 flex items-center">
          <div className="p-3 bg-green-100 rounded-full text-green-600 mr-4">
            <Activity size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Active Subscriptions</p>
            <p className="text-2xl font-bold">{data?.metrics?.activeSubscriptions || 0}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border border-gray-100 flex items-center">
          <div className="p-3 bg-purple-100 rounded-full text-purple-600 mr-4">
            <CreditCard size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Total Revenue</p>
            <p className="text-2xl font-bold">${data?.metrics?.totalRevenue || "0.00"}</p>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-bold mb-4">Recent Activity</h2>
        <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-100">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actor</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Entity</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data?.recentActivity?.map((log) => (
                <tr key={log.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {log.action}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {log.actorType}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {log.entityType} ({log.entityId?.substring(0, 8)}...)
                  </td>
                </tr>
              ))}
              {(!data?.recentActivity || data.recentActivity.length === 0) && (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                    No recent activity
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
