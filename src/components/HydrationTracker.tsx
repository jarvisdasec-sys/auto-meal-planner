'use client';

import { useMemo, useState } from 'react';
import { useMealPlannerStore } from '@/store/useMealPlannerStore';
import Card from './ui/Card';

const DAILY_GOAL_OZ = 100;
const QUICK_ADD_AMOUNTS = [8, 16, 24];

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

export default function HydrationTracker() {
  const hydrationLogs = useMealPlannerStore((s) => s.hydrationLogs);
  const addHydration = useMealPlannerStore((s) => s.addHydration);
  const removeHydration = useMealPlannerStore((s) => s.removeHydration);
  const [selectedDate, setSelectedDate] = useState(todayIso());

  const entriesForDay = useMemo(
    () => hydrationLogs.filter((entry) => entry.timestamp.slice(0, 10) === selectedDate),
    [hydrationLogs, selectedDate],
  );

  const totalOunces = entriesForDay.reduce((total, entry) => total + entry.ounces, 0);
  const progressPercent = Math.min(100, Math.round((totalOunces / DAILY_GOAL_OZ) * 100));

  return (
    <Card title="Hydration Tracker" subtitle={`Daily goal: ${DAILY_GOAL_OZ} oz`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-sm text-slate-400">Date</span>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="input w-auto"
        />
      </div>

      <div className="mb-4">
        <div className="mb-1.5 flex items-center justify-between text-sm">
          <span className="font-semibold text-accent">{totalOunces} oz</span>
          <span className="text-slate-400">{progressPercent}% of goal</span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {QUICK_ADD_AMOUNTS.map((amount) => (
          <button
            key={amount}
            onClick={() => addHydration(amount)}
            className="rounded-lg bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition-colors hover:bg-white/10"
          >
            + {amount} oz
          </button>
        ))}
      </div>

      {entriesForDay.length > 0 && (
        <div className="mt-4 space-y-1.5">
          {entriesForDay.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-1.5 text-xs">
              <span className="text-slate-300">
                {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {entry.ounces} oz
              </span>
              <button
                onClick={() => removeHydration(entry.id)}
                className="text-slate-500 hover:text-accent-red"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
