import {
  Consequence,
  Solution,
  FutureInput,
  GraphStatistics,
  StructuralInsights,
  ReportData,
  ReportSection,
  ReportSubSection,
  InsightCard,
  IdeaRecommendation,
  STEEP_LABELS,
  HORIZON_LABELS,
  STEEPCategory,
} from '../types';
import { RelevantSubject } from './subjects';
import { callAPI } from './claude';

// ── Helpers ──────────────────────────────────────────────────────

function formatConsequenceForPrompt(c: Consequence): string {
  const meta = [
    c.sentiment,
    c.category,
    c.importance || 'medium',
    c.probability || 'plausible',
  ].join('/');
  const nodeType = c.nodeType === 'idea' ? ' [IDEA]' : c.nodeType === 'solution' ? ' [SOLUTION]' : '';
  return `[${c.id}] (${meta}, order ${c.order})${nodeType} ${c.text}`;
}

function buildStatsSummaryForPrompt(stats: GraphStatistics): string {
  const catBreakdown = (Object.entries(stats.byCategory) as [STEEPCategory, number][])
    .filter(([, n]) => n > 0)
    .map(([cat, n]) => `${STEEP_LABELS[cat]}: ${n}`)
    .join(', ');

  return `## Graph Statistics
- Total consequences: ${stats.totalConsequences}
- Total solutions: ${stats.totalSolutions}
- Sentiment: ${stats.bySentiment.positive} positive, ${stats.bySentiment.negative} negative, ${stats.bySentiment.neutral} neutral
- Categories: ${catBreakdown}
- Wildcards: ${stats.wildcardCount}
- Critical/high-importance negative consequences: ${stats.criticalNegativeCount}
- Unsolved consequences (no solutions): ${stats.unsolvedConsequenceIds.length}
- Cascading risk chains: ${stats.cascadingRiskChains.length}`;
}

function buildStructuralInsightsForPrompt(
  insights: StructuralInsights,
  consequences: Consequence[],
): string {
  const byId = new Map(consequences.map(c => [c.id, c]));
  const getText = (id: string) => byId.get(id)?.text?.slice(0, 80) || id;

  const parts: string[] = ['## Structural Insights (algorithmically detected)'];

  // Convergence points
  if (insights.convergencePoints.length > 0) {
    parts.push('\n### Convergence Points (multiple paths lead here):');
    for (const cp of insights.convergencePoints.slice(0, 5)) {
      const node = byId.get(cp.nodeId);
      if (node) {
        parts.push(`- [${cp.nodeId}] "${getText(cp.nodeId)}" — ${cp.parentCount} parent paths converge here`);
      }
    }
  }

  // Leverage points
  if (insights.leveragePoints.length > 0) {
    parts.push('\n### Leverage Points (addressing these prevents the most downstream negative effects):');
    for (const lp of insights.leveragePoints.slice(0, 5)) {
      parts.push(`- [${lp.nodeId}] "${getText(lp.nodeId)}" — ${lp.negativeDescendantCount} negative descendants`);
    }
  }

  // Sentiment inversions
  if (insights.sentimentInversions.length > 0) {
    parts.push('\n### Sentiment Inversions (chains where sentiment flips):');
    for (const inv of insights.sentimentInversions.slice(0, 5)) {
      const chainText = inv.chain.map(id => {
        const n = byId.get(id);
        return n ? `${n.sentiment === 'positive' ? '+' : n.sentiment === 'negative' ? '-' : '~'}"${getText(id)}"` : id;
      }).join(' → ');
      parts.push(`- ${inv.direction}: ${chainText}`);
    }
  }

  // Blind spots
  if (insights.blindSpotCategories.length > 0) {
    parts.push(`\n### Blind Spots (underrepresented categories): ${insights.blindSpotCategories.map(c => STEEP_LABELS[c]).join(', ')}`);
  }

  // Cross-domain bridges
  if (insights.crossDomainBridges.length > 0) {
    parts.push('\n### Cross-Domain Bridges (consequences that ripple across categories):');
    for (const b of insights.crossDomainBridges.slice(0, 5)) {
      parts.push(`- [${b.nodeId}] "${getText(b.nodeId)}" (${STEEP_LABELS[b.category]}) → children span: ${b.childCategories.map(c => STEEP_LABELS[c]).join(', ')}`);
    }
  }

  return parts.join('\n');
}

// ── AI Synthesis (Layer 3) ──────────────────────────────────────

interface AIReportOutput {
  executiveSummary: string;
  insightCards: InsightCard[];
  ideaRecommendations: IdeaRecommendation[];
  riskNarrative: string;
  riskHighlightIds: string[];
  opportunityNarrative: string;
  opportunityHighlightIds: string[];
}

async function generateAISynthesis(
  input: FutureInput,
  consequences: Consequence[],
  solutions: Solution[],
  subjects: RelevantSubject[],
  stats: GraphStatistics,
  insights: StructuralInsights,
  onProgress?: (msg: string) => void,
): Promise<AIReportOutput> {
  onProgress?.('Synthesizing report...');

  const nodes = consequences
    .filter(c => !c.nodeType || c.nodeType === 'consequence')
    .slice(0, 60);
  const ideaNodes = consequences.filter(c => c.nodeType === 'idea' || c.nodeType === 'solution');

  const consequenceList = nodes.map(formatConsequenceForPrompt).join('\n');
  const ideaList = ideaNodes.length > 0
    ? ideaNodes.map(formatConsequenceForPrompt).join('\n')
    : 'No idea/solution nodes on the map yet.';

  const solutionList = solutions.length > 0
    ? solutions.map(s => `- [${s.id}] [${s.type}/${s.category}] ${s.text} (feasibility: ${s.feasibility}, targets: ${s.targetConsequenceIds.join(', ')})`).join('\n')
    : 'No solutions generated yet.';

  const subjectList = subjects.length > 0
    ? subjects.slice(0, 15).map(s => `- ${s.name} (${s.relevance}): ${s.reason}`).join('\n')
    : '';

  const highRiskNodes = stats.highRiskIds
    .map(id => consequences.find(c => c.id === id))
    .filter(Boolean)
    .slice(0, 10)
    .map(c => `- [${c!.id}] ${c!.text} (${c!.category}, ${c!.probability || 'plausible'})`)
    .join('\n');

  const chainDescriptions = stats.cascadingRiskChains.slice(0, 5).map(chain => {
    const texts = chain
      .map(id => consequences.find(c => c.id === id))
      .filter(Boolean)
      .map(c => `[${c!.id}] ${c!.text.slice(0, 60)}`);
    return `  ${texts.join(' → ')}`;
  }).join('\n');

  const structuralBlock = buildStructuralInsightsForPrompt(insights, consequences);

  // Build ID examples from actual data so the prompt matches the real format
  const idExamples = nodes.slice(0, 3).map(c => c.id);
  const exId = idExamples[0] || 'c1-1699482019384-0';

  const prompt = `You are writing a futures analysis report for the following scenario.

## ⚠ MANDATORY: Consequence ID Format
Every consequence below has an ID in brackets like [${exId}]. When you reference a consequence in ANY text field, you MUST use its EXACT ID wrapped in parentheses. Examples of CORRECT usage:
- "regulatory fragmentation (${exId}) creates downstream pressure"
- "this converges with insurance cost increases (${idExamples[1] || 's-1'})"
DO NOT invent your own IDs. DO NOT abbreviate or modify IDs in any way. Copy them character-for-character from the consequence list below. The UI renders these as interactive elements — incorrect IDs will break the UI.

## Scenario
Title: ${input.title}
Description: ${input.description}
Time Horizon: ${HORIZON_LABELS[input.horizon]}
${input.perspective ? `Perspective: ${input.perspective}` : ''}

${buildStatsSummaryForPrompt(stats)}

## All Consequences (up to 60):
${consequenceList}

## Existing Ideas/Solutions on the map:
${ideaList}

## Solutions:
${solutionList}

## Related Subjects:
${subjectList}

## High-Risk Consequences (critical/high importance + negative):
${highRiskNodes || 'None identified.'}

## Cascading Risk Chains:
${chainDescriptions || 'None identified.'}

${structuralBlock}

---

You must return a single JSON object with these fields:

### 1. executiveSummary (string)
2-3 tight paragraphs. What are the dominant dynamics? What's the balance of risk vs opportunity? What should a decision-maker take away? Use paragraph breaks (\\n\\n).

### 2. insightCards (array of 3-5 objects)
Each insight card surfaces something the user can't see by just looking at the map. Use the structural insights above as a foundation. Each card has:
- "type": one of "critical-risk", "hidden-opportunity", "convergence-warning", "sentiment-inversion", "blind-spot", "cross-domain-bridge", "leverage-point"
- "title": a short, punchy title (5-10 words)
- "description": 2-3 sentences explaining why this matters and what to do about it
- "consequenceIds": array of 1-3 consequence IDs that are most relevant

Try to include a variety of insight types. Prioritize: the most critical risk, a key sentiment inversion or convergence, a hidden opportunity, and a blind spot or leverage point.

### 3. ideaRecommendations (array of 1-3 objects)
Actionable ideas. PREFER existing ideas/solutions from the map when they address one of the insight cards. If an existing idea could be improved to better address an insight, note that. Only suggest a brand-new idea if there's a clear gap — e.g., an insight card with no existing idea addressing it.
Each recommendation has:
- "title": short actionable title
- "description": 2-3 sentences on what to do and why
- "addressesInsight": which insight card title this addresses
- "feasibility": "high", "medium", or "low"
- "isExisting": true if this is based on an existing idea/solution node
- "existingNodeId": the ID if isExisting is true, otherwise omit

### 4. riskNarrative (string)
2-3 paragraphs analyzing the risk landscape. Reference specific consequences. Use paragraph breaks (\\n\\n).

### 5. riskHighlightIds (array of strings)
3-6 consequence IDs for the most critical risks to show as callout cards.

### 6. opportunityNarrative (string)
2-3 paragraphs analyzing positive consequences and opportunities. Reference specific consequences. Use paragraph breaks (\\n\\n).

### 7. opportunityHighlightIds (array of strings)
3-6 consequence IDs for the most important opportunities to show as callout cards.

## Response Format
\`\`\`json
{
  "executiveSummary": "...",
  "insightCards": [...],
  "ideaRecommendations": [...],
  "riskNarrative": "...",
  "riskHighlightIds": [...],
  "opportunityNarrative": "...",
  "opportunityHighlightIds": [...]
}
\`\`\`

Be specific, analytical, grounded in the data.

## ⚠ REMINDER: Use EXACT consequence IDs from the list above — e.g. (${exId}).
Each prose paragraph should reference 2-4 specific consequences by their exact IDs in parentheses.

## Tone and Style
Write in a formal, professional register suitable for a strategy briefing or policy advisory document. Use precise, measured language. Avoid:
- Casual phrasing ("The opportunity set is real", "This is a big deal")
- Colloquialisms or conversational tone
- Rhetorical flourishes or dramatic language
- Vague qualitative assertions without grounding in the data
Prefer: declarative analytical statements, conditional language where appropriate ("should", "would likely", "may require"), and specific references to consequences by their full IDs in parentheses.`;

  const response = await callAPI(
    [{ role: 'user', content: prompt }],
    'You are a senior futures analyst at a strategic advisory firm, writing a formal scenario analysis report for institutional decision-makers. Maintain a professional, measured tone throughout. Surface non-obvious insights from the structural analysis. Be specific, precise, and actionable.',
    12000,
  );

  try {
    const jsonMatch = response.match(/```json\s*([\s\S]*?)```/) || response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in report response');

    const jsonStr = jsonMatch[1] || jsonMatch[0];
    const parsed = JSON.parse(jsonStr);

    // Valid IDs for filtering
    const validIds = new Set(consequences.map(c => c.id));
    const filterIds = (ids: string[]) => (ids || []).filter(id => validIds.has(id));

    return {
      executiveSummary: parsed.executiveSummary || 'Report generation encountered an error.',
      insightCards: (parsed.insightCards || []).map((card: any) => ({
        type: card.type || 'critical-risk',
        title: card.title || 'Insight',
        description: card.description || '',
        consequenceIds: filterIds(card.consequenceIds),
      })),
      ideaRecommendations: (parsed.ideaRecommendations || []).map((idea: any) => ({
        title: idea.title || 'Recommendation',
        description: idea.description || '',
        addressesInsight: idea.addressesInsight || '',
        feasibility: idea.feasibility || 'medium',
        isExisting: idea.isExisting || false,
        existingNodeId: idea.isExisting && idea.existingNodeId && validIds.has(idea.existingNodeId) ? idea.existingNodeId : undefined,
      })),
      riskNarrative: parsed.riskNarrative || '',
      riskHighlightIds: filterIds(parsed.riskHighlightIds),
      opportunityNarrative: parsed.opportunityNarrative || '',
      opportunityHighlightIds: filterIds(parsed.opportunityHighlightIds),
    };
  } catch (err) {
    console.error('Failed to parse report response:', err, response);
    return {
      executiveSummary: 'Report generation encountered an error. Please try again.',
      insightCards: [],
      ideaRecommendations: [],
      riskNarrative: '',
      riskHighlightIds: [],
      opportunityNarrative: '',
      opportunityHighlightIds: [],
    };
  }
}

// ── Statistics Section (Layer 1 → report format) ────────────────

function buildStatisticsSection(stats: GraphStatistics): ReportSection {
  const subsections: ReportSubSection[] = [];

  subsections.push({
    id: 'category-distribution',
    title: 'STEEPE Category Distribution',
    type: 'distribution',
    content: `Consequences span ${Object.values(stats.byCategory).filter(n => n > 0).length} of 6 STEEPE categories.`,
    data: Object.fromEntries(
      (Object.entries(stats.byCategory) as [STEEPCategory, number][])
        .filter(([, n]) => n > 0)
        .map(([cat, n]) => [STEEP_LABELS[cat], n])
    ),
  });

  subsections.push({
    id: 'sentiment-balance',
    title: 'Sentiment Balance',
    type: 'distribution',
    content: `${stats.bySentiment.positive} positive, ${stats.bySentiment.negative} negative, ${stats.bySentiment.neutral} neutral.`,
    data: {
      'Positive': stats.bySentiment.positive,
      'Negative': stats.bySentiment.negative,
      'Neutral': stats.bySentiment.neutral,
    },
  });

  const activeOrders = Object.entries(stats.byOrder).filter(([, n]) => n > 0);
  subsections.push({
    id: 'order-depth',
    title: 'Causal Depth',
    type: 'distribution',
    content: `Analysis reaches ${activeOrders.length} orders of consequences.`,
    data: Object.fromEntries(activeOrders.map(([order, n]) => [`Order ${order}`, n])),
  });

  subsections.push({
    id: 'risk-metrics',
    title: 'Risk Indicators',
    type: 'text',
    content: [
      `Critical/high-importance negative consequences: ${stats.criticalNegativeCount}`,
      `Wildcard scenarios: ${stats.wildcardCount}`,
      `Cascading risk chains: ${stats.cascadingRiskChains.length}`,
      `Unsolved consequences (no solutions): ${stats.unsolvedConsequenceIds.length} of ${stats.totalConsequences}`,
    ].join('\n'),
  });

  return {
    id: 'statistics',
    title: 'Statistical Breakdown',
    icon: 'BarChart3',
    type: 'statistics',
    content: `${stats.totalConsequences} consequences and ${stats.totalSolutions} solutions analyzed.`,
    subsections,
  };
}

// ── Methodology Section (templated) ─────────────────────────────

function buildMethodologySection(
  input: FutureInput,
  stats: GraphStatistics,
  subjectCount: number,
  insights: StructuralInsights,
): ReportSection {
  const content = [
    `This report was generated using Futurescaper's consequence mapping methodology. The analysis examined the scenario "${input.title}" over a ${HORIZON_LABELS[input.horizon]} time horizon.`,
    '',
    `The consequence map contains ${stats.totalConsequences} consequences across ${Object.values(stats.byOrder).filter(n => n > 0).length} causal orders, with ${stats.totalSolutions} solutions identified. ${subjectCount} related technology and innovation subjects were linked to specific consequences for cross-domain analysis.`,
    '',
    `Structural analysis detected ${insights.convergencePoints.length} convergence points, ${insights.leveragePoints.length} leverage points, ${insights.sentimentInversions.length} sentiment inversions, ${insights.crossDomainBridges.length} cross-domain bridges, and ${insights.blindSpotCategories.length} blind spot categories.`,
    '',
    `Consequences were classified by STEEPE category, sentiment, probability, importance, and time frame. Insight cards and idea recommendations were synthesized by AI from the full consequence map and structural analysis. Statistical breakdowns are computed algorithmically.`,
  ].join('\n');

  return {
    id: 'methodology',
    title: 'Methodology & Data Sources',
    icon: 'BookOpen',
    type: 'methodology',
    content,
  };
}

// ── Main Report Pipeline ────────────────────────────────────────

export async function generateReport(
  input: FutureInput,
  consequences: Consequence[],
  solutions: Solution[],
  subjects: RelevantSubject[],
  stats: GraphStatistics,
  insights: StructuralInsights,
  onProgress?: (msg: string) => void,
): Promise<ReportData> {
  // Layer 3: AI synthesis (now includes insight cards + idea recommendations)
  const ai = await generateAISynthesis(
    input, consequences, solutions, subjects, stats, insights, onProgress,
  );

  // Build sections
  const sections: ReportSection[] = [
    {
      id: 'executive-summary',
      title: 'Executive Summary',
      icon: 'FileText',
      type: 'ai-prose',
      content: ai.executiveSummary,
    },
    {
      id: 'key-risks',
      title: 'Key Risks & Wildcards',
      icon: 'AlertTriangle',
      type: 'ai-prose',
      content: ai.riskNarrative,
      highlightedConsequenceIds: ai.riskHighlightIds,
    },
    {
      id: 'opportunities',
      title: 'Opportunities & Recommendations',
      icon: 'Lightbulb',
      type: 'ai-prose',
      content: ai.opportunityNarrative,
      highlightedConsequenceIds: ai.opportunityHighlightIds,
    },
    buildStatisticsSection(stats),
    buildMethodologySection(input, stats, subjects.length, insights),
  ];

  return {
    generatedAt: new Date().toISOString(),
    input,
    statistics: stats,
    structuralInsights: insights,
    sections,
    insightCards: ai.insightCards,
    ideaRecommendations: ai.ideaRecommendations,
    consequences,
    subjects,
  };
}
