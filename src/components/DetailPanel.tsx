import React, { useState } from 'react';
import { Consequence, STEEP_LABELS, STEEP_COLORS, getSentimentColors } from '../types';
import { TrendingUp, TrendingDown, Minus, X, Edit3, Trash2, Zap, Expand, Loader2, AlertTriangle, Lightbulb, Wrench } from 'lucide-react';

interface DetailPanelProps {
  consequence: Consequence | null;
  allConsequences: Consequence[];
  onClose: () => void;
  onEdit?: (id: string, newText: string) => void;
  onDelete?: (id: string) => void;
  onExpand?: (id: string) => void;
  onGenerateIdeas?: (id: string) => void;
  isExpanding?: boolean;
  isGeneratingIdeas?: boolean;
}

function DeleteSection({ consequence, children, onEdit, onDelete }: {
  consequence: Consequence;
  children: Consequence[];
  onEdit?: (id: string, newText: string) => void;
  onDelete?: (id: string) => void;
}) {
  const [showConfirm, setShowConfirm] = useState(false);
  const hasChildren = children.length > 0;

  return (
    <div className="pt-3 border-t border-slate-200">
      {showConfirm ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span className="text-sm font-medium text-red-700">Are you sure you want to delete this node?</span>
          </div>
          <p className="text-xs text-red-600 mb-3">This action cannot be undone.</p>
          <div className="flex gap-2">
            <button
              onClick={() => { onDelete?.(consequence.id); setShowConfirm(false); }}
              className="flex-1 py-1.5 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded-md transition-colors"
            >
              Yes, Delete
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              className="flex-1 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          {onEdit && (
            <button
              onClick={() => {
                const newText = prompt('Edit consequence:', consequence.text);
                if (newText) onEdit(consequence.id, newText);
              }}
              className="flex-1 flex items-center justify-center gap-2 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              <Edit3 className="w-4 h-4" /> Edit
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => hasChildren ? null : setShowConfirm(true)}
              disabled={hasChildren}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm rounded-lg transition-colors ${
                hasChildren
                  ? 'text-slate-400 cursor-not-allowed'
                  : 'text-negative hover:bg-negative-light'
              }`}
              title={hasChildren ? 'Remove child nodes first' : 'Delete this node'}
            >
              <Trash2 className="w-4 h-4" />
              {hasChildren ? 'Has Children' : 'Delete'}
            </button>
          )}
        </div>
      )}
      {hasChildren && !showConfirm && (
        <p className="text-xs text-slate-400 mt-1 text-center">Remove child nodes first to delete this node</p>
      )}
    </div>
  );
}

export function DetailPanel({ consequence, allConsequences, onClose, onEdit, onDelete, onExpand, onGenerateIdeas, isExpanding, isGeneratingIdeas }: DetailPanelProps) {
  if (!consequence) return null;

  const isSolutionOrIdea = consequence.nodeType === 'solution' || consequence.nodeType === 'idea';
  const solutionColors = { bg: '#fef9c3', border: '#eab308', text: '#854d0e' };
  const colors = isSolutionOrIdea ? solutionColors : getSentimentColors(consequence.sentiment);
  const steepColor = STEEP_COLORS[consequence.category];

  const SentimentIcon = isSolutionOrIdea
    ? (consequence.nodeType === 'idea' ? Lightbulb : Wrench)
    : consequence.sentiment === 'positive'
      ? TrendingUp
      : consequence.sentiment === 'negative'
        ? TrendingDown
        : Minus;

  // Find parent consequence
  const parent = consequence.parentId && consequence.parentId !== 'seed'
    ? allConsequences.find(c => c.id === consequence.parentId)
    : null;

  // Find child consequences
  const children = allConsequences.filter(c => c.parentId === consequence.id);

  const orderLabels = ['', 'First-Order', 'Second-Order', 'Third-Order'];

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-5 w-80 fade-in-up">
      <div className="flex items-start justify-between mb-4">
        <span
          className="steep-badge text-sm"
          style={{ backgroundColor: `${steepColor}20`, color: steepColor }}
        >
          {STEEP_LABELS[consequence.category]}
        </span>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div
        className="rounded-lg p-4 mb-4"
        style={{ backgroundColor: colors.bg, borderLeft: `4px solid ${colors.border}` }}
      >
        <div className="flex items-start gap-2">
          <SentimentIcon className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: colors.text }} />
          <div>
            {isSolutionOrIdea && consequence.title && (
              <p className="font-bold text-lg mb-1" style={{ color: colors.text }}>
                {consequence.title}
              </p>
            )}
            <p className="font-medium" style={{ color: colors.text }}>
              {consequence.text}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3 mb-4">
        {isSolutionOrIdea && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">Type:</span>
            <span className="font-medium text-amber-700 flex items-center gap-1">
              {consequence.nodeType === 'idea' ? <Lightbulb className="w-3.5 h-3.5" /> : <Wrench className="w-3.5 h-3.5" />}
              {consequence.nodeType === 'idea' ? 'Idea / Opportunity' : 'Solution / Mitigation'}
            </span>
          </div>
        )}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-500">Order:</span>
          <span className="font-medium text-slate-700">
            {orderLabels[consequence.order]}
            {consequence.probability === 'wildcard' && (
              <span className="inline-flex items-center gap-1 ml-2 text-purple-600">
                <Zap className="w-3 h-3" /> Wildcard
              </span>
            )}
          </span>
        </div>

        {!isSolutionOrIdea && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">Sentiment:</span>
            <span
              className="font-medium capitalize flex items-center gap-1"
              style={{ color: colors.text }}
            >
              <SentimentIcon className="w-4 h-4" />
              {consequence.sentiment}
            </span>
          </div>
        )}
      </div>

      {parent && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Caused By</p>
          <div
            className="text-sm p-2 rounded-lg"
            style={{
              backgroundColor: getSentimentColors(parent.sentiment).bg,
              color: getSentimentColors(parent.sentiment).text,
            }}
          >
            {parent.text}
          </div>
        </div>
      )}

      {children.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Leads To ({children.length})
          </p>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {children.map((child) => (
              <div
                key={child.id}
                className="text-sm p-2 rounded-lg"
                style={{
                  backgroundColor: getSentimentColors(child.sentiment).bg,
                  color: getSentimentColors(child.sentiment).text,
                }}
              >
                {child.text}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expand button - Generate more consequences from this node */}
      {onExpand && consequence.order < 3 && (
        <div className="mb-4">
          <button
            onClick={() => onExpand(consequence.id)}
            disabled={isExpanding || isGeneratingIdeas}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-white bg-seed hover:bg-seed-dark disabled:bg-slate-300 rounded-lg transition-colors"
          >
            {isExpanding ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Expand className="w-4 h-4" />
                Expand Node (Generate 3-4 More)
              </>
            )}
          </button>
          <p className="text-xs text-slate-500 mt-1 text-center">
            AI will generate more consequences from this node
          </p>
        </div>
      )}

      {/* Generate Ideas/Solutions button - only for consequence nodes */}
      {onGenerateIdeas && !isSolutionOrIdea && (
        <div className="mb-4">
          <button
            onClick={() => onGenerateIdeas(consequence.id)}
            disabled={isGeneratingIdeas || isExpanding}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-amber-800 bg-amber-100 hover:bg-amber-200 border border-amber-300 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 rounded-lg transition-colors"
          >
            {isGeneratingIdeas ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Lightbulb className="w-4 h-4" />
                {consequence.sentiment === 'negative' ? 'Generate Solutions' : consequence.sentiment === 'positive' ? 'Generate Ideas' : 'Generate Ideas & Solutions'}
              </>
            )}
          </button>
          <p className="text-xs text-slate-500 mt-1 text-center">
            {consequence.sentiment === 'negative' ? 'AI will suggest mitigations for this risk' : consequence.sentiment === 'positive' ? 'AI will suggest ways to capitalize on this' : 'AI will suggest ideas and solutions'}
          </p>
        </div>
      )}

      {(onEdit || onDelete) && (
        <DeleteSection
          consequence={consequence}
          children={children}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      )}
    </div>
  );
}
