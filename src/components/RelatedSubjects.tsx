import { useState } from 'react';
import { ChevronDown, ChevronRight, Compass, Zap, Loader2 } from 'lucide-react';
import { RelevantSubject } from '../api/subjects';

interface RelatedSubjectsProps {
  subjects: RelevantSubject[];
  isLoading: boolean;
  onRetry?: () => void;
}

export function RelatedSubjects({ subjects, isLoading, onRetry }: RelatedSubjectsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showTangential, setShowTangential] = useState(true);

  const directSubjects = subjects.filter(s => s.relevance === 'direct');
  const tangentialSubjects = subjects.filter(s => s.relevance === 'tangential');
  const totalCount = subjects.length;

  if (!isLoading && totalCount === 0) {
    return null;
  }

  return (
    <div className="border-b border-slate-200">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full p-4 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400" />
          )}
          <Compass className="w-4 h-4 text-indigo-500" />
          <span className="text-sm font-semibold text-slate-700">
            Related Subjects
          </span>
          {isLoading ? (
            <Loader2 className="w-3 h-3 text-indigo-400 animate-spin" />
          ) : (
            <span className="text-xs text-slate-400">({totalCount})</span>
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-3">
          {isLoading && totalCount === 0 && (
            <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
              <Loader2 className="w-3 h-3 animate-spin" />
              Identifying relevant subjects...
            </div>
          )}

          {/* Direct subjects */}
          {directSubjects.length > 0 && (
            <div>
              <div className="text-xs font-medium text-slate-500 mb-1.5 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-indigo-500" />
                Directly Relevant ({directSubjects.length})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {directSubjects.map((s) => (
                  <span
                    key={s.name}
                    title={s.reason}
                    className="inline-block px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full text-xs cursor-default hover:bg-indigo-100 transition-colors"
                  >
                    {s.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Tangential subjects */}
          {tangentialSubjects.length > 0 && (
            <div>
              <button
                onClick={(e) => { e.stopPropagation(); setShowTangential(!showTangential); }}
                className="text-xs font-medium text-slate-500 mb-1.5 flex items-center gap-1 hover:text-slate-700"
              >
                <Zap className="w-3 h-3 text-amber-500" />
                Tangential / Wildcard ({tangentialSubjects.length})
                {showTangential ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
              </button>
              {showTangential && (
                <div className="flex flex-wrap gap-1.5">
                  {tangentialSubjects.map((s) => (
                    <span
                      key={s.name}
                      title={s.reason}
                      className="inline-block px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs cursor-default hover:bg-amber-100 transition-colors"
                    >
                      {s.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {!isLoading && totalCount === 0 && onRetry && (
            <button
              onClick={onRetry}
              className="text-xs text-indigo-600 hover:text-indigo-800 underline"
            >
              Retry finding related subjects
            </button>
          )}
        </div>
      )}
    </div>
  );
}
