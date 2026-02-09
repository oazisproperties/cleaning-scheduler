"use client";

import { useEffect, useState } from "react";

interface Reservation {
  id: string;
  listingId: string;
  propertyName: string;
  checkIn: string;
  checkOut: string;
  checkOutTime: string;
  guestName: string;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA);
  const b = new Date(dateB);
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((b.getTime() - a.getTime()) / msPerDay);
}

export default function Home() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [sendingIds, setSendingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function fetchReservations() {
      try {
        const res = await fetch("/api/reservations");
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || `Failed to fetch: ${res.status}`);
        }
        const data: Reservation[] = await res.json();
        data.sort(
          (a, b) =>
            new Date(a.checkOut).getTime() - new Date(b.checkOut).getTime()
        );
        setReservations(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    fetchReservations();
  }, []);

  async function handleSendInvite(reservation: Reservation) {
    const { id, propertyName, checkOut, checkOutTime } = reservation;

    setSendingIds((prev) => new Set(prev).add(id));

    try {
      const res = await fetch("/api/send-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reservationId: id,
          propertyName,
          checkOut,
          checkOutTime,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Send failed: ${res.status}`);
      }

      setSentIds((prev) => new Set(prev).add(id));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      alert(`Failed to send invite: ${message}`);
    } finally {
      setSendingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  // Group reservations by property name
  const grouped: Record<string, Reservation[]> = {};
  for (const r of reservations) {
    if (!grouped[r.propertyName]) {
      grouped[r.propertyName] = [];
    }
    grouped[r.propertyName].push(r);
  }

  return (
    <main className="min-h-screen px-4 py-8 max-w-2xl mx-auto">
      <h1 className="font-[family-name:var(--font-heading)] text-3xl font-bold text-teal mb-6">
        Upcoming Checkouts
      </h1>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-teal border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">
          <p className="font-semibold">Error loading reservations</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      )}

      {!loading && !error && reservations.length === 0 && (
        <div className="text-center py-20 text-gray-500">
          <p className="text-lg">No upcoming checkouts in the next 2 weeks</p>
        </div>
      )}

      {!loading &&
        !error &&
        Object.entries(grouped).map(([propertyName, items]) => (
          <div
            key={propertyName}
            className="bg-white rounded-xl shadow-sm mb-4 overflow-hidden"
          >
            <div className="bg-teal px-4 py-3">
              <h2 className="text-white font-semibold text-lg">
                {propertyName}
              </h2>
            </div>

            <ul>
              {items.map((r, idx) => {
                const isSent = sentIds.has(r.id);
                const isSending = sendingIds.has(r.id);
                const nextReservation = items[idx + 1];
                const gap = nextReservation
                  ? daysBetween(r.checkOut, nextReservation.checkIn)
                  : null;

                return (
                  <li key={r.id}>
                    <div className="flex items-center justify-between px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="text-sm font-medium">
                            {formatDate(r.checkIn)} &rarr;{" "}
                            {formatDate(r.checkOut)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">
                          {r.guestName}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 ml-3 shrink-0">
                        {isSending && (
                          <div className="w-4 h-4 border-2 border-teal border-t-transparent rounded-full animate-spin" />
                        )}
                        {isSent && (
                          <span className="text-xs text-teal font-medium">
                            Sent!
                          </span>
                        )}
                        <input
                          type="checkbox"
                          checked={isSent}
                          disabled={isSent || isSending}
                          onChange={() => handleSendInvite(r)}
                          className="w-5 h-5 rounded accent-teal cursor-pointer disabled:cursor-default disabled:opacity-60"
                        />
                      </div>
                    </div>

                    {gap !== null && (
                      <div className="flex items-center px-4 py-1.5 bg-cream">
                        <div className="flex-1 border-t border-cream-dark" />
                        <span
                          className={`text-xs font-medium px-2 ${
                            gap === 0
                              ? "text-red-500"
                              : gap === 1
                                ? "text-orange"
                                : "text-gray-400"
                          }`}
                        >
                          {gap === 0
                            ? "Same-day turnover"
                            : `${gap} day${gap !== 1 ? "s" : ""} to clean`}
                        </span>
                        <div className="flex-1 border-t border-cream-dark" />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
    </main>
  );
}
