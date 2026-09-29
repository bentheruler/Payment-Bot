"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type UserDetail = {
  id: string;
  telegramId: string;
  firstName: string | null;
  lastName: string | null;
  telegramUsername: string | null;
  createdAt: string;
  subscriptions: { id: string; plan: { name: string; price: number; currency: string }; status: string; startsAt: string; expiresAt: string }[];
  payments: { id: string; status: string; provider: string; amount: string; currency: string; providerInvoiceId: string | null; createdAt: string }[];
  telegramAccesses: { id: string; status: string; inviteLink: string | null; joinedAt: string | null; revokedAt: string | null }[];
};

export default function AdminUserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  
  const [user, setUser] = useState<UserDetail | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/admin/users/${id}`)
      .then(res => {
        if (!res.ok) throw new Error("Failed to load user");
        return res.json();
      })
      .then(d => setUser(d))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div>Loading user details...</div>;
  if (error) return <div className="text-red-500">{error}</div>;
  if (!user) return <div>User not found</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">User Details</h1>
        <Button variant="outline" onClick={() => router.back()}>Back</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow border border-gray-100">
          <h2 className="text-lg font-bold mb-4 border-b pb-2">Telegram Identity</h2>
          <dl className="space-y-2 text-sm">
            <div className="grid grid-cols-3"><dt className="text-gray-500 font-medium">Telegram ID</dt><dd className="col-span-2">{user.telegramId}</dd></div>
            <div className="grid grid-cols-3"><dt className="text-gray-500 font-medium">Username</dt><dd className="col-span-2">{user.telegramUsername ? `@${user.telegramUsername}` : "N/A"}</dd></div>
            <div className="grid grid-cols-3"><dt className="text-gray-500 font-medium">First Name</dt><dd className="col-span-2">{user.firstName || "N/A"}</dd></div>
            <div className="grid grid-cols-3"><dt className="text-gray-500 font-medium">Last Name</dt><dd className="col-span-2">{user.lastName || "N/A"}</dd></div>
            <div className="grid grid-cols-3"><dt className="text-gray-500 font-medium">Joined At</dt><dd className="col-span-2">{new Date(user.createdAt).toLocaleString()}</dd></div>
          </dl>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border border-gray-100">
          <h2 className="text-lg font-bold mb-4 border-b pb-2">Subscriptions</h2>
          {user.subscriptions?.length > 0 ? (
            <ul className="space-y-4">
              {user.subscriptions.map((sub: {id: string, plan: {name: string, price: number, currency: string}, status: string, startsAt: string, expiresAt: string}) => (
                <li key={sub.id} className="text-sm">
                  <div className="flex justify-between font-medium">
                    <span>{sub.plan.name}</span>
                    <span className={sub.status === 'ACTIVE' && new Date(sub.expiresAt) > new Date() ? 'text-green-600' : 'text-red-600'}>
                      {sub.status === 'ACTIVE' && new Date(sub.expiresAt) > new Date() ? 'ACTIVE' : 'EXPIRED/INACTIVE'}
                    </span>
                  </div>
                  <div className="text-gray-500 mt-1">
                    Expires: {new Date(sub.expiresAt).toLocaleString()}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">No subscriptions found.</p>
          )}
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow border border-gray-100 mt-6">
        <h2 className="text-lg font-bold mb-4 border-b pb-2">Telegram Access Records</h2>
        {user.telegramAccesses?.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr><th>Status</th><th>Invite Link</th><th>Joined At</th><th>Revoked At</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-sm">
                {user.telegramAccesses.map((acc) => (
                  <tr key={acc.id}>
                    <td className="px-4 py-2 font-medium">{acc.status}</td>
                    <td className="px-4 py-2 truncate max-w-xs">{acc.inviteLink}</td>
                    <td className="px-4 py-2">{acc.joinedAt ? new Date(acc.joinedAt).toLocaleString() : "-"}</td>
                    <td className="px-4 py-2">{acc.revokedAt ? new Date(acc.revokedAt).toLocaleString() : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-500">No access records found.</p>
        )}
      </div>

      <div className="bg-white p-6 rounded-lg shadow border border-gray-100 mt-6">
        <h2 className="text-lg font-bold mb-4 border-b pb-2">Payments</h2>
        {user.payments?.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr><th>Status</th><th>Provider</th><th>Amount</th><th>Invoice ID</th><th>Date</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-sm">
                {user.payments.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-2 font-medium">{p.status}</td>
                    <td className="px-4 py-2">{p.provider}</td>
                    <td className="px-4 py-2">{p.amount} {p.currency}</td>
                    <td className="px-4 py-2">{p.providerInvoiceId || "-"}</td>
                    <td className="px-4 py-2">{new Date(p.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-500">No payments found.</p>
        )}
      </div>
    </div>
  );
}
