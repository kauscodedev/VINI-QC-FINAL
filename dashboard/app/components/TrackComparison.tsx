'use client';

import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts';

interface TrackComparisonProps {
  recommendationMix: {
    technical: Record<string, number>;
    behavioral: Record<string, number>;
  };
}

const COLORS = {
  PASS: '#10b981',
  PASS_WITH_ISSUES: '#f59e0b',
  REVIEW: '#f97316',
  FAIL: '#ef4444',
  Unknown: '#9ca3af',
};

export function TrackComparison({ recommendationMix }: TrackComparisonProps) {
  const techData = Object.entries(recommendationMix.technical).map(
    ([name, value]) => ({
      name,
      value,
    })
  );

  const behavData = Object.entries(recommendationMix.behavioral).map(
    ([name, value]) => ({
      name,
      value,
    })
  );

  const getColor = (name: string) =>
    COLORS[name as keyof typeof COLORS] || COLORS.Unknown;

  return (
    <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Technical Recommendations
        </h2>
        <div className="mt-4">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={techData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {techData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={getColor(entry.name)}
                  />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Behavioral Recommendations
        </h2>
        <div className="mt-4">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={behavData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {behavData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={getColor(entry.name)}
                  />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
