'use client';

interface Gap {
  gap_type?: string;
  pattern?: string;
  affected_calls?: number;
  recommendation?: string;
  surfaced_at?: string;
}

interface CapabilityGapsProps {
  gaps: Gap[];
}

export function CapabilityGaps({ gaps }: CapabilityGapsProps) {
  if (!gaps || gaps.length === 0) {
    return (
      <div className="mt-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Capability Gaps
        </h2>
        <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
          No gaps detected yet.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
        Top Capability Gaps
      </h2>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
        LLM-identified recurring patterns
      </p>

      <div className="mt-6 space-y-4">
        {gaps.map((gap, idx) => (
          <div
            key={idx}
            className="rounded border border-orange-200 bg-orange-50 p-4 dark:border-orange-800 dark:bg-orange-900/20"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {gap.gap_type || 'Unknown Gap'}
                </h3>
                <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                  {gap.pattern}
                </p>
              </div>
              {gap.affected_calls && (
                <span className="ml-2 inline-block rounded-full bg-orange-200 px-3 py-1 text-xs font-semibold text-orange-800 dark:bg-orange-800 dark:text-orange-100">
                  {gap.affected_calls} calls
                </span>
              )}
            </div>
            {gap.recommendation && (
              <div className="mt-3 border-t border-orange-200 pt-3 dark:border-orange-800">
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  Recommendation:
                </p>
                <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                  {gap.recommendation}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
