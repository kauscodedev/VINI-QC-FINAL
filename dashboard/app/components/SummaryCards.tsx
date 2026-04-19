'use client';

interface SummaryCardsProps {
  totalCalls: number;
  averageTechnicalScore: number;
  averageBehavioralScore: number;
  uniqueDealerships: number;
}

export function SummaryCards({
  totalCalls,
  averageTechnicalScore,
  averageBehavioralScore,
  uniqueDealerships,
}: SummaryCardsProps) {
  const formatScore = (score: number) => score.toFixed(2);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
          Total Calls
        </div>
        <div className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
          {totalCalls}
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
          Avg Technical Score
        </div>
        <div className="mt-2 text-3xl font-bold text-blue-600 dark:text-blue-400">
          {formatScore(averageTechnicalScore)}
        </div>
        <div className="mt-1 text-xs text-gray-500 dark:text-gray-500">
          Scale: 1–3
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
          Avg Behavioral Score
        </div>
        <div className="mt-2 text-3xl font-bold text-purple-600 dark:text-purple-400">
          {formatScore(averageBehavioralScore)}
        </div>
        <div className="mt-1 text-xs text-gray-500 dark:text-gray-500">
          Scale: 1–3
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
          Unique Dealerships
        </div>
        <div className="mt-2 text-3xl font-bold text-green-600 dark:text-green-400">
          {uniqueDealerships}
        </div>
      </div>
    </div>
  );
}
