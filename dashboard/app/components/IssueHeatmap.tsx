'use client';

interface IssueHeatmapProps {
  issueSummary: {
    severity_counts: Record<string, number>;
    top_issue_types: Array<{ issue_type: string; count: number }>;
  };
}

export function IssueHeatmap({ issueSummary }: IssueHeatmapProps) {
  const severities = ['critical', 'warning', 'informational'];
  const issueTypes = issueSummary.top_issue_types.map((i) => i.issue_type);

  // Mock data for heatmap (in production, fetch issue breakdown by type & severity)
  const heatmapData: Record<string, Record<string, number>> = {};

  severities.forEach((sev) => {
    heatmapData[sev] = {};
    issueTypes.forEach((typ) => {
      heatmapData[sev][typ] = Math.floor(Math.random() * 20);
    });
  });

  const getSeverityColor = (cnt: number, max: number) => {
    const ratio = cnt / max;
    if (ratio === 0) return 'bg-gray-100 dark:bg-gray-700';
    if (ratio < 0.33) return 'bg-yellow-100 dark:bg-yellow-900';
    if (ratio < 0.66) return 'bg-orange-200 dark:bg-orange-800';
    return 'bg-red-300 dark:bg-red-900';
  };

  const maxCount = Math.max(
    ...Object.values(heatmapData).flatMap((row) => Object.values(row))
  );

  return (
    <div className="mt-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
        Issue Distribution Heatmap
      </h2>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
        Severity × Issue Type
      </p>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="pb-3 text-left font-semibold text-gray-900 dark:text-white">
                Severity
              </th>
              {issueTypes.map((typ) => (
                <th
                  key={typ}
                  className="pb-3 text-center font-semibold text-gray-900 dark:text-white"
                >
                  {typ}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {severities.map((sev) => (
              <tr key={sev} className="border-b border-gray-100 dark:border-gray-700">
                <td className="py-3 font-medium text-gray-700 dark:text-gray-300">
                  {sev}
                </td>
                {issueTypes.map((typ) => {
                  const count = heatmapData[sev]?.[typ] ?? 0;
                  return (
                    <td key={typ} className="py-3 text-center">
                      <div
                        className={`inline-block rounded px-2 py-1 font-semibold text-gray-900 dark:text-white ${getSeverityColor(
                          count,
                          maxCount
                        )}`}
                      >
                        {count}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
        <span className="flex items-center gap-2">
          <div className="h-3 w-3 bg-gray-100 dark:bg-gray-700"></div>
          None
        </span>
        <span className="flex items-center gap-2">
          <div className="h-3 w-3 bg-yellow-100 dark:bg-yellow-900"></div>
          Low
        </span>
        <span className="flex items-center gap-2">
          <div className="h-3 w-3 bg-orange-200 dark:bg-orange-800"></div>
          Medium
        </span>
        <span className="flex items-center gap-2">
          <div className="h-3 w-3 bg-red-300 dark:bg-red-900"></div>
          High
        </span>
      </div>
    </div>
  );
}
