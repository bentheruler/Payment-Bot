"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type PaymentData = {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  status: string;
  provider: string;
  providerInvoiceId: string | null;
  createdAt: string;
  user: { telegramId: string };
};

type PaymentsResponse = {
  data: PaymentData[];
  meta: { page: number; totalPages: number; total: number };
};

export default function AdminPaymentsPage() {
  const [data, setData] = useState<PaymentsResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [providerFilter, setProviderFilter] = useState("");

  useEffect(() => {
    let active = true;
    const fetchPayments = async () => {
      try {
        let url = `/api/admin/payments?page=${page}&limit=25`;
        if (statusFilter) url += `&status=${statusFilter}`;
        if (providerFilter) url += `&provider=${providerFilter}`;
        
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to load payments");
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
    
    fetchPayments();
    return () => { active = false; };
  }, [page, statusFilter, providerFilter]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Payments</h1>
        <div className="flex space-x-2">
          <select 
            value={statusFilter} 
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 border rounded-md text-sm bg-white"
          >
            <option value="">All Statuses</option>
            <option value="PAID">PAID</option>
            <option value="PENDING">PENDING</option>
            <option value="FAILED">FAILED</option>
            <option value="EXPIRED">EXPIRED</option>
            <option value="REFUNDED">REFUNDED</option>
          </select>
          <select 
            value={providerFilter} 
            onChange={(e) => { setProviderFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 border rounded-md text-sm bg-white"
          >
            <option value="">All Providers</option>
            <option value="CRYPTO_PAY">Crypto Pay</option>
            <option value="STRIPE">Stripe</option>
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Provider</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-4 text-center">Loading...</td></tr>
              ) : data?.data?.map((payment: PaymentData) => (
                <tr key={payment.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <Link href={`/admin/users/${payment.userId}`} className="text-blue-600 hover:underline">
                      {payment.user.telegramId}
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                    {payment.amount} {payment.currency}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      payment.status === 'PAID' ? 'bg-green-100 text-green-800' :
                      payment.status === 'FAILED' || payment.status === 'EXPIRED' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {payment.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {payment.provider}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {payment.providerInvoiceId || "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(payment.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
              {(!loading && (!data?.data || data.data.length === 0)) && (
                <tr><td colSpan={6} className="px-6 py-4 text-center">No payments found</td></tr>
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
