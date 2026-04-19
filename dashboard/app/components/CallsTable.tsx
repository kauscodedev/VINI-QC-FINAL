'use client';

import { useState, useMemo } from 'react';

interface Call {
  call_id: string;
  call_start_time?: string;
  agent_name?: string;
  agent_type?: string;
  dealership_name?: string;
  call_type?: string;
  primary_intent?: string;
  technical_overall_score?: number;
  behavioral_overall_score?: number;
  technical_recommendation?: string;
  behavioral_recommendation?: string;
}

interface CallsTableProps {
  calls: Call[];
}

type SortField = keyof Call;

export function CallsTable({ calls }: CallsTableProps) {
  const [sortBy, setSortBy] = useState<SortField>('call_start_time');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);

  const pageSize = 10;

  const sortedCalls = useMemo(() => {
    const sorted = [...calls].sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];

      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      if (typeof aVal === 'string') {
        return sortOrder === 'asc'
          ? aVal.localeCompare(String(bVal))
          : String(bVal).localeCompare(aVal);
      }

      return sortOrder === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });

    return sorted;
  }, [calls, sortBy, sortOrder]);

  const paginatedCalls = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedCalls.slice(start, start + pageSize);
  }, [sortedCalls, page]);

  const totalPages = Math.ceil(sortedCalls.length / pageSize);

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const getRecommendationBadgeColor = (rec?: string) => {
    if (!rec) return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    if (rec === 'PASS') return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    if (rec === 'PASS_WITH_ISSUES')
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    if (rec === 'REVIEW')
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
    return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
  };

  const SortHeader = ({
    field,
    label,
  }: {
    field: SortField;
    label: string;
  }) => (
    <th
      className="cursor-pointer px-4 py-3 text-left text-sm font-semibold text-gray-900 hover:bg-gray-100 dark:text-white dark:hover:bg-gray-700"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-2">
        {label}
        {sortBy === field && (
          <span className="text-xs">
            {sortOrder === 'asc' ? '↑' : '↓'}
          </span>
        )}
      </div>
    </th>
  );

  return (
    <div className="mt-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
        Call Records
      </h2>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
        {sortedCalls.length} total calls
      </p>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <SortHeader field="call_id" label="Call ID" />
              <SortHeader field="call_start_time" label="Start Time" />
              <SortHeader field="agent_name" label="Agent" />
              <SortHeader field="dealership_name" label="Dealership" />
              <SortHeader
                field="technical_overall_score"
                label="Tech Score"
              />
              <SortHeader
                field="behavioral_overall_score"
                label="Behav Score"
              />
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                Recommendations
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedCalls.map((call) => (
              <tr
                key={call.call_id}
                className="border-b border-gray-100 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700"
              >
                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                  <code className="text-xs">{call.call_id.slice(0, 8)}</code>
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                  {call.call_start_time
                    ? new Date(call.call_start_time).toLocaleDateString()
                    : '—'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                  {call.agent_name || '—'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                  {call.dealership_name || '—'}
                </td>
                <td className="px-4 py-3 text-sm font-semibold text-blue-600 dark:text-blue-400">
                  {call.technical_overall_score
                    ? call.technical_overall_score.toFixed(2)
                    : '—'}
                </td>
                <td className="px-4 py-3 text-sm font-semibold text-purple-600 dark:text-purple-400">
                  {call.behavioral_overall_score
                    ? call.behavioral_overall_score.toFixed(2)
                    : '—'}
                </td>
                <td className="px-4 py-3 text-sm">
                  <div className="flex gap-2">
                    <span
                      className={`inline-block rounded px-2 py-1 text-xs font-semibold ${getRecommendationBadgeColor(
                        call.technical_recommendation
                      )}`}
                    >
                      {call.technical_recommendation || 'N/A'}
                    </span>
                    <span
                      className={`inline-block rounded px-2 py-1 text-xs font-semibold ${getRecommendationBadgeColor(
                        call.behavioral_recommendation
                      )}`}
                    >
                      {call.behavioral_recommendation || 'N/A'}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Page {page} of {totalPages}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="rounded border border-gray-300 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Prev
          </button>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="rounded border border-gray-300 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
