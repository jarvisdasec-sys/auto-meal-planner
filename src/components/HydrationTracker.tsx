'use client';

import { useMemo, useState } from 'react';
import { isDateKey, localDateKey, type DateKey } from '@/lib/dateKeys';
import { getHydrationEntriesForDate } from '@/lib/nutritionLedger';
import { useMealPlannerStore } from '@/store/useMealPlannerStore';
import Card from './ui/Card';
import EntryEditor from './EntryEditor';

const DAILY_GOAL_OZ = 100;
const QUICK_ADD_AMOUNTS = [8, 16, 24];

interface HydrationTrackerProps {
  /** When provided, tracker date remains coordinated with the parent energy ledger. */
  selectedDate?: DateKey;
  onSelectedDateChange?: (date: DateKey) => void;
}

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : 'Unable to update hydration. Please try again.';
}

export default function HydrationTracker({ selectedDate, onSelectedDateChange }: HydrationTrackerProps) {
  const hydrationLogs = useMealPlannerStore((state) => state.hydrationLogs);
  const addHydration = useMealPlannerStore((state) => state.addHydration);
  const removeHydration = useMealPlannerStore((state) => state.removeHydration);
  const [localSelectedDate, setLocalSelectedDate] = useState<DateKey>(() => localDateKey());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const activeDate = selectedDate ?? localSelectedDate;

  const entriesForDay = useMemo(
    () => getHydrationEntriesForDate(hydrationLogs, activeDate),
    [activeDate, hydrationLogs],
  );
  const totalOunces = entriesForDay.reduce((total, entry) => total + entry.ounces, 0);
  const progressPercent = Math.min(100, Math.round((totalOunces / DAILY_GOAL_OZ) * 100));

  const changeDate = (value: string) => {
    if (!isDateKey(value)) {
      setError('Select a valid local calendar date for hydration.');
      return;
    }
    if (selectedDate === undefined) setLocalSelectedDate(value);
    onSelectedDateChange?.(value);
    setError('');
  };

  const addQuickAmount = (ounces: number) => {
    try {
      addHydration(ounces, activeDate);
      setError('');
    } catch (addError) {
      setError(messageFromError(addError));
    }
  };

  const removeEntry = (id: string) => {
    try {
      removeHydration(id);
      setError('');
    } catch (removeError) {
      setError(messageFromError(removeError));
    }
  };

  return (
    <Card title="Hydration Tracker" subtitle={`Daily goal: ${DAILY_GOAL_OZ} oz`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <label htmlFor="hydration-date" className="text-sm text-slate-400">Date</label>
        <input
          id="hydration-date"
          type="date"
          value={activeDate}
          onChange={(event) => changeDate(event.target.value)}
          className="input w-auto"
        />
      </div>

      {error && <p role="alert" className="mb-3 rounded-lg bg-accent-red/15 px-3 py-2 text-sm text-accent-red">{error}</p>}

      <div className="mb-4">
        <div className="mb-1.5 flex items-center justify-between text-sm">
          <span className="font-semibold text-accent">{totalOunces} oz</span>
          <span className="text-slate-400">{progressPercent}% of goal</span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {QUICK_ADD_AMOUNTS.map((amount) => (
          <button
            key={amount}
            type="button"
            onClick={() => addQuickAmount(amount)}
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
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setEditingId(entry.id)} className="text-slate-400 hover:text-slate-100">Edit</button>
                <button type="button" onClick={() => removeEntry(entry.id)} className="text-slate-500 hover:text-accent-red">Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editingId && <EntryEditor kind="hydration" id={editingId} onClose={() => setEditingId(null)} />}
    </Card>
  );
}
