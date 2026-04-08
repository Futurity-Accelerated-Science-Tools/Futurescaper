import React from 'react';
import { Loader2, CheckCircle2, Circle } from 'lucide-react';

type Phase = 'idle' | 'first-order' | 'second-order' | 'third-order' | 'complete';

interface GenerationProgressProps {
  phase: Phase;
  onContinue?: () => void;
  onPause?: () => void;
  isPaused?: boolean;
}

export function GenerationProgress({ phase, onContinue, onPause, isPaused }: GenerationProgressProps) {
  const phases = [
    { key: 'first-order', label: 'First-Order Consequences', description: 'Obvious, intuitive effects' },
    { key: 'second-order', label: 'Second-Order Consequences', description: 'STEEP framework analysis' },
    { key: 'third-order', label: 'Third-Order Consequences', description: 'Wild cards & unknown unknowns' },
  ] as const;

  const getPhaseStatus = (phaseKey: string): 'complete' | 'active' | 'pending' => {
    const phaseOrder: string[] = ['first-order', 'second-order', 'third-order', 'complete'];
    const currentPhase: string = phase;
    const currentIndex = phaseOrder.indexOf(currentPhase);
    const phaseIndex = phaseOrder.indexOf(phaseKey);

    if (phaseIndex < currentIndex || currentPhase === 'complete') return 'complete';
    if (phaseIndex === currentIndex && currentPhase !== 'complete') return 'active';
    return 'pending';
  };

  if (phase === 'idle') return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-700">
          {phase === 'complete' ? 'Generation Complete' : 'Generating Map...'}
        </h3>
        {phase !== 'complete' && (
          <div className="flex gap-2">
            {isPaused ? (
              <button
                onClick={onContinue}
                className="px-3 py-1 text-sm bg-seed text-white rounded-lg hover:bg-seed-dark"
              >
                Continue
              </button>
            ) : (
              <button
                onClick={onPause}
                className="px-3 py-1 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
              >
                Pause
              </button>
            )}
          </div>
        )}
      </div>

      <div className="space-y-3">
        {phases.map((p) => {
          const status = getPhaseStatus(p.key);
          return (
            <div key={p.key} className="flex items-center gap-3">
              {status === 'complete' ? (
                <CheckCircle2 className="w-5 h-5 text-positive flex-shrink-0" />
              ) : status === 'active' ? (
                <Loader2 className="w-5 h-5 text-seed flex-shrink-0 animate-spin" />
              ) : (
                <Circle className="w-5 h-5 text-slate-300 flex-shrink-0" />
              )}
              <div>
                <p className={`text-sm font-medium ${status === 'pending' ? 'text-slate-400' : 'text-slate-700'}`}>
                  {p.label}
                </p>
                <p className="text-xs text-slate-500">{p.description}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Waiting message */}
      {phase !== 'complete' && (
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-800">
            <strong>☕ This takes 2-4 minutes.</strong> Feel free to switch tabs or grab a coffee — the results will be here when you return!
          </p>
          <p className="text-xs text-amber-600 mt-1">
            Analyzing consequences across Social, Technological, Economic, Environmental, and Political dimensions...
          </p>
        </div>
      )}
    </div>
  );
}
