'use client';

import { X, SlidersHorizontal } from 'lucide-react';
import type { FilterState } from '../dashboard';

interface GlobalFilterBarProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  options: {
    dealerships: string[];
    agents: string[];
    call_types: string[];
    primary_intents: string[];
  };
  filteredCount: number;
  totalCount: number;
}

const OUTCOME_OPTIONS = ['PASS', 'PASS_WITH_ISSUES', 'REVIEW', 'FAIL'];

const selectClass =
  'h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-xs font-medium px-2 pr-7 focus:outline-none focus:ring-2 focus:ring-brand-500 appearance-none cursor-pointer hover:border-brand-400 transition-colors';

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative flex items-center gap-0">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={selectClass}
        style={{ minWidth: '120px' }}
      >
        <option value="">{label}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o.replace(/_/g, ' ')}
          </option>
        ))}
      </select>
      <svg
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

export function GlobalFilterBar({ filters, onChange, options, filteredCount, totalCount }: GlobalFilterBarProps) {
  const isFiltered = Object.values(filters).some(Boolean);
  const activeCount = Object.values(filters).filter(Boolean).length;

  function set(key: keyof FilterState, value: string) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-[105px] z-40">
      <div className="mx-auto max-w-7xl px-4 py-2.5 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-slate-400 mr-1">
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span className="text-xs font-bold uppercase tracking-wider">Filters</span>
          {activeCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-brand-600 text-white text-[9px] font-black">
              {activeCount}
            </span>
          )}
        </div>

        <FilterSelect
          label="All Dealerships"
          value={filters.dealership}
          options={options.dealerships}
          onChange={(v) => set('dealership', v)}
        />
        <FilterSelect
          label="All Agents"
          value={filters.agent}
          options={options.agents}
          onChange={(v) => set('agent', v)}
        />
        <FilterSelect
          label="All Call Types"
          value={filters.call_type}
          options={options.call_types}
          onChange={(v) => set('call_type', v)}
        />
        <FilterSelect
          label="All Intents"
          value={filters.primary_intent}
          options={options.primary_intents}
          onChange={(v) => set('primary_intent', v)}
        />
        <FilterSelect
          label="Tech Outcome"
          value={filters.tech_outcome}
          options={OUTCOME_OPTIONS}
          onChange={(v) => set('tech_outcome', v)}
        />
        <FilterSelect
          label="Behav Outcome"
          value={filters.behav_outcome}
          options={OUTCOME_OPTIONS}
          onChange={(v) => set('behav_outcome', v)}
        />

        <div className="ml-auto flex items-center gap-3">
          {isFiltered && (
            <span className="text-xs font-semibold text-slate-500">
              <span className="text-brand-600 font-black">{filteredCount}</span> of {totalCount} calls
            </span>
          )}
          {!isFiltered && (
            <span className="text-xs text-slate-400 font-medium">{totalCount} calls total</span>
          )}
        </div>
      </div>
    </div>
  );
}
