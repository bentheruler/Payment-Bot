"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type AuditLogData = {
  data: {
    id: string;
    createdAt: string;
    action: string;
    actorType: string;
    actorId: string | null;
    entityType: string;
    entityId: string | null;
    metadata: unknown;
  }[];
  meta: {
    page: number;
    totalPages: number;
    total: number;
  };
};

export default function AdminAuditLogsPage() {
  const [data, setData] = useState<AuditLogData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState("");

  const fetchLogs = (p: number, action: string) => {
    setLoading(true);
    let url = `/api/admin/audit-logs?page=${p}&limit=50`;
    if (action) url += `&action=${action}`;
    
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load audit logs");
        return res.json();
      })
      .then((d) => setData(d))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setTimeout(() => fetchLogs(page, actionFilter), 0);
  }, [page, actionFilter]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Audit Logs</h1>
        <div className="flex space-x-2">
          <select 
            value={actionFilter} 
            onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 border rounded-md text-sm bg-white"
          >
            <option value="">All Actions</option>
            <option value="ADMIN_LOGIN">ADMIN_LOGIN</option>
            <option value="ADMIN_LOGOUT">ADMIN_LOGOUT</option>
            <option value="ADMIN_TELEGRAM_PROVISION_RETRY">ADMIN_TELEGRAM_PROVISION_RETRY</option>
            <option value="SUBSCRIPTION_ACTIVATED">SUBSCRIPTION_ACTIVATED</option>
            <option value="SUBSCRIPTION_EXPIRED">SUBSCRIPTION_EXPIRED</option>
            <option value="TELEGRAM_ACCESS_REVOKED">TELEGRAM_ACCESS_REVOKED</option>
            <option value="TELEGRAM_ACCESS_REVOCATION_FAILED">TELEGRAM_ACCESS_REVOCATION_FAILED</option>
          </select>
        </div>
      </div>

      {error && <div className="text-red-500">{error}</div>}

      <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-100">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actor</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entity</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Metadata</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-4 text-center">Loading...</td></tr>
              ) : data?.data?.map((log) => (
                <tr key={log.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {log.action}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {log.actorType} {log.actorId && `(${log.actorId.substring(0,8)}...)`}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {log.entityType} {log.entityId && `(${log.entityId.substring(0,8)}...)`}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {log.metadata ? (
                      <pre className="text-xs bg-gray-50 p-2 rounded overflow-auto max-w-xs">
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    ) : "-"}
                  </td>
                </tr>
              ))}
              {(!loading && (!data?.data || data.data.length === 0)) && (
                <tr><td colSpan={5} className="px-6 py-4 text-center">No audit logs found</td></tr>
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
