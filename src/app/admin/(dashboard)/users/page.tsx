"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type UserListData = {
  data: {
    id: string;
    telegramId: string;
    telegramUsername: string | null;
    firstName: string;
    lastName: string;
    createdAt: string;
    subscriptions: { status: string; expiresAt: string }[];
  }[];
  meta: {
    page: number;
    totalPages: number;
    total: number;
  };
};

export default function AdminUsersPage() {
  const [data, setData] = useState<UserListData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/admin/users?page=${page}&limit=25&search=${encodeURIComponent(search)}`);
        if (!res.ok) throw new Error("Failed to load users");
        const d = await res.json();
        if (active) {
          setData(d);
          setError("");
        }
      } catch (err: unknown) {
        if (active) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchData();
    return () => { active = false; };
  }, [page, search]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setLoading(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Users</h1>
        <form onSubmit={handleSearch} className="flex space-x-2">
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-2 border rounded-md text-sm"
          />
          <Button type="submit" variant="secondary">Search</Button>
        </form>
      </div>

      {error && <div className="text-red-500">{error}</div>}

      <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-100">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Telegram ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Username / Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Latest Sub Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan={5} className="px-6 py-4 text-center">Loading...</td></tr>
            ) : data?.data?.map((user) => (
              <tr key={user.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.telegramId}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {user.telegramUsername ? `@${user.telegramUsername}` : ""} 
                  {user.firstName || user.lastName ? ` (${user.firstName || ""} ${user.lastName || ""})` : ""}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {user.subscriptions && user.subscriptions.length > 0 ? (
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      user.subscriptions[0].status === 'ACTIVE' && new Date(user.subscriptions[0].expiresAt) > new Date() 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {user.subscriptions[0].status === 'ACTIVE' && new Date(user.subscriptions[0].expiresAt) > new Date() ? 'ACTIVE' : 'EXPIRED/INACTIVE'}
                    </span>
                  ) : (
                    <span className="text-gray-400">None</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <Link href={`/admin/users/${user.id}`} className="text-blue-600 hover:text-blue-900">
                    View
                  </Link>
                </td>
              </tr>
            ))}
            {(!loading && (!data?.data || data.data.length === 0)) && (
              <tr><td colSpan={5} className="px-6 py-4 text-center">No users found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {data?.meta && (
        <div className="flex justify-between items-center">
          <p className="text-sm text-gray-600">
            Showing page {data.meta.page} of {data.meta.totalPages} ({data.meta.total} total)
          </p>
          <div className="space-x-2">
            <Button 
              variant="outline" 
              onClick={() => { setPage(p => Math.max(1, p - 1)); setLoading(true); }}
              disabled={page <= 1}
            >
              Previous
            </Button>
            <Button 
              variant="outline" 
              onClick={() => { setPage(p => p + 1); setLoading(true); }}
              disabled={page >= data.meta.totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
