"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type AccessData = {
  id: string;
  userId: string;
  subscriptionId: string;
  status: string;
  inviteLink: string | null;
  user: { telegramId: string };
  subscription: { status: string; expiresAt: string };
};

type AccessResponse = {
  data: AccessData[];
  meta: { page: number; totalPages: number; total: number };
};

export default function AdminAccessPage() {
  const [data, setData] = useState<AccessResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [retryingId, setRetryingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const fetchAccess = async () => {
      try {
        let url = `/api/admin/access?page=${page}&limit=25`;
        if (statusFilter) url += `&status=${statusFilter}`;
        
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to load access records");
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
    fetchAccess();
    return () => { active = false; };
  }, [page, statusFilter]);

  const handleRetry = async (id: string) => {
    if (!confirm("Are you sure you want to retry provisioning for this record?")) return;
    
    setRetryingId(id);
    try {
      const res = await fetch(`/api/admin/access/${id}/retry`, { method: "POST" });
      const resData = await res.json();
      
      if (!res.ok) {
        throw new Error(resData.error || "Retry failed");
      }
      
      alert("Provisioning successful! Status updated.");
      alert("Provisioning successful! Status updated.");
      setPage(1); // Refresh data
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Telegram Access</h1>
        <div className="flex space-x-2">
          <select 
            value={statusFilter} 
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 border rounded-md text-sm bg-white"
          >
            <option value="">All Statuses</option>
            <option value="PENDING">PENDING</option>
            <option value="INVITED">INVITED</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="REVOKED">REVOKED</option>
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sub Entitlement</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invite Link</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-4 text-center">Loading...</td></tr>
              ) : data?.data?.map((access: AccessData) => {
                const isEntitled = access.subscription.status === 'ACTIVE' && new Date(access.subscription.expiresAt) > new Date();
                
                return (
                  <tr key={access.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <Link href={`/admin/users/${access.userId}`} className="text-blue-600 hover:underline">
                        {access.user.telegramId}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        access.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                        access.status === 'INVITED' ? 'bg-blue-100 text-blue-800' :
                        access.status === 'REVOKED' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {access.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {isEntitled ? (
                        <span className="text-green-600 font-medium">Valid</span>
                      ) : (
                        <span className="text-red-600 font-medium">Expired/Inactive</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 max-w-xs truncate">
                      {access.inviteLink || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Button 
                        variant="outline" 
                        size="sm"
                        disabled={retryingId === access.id || !isEntitled || access.status === 'ACTIVE'}
                        onClick={() => handleRetry(access.id)}
                        title={!isEntitled ? "Cannot retry expired subscription" : access.status === 'ACTIVE' ? "Already active" : "Retry generating invite"}
                      >
                        {retryingId === access.id ? "Retrying..." : "Retry Provision"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {(!loading && (!data?.data || data.data.length === 0)) && (
                <tr><td colSpan={5} className="px-6 py-4 text-center">No access records found</td></tr>
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
            <Button variant="outline" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>Previous</Button>
            <Button variant="outline" onClick={() => setPage(p => p + 1)} disabled={page >= data.meta.totalPages}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
