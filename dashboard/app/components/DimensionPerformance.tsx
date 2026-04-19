'use client';

import { useState } from 'react';

interface DimensionPerformanceProps {
  dimensionAverages: {
    technical: Record<string, number>;
    behavioral: Record<string, number>;
  };
}

export function DimensionPerformance({
  dimensionAverages,
}: DimensionPerformanceProps) {
  const [activeTab, setActiveTab] = useState<'technical' | 'behavioral'>(
    'technical'
  );

  const getScoreColor = (score: number | null) => {
    if (score === null) return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
    if (score >= 2.5) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    if (score >= 2) return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    if (score >= 1.5) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
  };

  const formatScore = (score: number) => score.toFixed(2);

  const TechDimensions = [
    'information_accuracy',
    'conversion',
    'tool_accuracy',
    'escalation',
    'conversation_quality',
    'response_latency',
  ];

  const BehavDimensions = [
    'behavior_opening_tone',
    'behavior_intent_discovery',
    'behavior_resolution_accuracy',
    'behavior_objection_recovery',
    'behavior_conversation_management',
    'behavior_conversion_next_step',
  ];

  const displayDimensions =
    activeTab === 'technical' ? TechDimensions : BehavDimensions;
  const data =
    activeTab === 'technical'
      ? dimensionAverages.technical
      : dimensionAverages.behavioral;

  return (
    <div className="mt-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center gap-4 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('technical')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'technical'
              ? 'border-b-2 border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
              : 'text-gray-600 dark:text-gray-400'
          }`}
        >
          Technical (6)
        </button>
        <button
          onClick={() => setActiveTab('behavioral')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'behavioral'
              ? 'border-b-2 border-purple-600 text-purple-600 dark:border-purple-400 dark:text-purple-400'
              : 'text-gray-600 dark:text-gray-400'
          }`}
        >
          Behavioral (6)
        </button>
      </div>

      <div className="mt-6">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left text-sm font-semibold text-gray-900 dark:text-white">
                Dimension
              </th>
              <th className="text-right text-sm font-semibold text-gray-900 dark:text-white">
                Average Score
              </th>
            </tr>
          </thead>
          <tbody>
            {displayDimensions.map((dim) => {
              const score = data[dim] ?? null;
              return (
                <tr
                  key={dim}
                  className="border-b border-gray-100 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700"
                >
                  <td className="py-3 text-sm text-gray-700 dark:text-gray-300">
                    {dim.replace(/_/g, ' ')}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span
                      className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${getScoreColor(
                        score
                      )}`}
                    >
                      {score !== null ? formatScore(score) : 'N/A'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
