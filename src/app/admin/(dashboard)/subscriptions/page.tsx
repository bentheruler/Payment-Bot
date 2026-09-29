"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type SubscriptionData = {
  data: {
    id: string;
    userId: string;
    user: { telegramId: string };
    plan: { name: string; price: number; currency: string };
    status: string;
    startsAt: string;
    expiresAt: string;
  }[];
  meta: {
    page: number;
    totalPages: number;
    total: number;
  };
};

export default function AdminSubscriptionsPage() {
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");

  const fetchSubs = (p: number, filter: string) => {
    let url = `/api/admin/subscriptions?page=${p}&limit=25`;
    if (filter) url += `&status=${filter}`;
    
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load subscriptions");
        return res.json();
      })
      .then((d) => setData(d))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchSubs(page, statusFilter);
  }, [page, statusFilter]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Subscriptions</h1>
        <div className="flex space-x-2">
          <select 
            value={statusFilter} 
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); setLoading(true); }}
            className="px-3 py-2 border rounded-md text-sm bg-white"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active & Valid</option>
            <option value="EXPIRED">Expired</option>
            <option value="PENDING">Pending</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      {error && <div className="text-red-500">{error}</div>}

      <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-100">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plan</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Start Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expiration</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-4 text-center">Loading...</td></tr>
              ) : data?.data?.map((sub) => {
                const isActive = sub.status === 'ACTIVE' && new Date(sub.expiresAt) > new Date();
                return (
                  <tr key={sub.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <Link href={`/admin/users/${sub.userId}`} className="text-blue-600 hover:underline">
                        {sub.user.telegramId}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {sub.plan.name} ({sub.plan.price} {sub.plan.currency})
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {isActive ? 'ACTIVE' : 'EXPIRED/INACTIVE'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(sub.startsAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(sub.expiresAt).toLocaleString()}
                    </td>
                  </tr>
                );
              })}
              {(!loading && (!data?.data || data.data.length === 0)) && (
                <tr><td colSpan={5} className="px-6 py-4 text-center">No subscriptions found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {data?.meta && (
        <div className="flex justify-between items-center">
          <p className="text-sm text-gray-600">
            Showing page {data.meta.page} of {data.meta.totalPages} ({data.meta.total} total)
          </p>
          <div className="space-x-2">
            <Button variant="outline" onClick={() => { setPage(p => Math.max(1, p - 1)); setLoading(true); }} disabled={page <= 1}>Previous</Button>
            <Button variant="outline" onClick={() => { setPage(p => p + 1); setLoading(true); }} disabled={page >= data.meta.totalPages}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
