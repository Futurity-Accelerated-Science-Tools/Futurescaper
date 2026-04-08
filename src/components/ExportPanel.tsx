import React from 'react';
import { FutureInput, Consequence, Solution, STEEP_LABELS, HORIZON_LABELS, ORDER_LABELS, PROBABILITY_LABELS, TIMEFRAME_LABELS } from '../types';
import { Download, FileJson, FileText, Share2, FileSpreadsheet, LayoutDashboard } from 'lucide-react';
import { buildUnifiedExport } from '../api/miroExport';

interface ExportPanelProps {
  input: FutureInput;
  consequences: Consequence[];
  solutions?: Solution[];
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportPanel({ input, consequences, solutions = [] }: ExportPanelProps) {
  const slug = input.title.toLowerCase().replace(/\s+/g, '-');

  // Unified JSON: reloadable in applet + Miro-ready with radial positions
  const exportJSON = () => {
    const data = buildUnifiedExport(input, consequences, solutions);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `futurescape-${slug}.json`);
  };

  const exportMarkdown = () => {
    const byOrder: Record<number, Consequence[]> = {
      1: consequences.filter(c => c.order === 1),
      2: consequences.filter(c => c.order === 2),
      3: consequences.filter(c => c.order === 3),
      4: consequences.filter(c => c.order === 4),
      5: consequences.filter(c => c.order === 5),
    };

    let md = `# Futurescape Analysis: ${input.title}\n\n`;
    md += `**Generated:** ${new Date().toLocaleDateString()}\n`;
    md += `**Horizon:** ${HORIZON_LABELS[input.horizon]}\n`;
    md += `**Total Consequences:** ${consequences.length}\n`;
    md += `**Solutions Identified:** ${solutions.length}\n\n`;

    md += `## Scenario Description\n${input.description}\n\n`;
    md += `---\n\n`;

    // First Order
    if (byOrder[1].length > 0) {
      md += `## 1️⃣ First-Order Consequences (Direct Effects)\n`;
      md += `*Obvious, immediate impacts that flow directly from the scenario*\n\n`;
      byOrder[1].forEach(c => {
        const emoji = c.sentiment === 'positive' ? '✅' : c.sentiment === 'negative' ? '❌' : '➖';
        const prob = c.probability ? ` [${PROBABILITY_LABELS[c.probability]}]` : '';
        const time = c.timeFrame ? ` ⏱️${TIMEFRAME_LABELS[c.timeFrame]}` : '';
        md += `- ${emoji} **[${STEEP_LABELS[c.category]}]**${prob}${time}\n  ${c.text}\n\n`;
      });
    }

    // Second Order
    if (byOrder[2].length > 0) {
      md += `## 2️⃣ Second-Order Consequences (Ripple Effects)\n`;
      md += `*Cascading effects that emerge from first-order consequences*\n\n`;
      byOrder[2].forEach(c => {
        const emoji = c.sentiment === 'positive' ? '✅' : c.sentiment === 'negative' ? '❌' : '➖';
        const prob = c.probability ? ` [${PROBABILITY_LABELS[c.probability]}]` : '';
        md += `- ${emoji} **[${STEEP_LABELS[c.category]}]**${prob}\n  ${c.text}\n\n`;
      });
    }

    // Third Order (includes wildcards)
    if (byOrder[3].length > 0) {
      md += `## 3️⃣ Third-Order Consequences (Cascade Effects & Wildcards)\n`;
      md += `*Deeper systemic changes and surprising possibilities*\n\n`;
      byOrder[3].forEach(c => {
        const emoji = c.sentiment === 'positive' ? '✅' : c.sentiment === 'negative' ? '❌' : '➖';
        const wildcard = c.probability === 'wildcard' ? '🃏 ' : '';
        md += `- ${emoji} ${wildcard}**[${STEEP_LABELS[c.category]}]** ${c.text}\n`;
      });
      md += `\n`;
    }

    // Fourth Order
    if (byOrder[4].length > 0) {
      md += `## 4️⃣ Fourth-Order Consequences (Systemic Shifts)\n`;
      md += `*Deep structural transformations emerging from cascading effects*\n\n`;
      byOrder[4].forEach(c => {
        const emoji = c.sentiment === 'positive' ? '✅' : c.sentiment === 'negative' ? '❌' : '➖';
        const wildcard = c.probability === 'wildcard' ? '🃏 ' : '';
        md += `- ${emoji} ${wildcard}**[${STEEP_LABELS[c.category]}]** ${c.text}\n`;
      });
      md += `\n`;
    }

    // Fifth Order
    if (byOrder[5].length > 0) {
      md += `## 5️⃣ Fifth-Order Consequences (Paradigm Shifts)\n`;
      md += `*Fundamental paradigm changes and civilizational-level impacts*\n\n`;
      byOrder[5].forEach(c => {
        const emoji = c.sentiment === 'positive' ? '✅' : c.sentiment === 'negative' ? '❌' : '➖';
        const wildcard = c.probability === 'wildcard' ? '🃏 ' : '';
        md += `- ${emoji} ${wildcard}**[${STEEP_LABELS[c.category]}]** ${c.text}\n`;
      });
      md += `\n`;
    }

    // Solutions
    if (solutions.length > 0) {
      md += `---\n\n`;
      md += `## 💡 Proposed Solutions\n\n`;

      const macroSolutions = solutions.filter(s => s.type === 'macro');
      const microSolutions = solutions.filter(s => s.type === 'micro');

      if (macroSolutions.length > 0) {
        md += `### Macro-Level Solutions (Systemic/Policy)\n`;
        macroSolutions.forEach(s => {
          md += `- **[${STEEP_LABELS[s.category]}]** ${s.text}\n`;
          md += `  - Feasibility: ${s.feasibility} | Timeline: ${TIMEFRAME_LABELS[s.timeToImplement]}\n`;
        });
        md += `\n`;
      }

      if (microSolutions.length > 0) {
        md += `### Micro-Level Solutions (Individual/Community)\n`;
        microSolutions.forEach(s => {
          md += `- **[${STEEP_LABELS[s.category]}]** ${s.text}\n`;
          md += `  - Feasibility: ${s.feasibility} | Timeline: ${TIMEFRAME_LABELS[s.timeToImplement]}\n`;
        });
        md += `\n`;
      }
    }

    md += `---\n\n`;
    md += `*Generated with Futurescape using the "Synthesizing Futures" methodology*\n`;
    md += `*STEEP Framework: Social, Technological, Economic, Environmental, Political*`;

    const blob = new Blob([md], { type: 'text/markdown' });
    downloadBlob(blob, `futurescape-${slug}.md`);
  };

  const exportCSV = () => {
    // CSV header
    const headers = [
      'Order',
      'Category',
      'Sentiment',
      'Importance',
      'Probability',
      'TimeFrame',
      'Geographic Scope',
      'Consequence'
    ];

    // Build CSV rows
    const rows = consequences.map(c => [
      c.order,
      STEEP_LABELS[c.category],
      c.sentiment,
      c.importance || 'medium',
      c.probability ? PROBABILITY_LABELS[c.probability] : '',
      c.timeFrame ? TIMEFRAME_LABELS[c.timeFrame] : '',
      c.geographicScope || '',
      `"${c.text.replace(/"/g, '""')}"` // Escape quotes in CSV
    ]);

    // Add solutions section
    if (solutions.length > 0) {
      rows.push([]); // Empty row as separator
      rows.push(['--- SOLUTIONS ---', '', '', '', '', '', '', '']);
      rows.push(['Type', 'Category', 'Feasibility', 'Timeline', '', '', '', 'Solution']);
      solutions.forEach(s => {
        rows.push([
          s.type,
          STEEP_LABELS[s.category],
          s.feasibility,
          TIMEFRAME_LABELS[s.timeToImplement],
          '',
          '',
          '',
          `"${s.text.replace(/"/g, '""')}"`
        ]);
      });
    }

    const csvContent = [
      `# Futurescape Analysis: ${input.title}`,
      `# Generated: ${new Date().toISOString()}`,
      `# Horizon: ${HORIZON_LABELS[input.horizon]}`,
      '',
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, `futurescape-${slug}.csv`);
  };

  const copyShareLink = () => {
    // In a real app, this would generate a shareable URL
    const shareData = btoa(JSON.stringify({ input, consequences }));
    navigator.clipboard.writeText(`${window.location.origin}?data=${shareData.slice(0, 100)}...`);
    alert('Share link copied! (Demo only - full sharing requires backend)');
  };

  // Stats
  const stats = {
    total: consequences.length,
    positive: consequences.filter(c => c.sentiment === 'positive').length,
    negative: consequences.filter(c => c.sentiment === 'negative').length,
    neutral: consequences.filter(c => c.sentiment === 'neutral').length,
  };

  return (
    <div className="p-4 border-t border-slate-200 mt-auto">
      <div className="flex items-center gap-2 mb-4">
        <Download className="w-4 h-4 text-slate-500" />
        <h3 className="font-semibold text-slate-700">Export & Share</h3>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="text-center p-3 bg-slate-50 rounded-lg">
          <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
          <p className="text-xs text-slate-500">Consequences</p>
        </div>
        <div className="text-center p-3 bg-slate-50 rounded-lg">
          <p className="text-2xl font-bold text-slate-900">{solutions.length}</p>
          <p className="text-xs text-slate-500">Solutions</p>
        </div>
      </div>

      <div className="space-y-2">
        <button
          onClick={exportCSV}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg text-sm font-medium transition-colors"
        >
          <FileSpreadsheet className="w-4 h-4" />
          Export CSV (Excel)
        </button>
        <button
          onClick={exportJSON}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-sm font-medium transition-colors"
        >
          <LayoutDashboard className="w-4 h-4" />
          Export JSON (Miro + Reload)
        </button>
        <button
          onClick={exportMarkdown}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors"
        >
          <FileText className="w-4 h-4" />
          Export Report (MD)
        </button>
        <button
          onClick={copyShareLink}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-seed hover:bg-seed-dark text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Share2 className="w-4 h-4" />
          Copy Share Link
        </button>
      </div>
    </div>
  );
}
