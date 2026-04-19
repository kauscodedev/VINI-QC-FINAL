'use client';

interface RemediationInsight {
  id?: string;
  batch_id?: string;
  root_cause?: string;
  proposed_fix?: string;
}

interface RemediationInsightsProps {
  insights: RemediationInsight[];
}

export function RemediationInsights({ insights }: RemediationInsightsProps) {
  if (!insights || insights.length === 0) {
    return (
      <div className="mt-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Remediation Insights
        </h2>
        <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
          No insights available yet.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
        Remediation Insights
      </h2>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
        Root cause analysis & proposed fixes
      </p>

      <div className="mt-6 space-y-4">
        {insights.map((insight, idx) => (
          <div
            key={idx}
            className="rounded border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20"
          >
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Root Cause
              </h3>
              <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                {insight.root_cause}
              </p>
            </div>
            <div className="mt-3 border-t border-blue-200 pt-3 dark:border-blue-800">
              <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400">
                Proposed Fix
              </h4>
              <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                {insight.proposed_fix}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
