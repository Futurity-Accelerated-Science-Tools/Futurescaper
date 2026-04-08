// Prompt engineering for Futurescape - based on "Synthesizing Futures" methodology

import { Consequence, Solution, STEEPCategory, Sentiment, ConsequenceOrder, FutureInput, TimeFrame, Probability, SolutionType, Importance } from '../types';

export const SYSTEM_PROMPT = `You are an expert futures analyst and geopolitical strategist trained in the "Synthesizing Futures" methodology. Your role is to comprehensively map the consequences of events, innovations, and geopolitical shifts using the STEEPE framework (Social, Technological, Economic, Environmental, Political, Ethical).

## Your Approach

You understand that:
- "Be careful what you wish for – and against. Every silver lining has its cloud, and vice versa."
- Changes are usually a mixed bag with both positive and negative consequences
- Consequences cascade through systems in complex ways
- Geographic scope matters: local, regional, and global impacts differ
- Time horizons matter: immediate, short-term, and long-term effects diverge
- Probability varies: some outcomes are near-certain, others are wildcards

## CRITICAL: Perspective Matters

**Positive/Negative/Neutral is ALWAYS from the specified perspective.** What benefits one actor may harm another:
- A military victory is positive for the victor, negative for the defeated
- Economic sanctions are positive for those seeking leverage, negative for those sanctioned
- Resource extraction may be positive economically but negative environmentally
- Always evaluate sentiment from the stakeholder perspective provided

## STEEPE Framework - Deep Analysis

When analyzing consequences, consider ALL dimensions:

**Social**:
- Consumer behavior, cultural shifts, demographic changes
- Religious/ideological movements, lifestyle changes, values shifts
- Media narratives, health impacts, education effects
- Community bonds, generational dynamics, migration patterns
- Public sentiment, social cohesion, identity politics

**Technological**:
- Military technology, cyber warfare, surveillance
- Communication systems, energy infrastructure, transportation
- Biotech implications, digital platforms, AI applications
- Space technology, legacy system vulnerabilities

**Economic**:
- Trade flows, sanctions, market volatility
- Employment shifts, currency impacts, investment patterns
- Resource prices, supply chains, startup ecosystem
- Tax implications, inflation, wealth distribution
- International debt, economic alliances, black markets

**Environmental**:
- Resource extraction, emissions, biodiversity
- Climate impacts, pollution, land use changes
- Arctic/Antarctic implications, ocean effects
- Agricultural shifts, water security
- Environmental migration, disaster risk

**Political**:
- International relations, alliance structures, treaty implications
- Domestic politics, election impacts, governance changes
- Regulatory responses, enforcement mechanisms
- Sovereignty issues, territorial disputes
- International institutions, diplomatic channels
- Military posturing, defense spending

**Ethical**:
- Moral dilemmas and philosophical tensions
- Fairness, equity, justice implications
- Human rights impacts, dignity concerns
- Consent and autonomy issues
- Responsibility and accountability gaps
- Bias, discrimination, and inclusion
- Intergenerational justice and long-term moral obligations
- Transparency and trust dynamics

## Geographic Scopes
- **Local**: Directly affected regions
- **Regional**: Europe, Americas, Asia-Pacific, etc.
- **Global**: Worldwide systemic effects

## Time Frames
- **Immediate**: Days to weeks
- **Short-term**: Months to 2 years
- **Long-term**: 2+ years

## Probability Levels (Voros Cone)
- **Probable**: >70% likelihood, almost certain given current trajectory
- **Plausible**: 30-70% likelihood, reasonable under certain conditions
- **Possible**: 10-30% likelihood, requires specific circumstances
- **Wildcard**: <10% likelihood, but high impact if occurs

## Output Format

Always return valid JSON arrays. Be specific, analytical, and comprehensive.`;

export function buildAnalysisPrompt(input: FutureInput): string {
  return `## Task: Analyze Input Scenario

First, analyze this scenario to understand its full scope and implications before generating consequences.

**Title:** ${input.title}
**Description:** ${input.description}
${input.sourceUrl ? `**Source URL:** ${input.sourceUrl}` : ''}
${input.sourceText ? `\n**Source Content:**\n${input.sourceText.slice(0, 4000)}` : ''}

Provide a brief analysis (2-3 paragraphs) covering:
1. Key actors and stakeholders involved
2. Historical context and precedents
3. Critical dimensions to explore (which STEEPE categories are most relevant)
4. Geographic regions most affected
5. Key uncertainties and variables

Return as plain text, not JSON.`;
}

export function buildFirstOrderPrompt(input: FutureInput): string {
  const perspectiveText = input.perspective
    ? `

## CRITICAL: PERSPECTIVE FOR SENTIMENT EVALUATION
**ALL sentiment ratings MUST be from the perspective of: ${input.perspective}**

This is NOT about objective "good" or "bad" - it's about what benefits or harms THIS SPECIFIC STAKEHOLDER.

Examples of correct perspective-based sentiment:
- "U.S. defense stocks surge" → If perspective is "EU Commission": sentiment = "NEGATIVE" (shows EU's weakened position/alliance fracture)
- "NATO alliance fractures" → If perspective is "EU Commission": sentiment = "NEGATIVE" (EU loses security)
- "Russia gains Arctic influence" → If perspective is "EU Commission": sentiment = "NEGATIVE" (strategic threat)
- "EU develops independent defense" → If perspective is "EU Commission": sentiment = "POSITIVE" (EU gains autonomy)
- "Arctic resources go to U.S." → If perspective is "EU Commission": sentiment = "NEGATIVE" (EU loses access)

**BEFORE assigning sentiment, ask: "Does this outcome HELP or HURT ${input.perspective}?"**
- "positive" = HELPS ${input.perspective}'s interests, goals, security, prosperity
- "negative" = HURTS ${input.perspective}'s interests, goals, security, prosperity
- "neutral" = Mixed impact OR doesn't significantly affect ${input.perspective}`
    : '';

  return `## Task: Generate First-Order Consequences (Direct & Immediate)

Analyze this scenario and identify **ALL obvious, direct, first-order consequences** across every STEEPE category and geographic scope.

**Title:** ${input.title}
**Description:** ${input.description}${perspectiveText}
${input.sourceText ? `\n**Context:**\n${input.sourceText.slice(0, 3000)}` : ''}

Generate **20-25 first-order consequences** with a MIX of:
- **Mundane/obvious** consequences (everyday impacts people would notice immediately)
- **Moderate** consequences (significant but expected developments)
- **Dramatic** consequences (major shifts that would make headlines)

Requirements:
1. Cover ALL 6 STEEPE categories (at least 4 per category)
2. Include positive, negative, AND neutral consequences (aim for balance)
3. Vary the timeFrame: mix of "immediate", "short-term", and "long-term"
4. Vary the probability: mostly "probable" and "plausible", some "possible"
5. Vary geographicScope: "local" (directly affected area), "regional" (Europe, Americas, etc.), "global"
6. Include an "importance" field: "critical" (game-changing), "high", "medium", or "low" (minor but notable)
7. Be SPECIFIC with concrete details, names of institutions, specific economic figures, etc.

Think about:
- What happens in the first 24 hours? First week? First month?
- How do different governments react?
- What do ordinary citizens experience?
- What markets and industries are affected?
- What military/security changes occur?

Return ONLY a JSON array:
[
  {
    "text": "Specific consequence with concrete details",
    "sentiment": "positive|negative|neutral",
    "category": "social|technological|economic|environmental|political|ethical",
    "timeFrame": "immediate|short-term|long-term",
    "probability": "probable|plausible|possible|wildcard",
    "geographicScope": "local|regional|global",
    "importance": "critical|high|medium|low"
  }
]`;
}

export function buildSecondOrderPrompt(
  input: FutureInput,
  firstOrderConsequences: Consequence[]
): string {
  const summary = firstOrderConsequences
    .map((c, i) => `${i + 1}. [${c.category.toUpperCase()}] ${c.text}`)
    .join('\n');

  const perspectiveText = input.perspective
    ? `

## CRITICAL: PERSPECTIVE FOR SENTIMENT
**ALL sentiment = from perspective of: ${input.perspective}**
- "positive" = HELPS ${input.perspective}
- "negative" = HURTS ${input.perspective}
- Ask: "Does this help or hurt ${input.perspective}?" before assigning sentiment.`
    : '';

  return `## Task: Generate Second-Order Consequences (Ripple Effects)

Build on the first-order consequences to uncover **second-order ripple effects** using deep STEEPE analysis.

**Original Scenario:** ${input.title}
${input.description}${perspectiveText}

**First-Order Consequences:**
${summary}

Generate **25-30 second-order consequences** with a MIX of radicality:
- **Mundane ripples** (bureaucratic responses, routine adjustments)
- **Moderate developments** (policy changes, market shifts)
- **Significant escalations** (alliance changes, major economic moves)
- **Unexpected connections** (surprising links between domains)

Requirements:
1. **CRITICAL: Each consequence MUST specify which first-order consequence (by number) it flows from using "parentIndex"**
2. Flow logically from first-order consequences
3. Show cross-domain effects (political → economic → social chains)
4. Reveal non-obvious connections that require STEEPE thinking
5. May flip sentiment (positive first-order → negative second-order)
6. Cover ALL geographic scopes and time horizons
7. Include "importance": "critical", "high", "medium", or "low"

Consider SPECIFICALLY:
- NATO Article 5 implications and alliance dynamics
- EU emergency meetings and responses
- China and Russia's strategic calculations
- UN Security Council proceedings
- Global stock market sectors affected
- Refugee and migration patterns
- Arctic shipping and resource access
- Military base realignments
- Intelligence agency activities
- Media narrative battles
- Citizen protests and movements
- Corporate relocations and investments

Return ONLY a JSON array:
[
  {
    "text": "Specific second-order consequence with concrete details",
    "sentiment": "positive|negative|neutral",
    "category": "social|technological|economic|environmental|political|ethical",
    "timeFrame": "immediate|short-term|long-term",
    "probability": "probable|plausible|possible|wildcard",
    "geographicScope": "local|regional|global",
    "importance": "critical|high|medium|low",
    "parentIndex": 1
  }
]

**IMPORTANT**: "parentIndex" must be the number (1-${firstOrderConsequences.length}) of the first-order consequence this flows from.`;
}

export function buildThirdOrderPrompt(
  input: FutureInput,
  allConsequences: Consequence[]
): string {
  const secondOrderList = allConsequences.filter(c => c.order === 2);
  const secondOrder = secondOrderList
    .slice(0, 25)
    .map((c, i) => `${i + 1}. [${c.category.toUpperCase()}] ${c.text}`)
    .join('\n');

  const perspectiveText = input.perspective
    ? `

## CRITICAL: PERSPECTIVE FOR SENTIMENT
**ALL sentiment = from perspective of: ${input.perspective}**
- "positive" = HELPS ${input.perspective}
- "negative" = HURTS ${input.perspective}
- Ask: "Does this help or hurt ${input.perspective}?" before assigning sentiment.`
    : '';

  return `## Task: Generate Third-Order Consequences (Cascade Effects & Wildcards)

Now identify **third-order cascade effects** - deeper systemic changes that emerge from accumulated consequences. This is the FINAL order, so also include some wildcards and surprising developments.

**Original Scenario:** ${input.title}${perspectiveText}

**Second-Order Consequences:**
${secondOrder}

Generate **10-15 third-order consequences** representing structural changes AND wildcards:

Include a MIX of:
- **Institutional adaptations** (new treaties, reformed organizations)
- **Economic restructuring** (new trade blocs, currency arrangements)
- **Social movements** (new political parties, civil society responses)
- **Technological pivots** (defense tech, surveillance, communication)
- **Environmental policies** (governance, resource management)
- **WILDCARDS** (3-5 surprising, counterintuitive, or black swan developments)

Requirements:
1. **CRITICAL: Each consequence MUST specify which second-order consequence (by number) it flows from using "parentIndex"**
2. Systemic changes to institutions and power structures
3. Shifts in alliance patterns and international order
4. Emergent social/political movements
5. Long-term economic restructuring
6. Technology development trajectories
7. Include "importance": "critical", "high", "medium", or "low"
8. Include 3-5 WILDCARDS with probability: "wildcard" - these are surprising, counterintuitive, or black swan possibilities

Think about 1-10 year timeframe:
- How does the international order reorganize?
- What new institutions or agreements emerge?
- How do economies adapt long-term?
- What cultural/social shifts occur?
- What technological races begin?
- What UNEXPECTED developments might occur? (wildcards)

Return ONLY a JSON array:
[
  {
    "text": "Specific third-order consequence",
    "sentiment": "positive|negative|neutral",
    "category": "social|technological|economic|environmental|political|ethical",
    "timeFrame": "immediate|short-term|long-term",
    "probability": "probable|plausible|possible|wildcard",
    "geographicScope": "local|regional|global",
    "importance": "critical|high|medium|low",
    "parentIndex": 1
  }
]

**IMPORTANT**: "parentIndex" must be the number (1-${Math.min(secondOrderList.length, 25)}) of the second-order consequence this flows from.`;
}

export function buildFourthOrderPrompt(
  input: FutureInput,
  allConsequences: Consequence[]
): string {
  const thirdOrder = allConsequences
    .filter(c => c.order === 3)
    .slice(0, 15)
    .map(c => `- [${c.category.toUpperCase()}] ${c.text}`)
    .join('\n');

  const perspectiveText = input.perspective
    ? `\n**PERSPECTIVE:** Continue evaluating from the perspective of: **${input.perspective}**`
    : '';

  return `## Task: Generate Fourth-Order Consequences (Systemic Transformation)

Identify **fourth-order systemic transformations** - fundamental changes to the world order, economies, and societies.

**Original Scenario:** ${input.title}${perspectiveText}

**Third-Order Consequences:**
${thirdOrder}

Generate **15-20 fourth-order consequences** representing the NEW NORMAL (5-20 year horizon):

Include a MIX:
- **Mundane new realities** (changed travel patterns, new curricula in schools)
- **Institutional transformations** (reformed UN, new alliance structures)
- **Economic paradigm shifts** (new reserve currencies, trade patterns)
- **Cultural/generational changes** (new values, identity shifts)
- **Technological regimes** (new infrastructure, defense systems)

Requirements:
1. New world order configurations
2. Fundamental shifts in how nations interact
3. Paradigm shifts in governance and sovereignty
4. Deep cultural and ideological transformations
5. Include "importance": "critical", "high", "medium", or "low"

Think about what a history textbook would say happened:
- How did the global order change?
- What new powers emerged?
- What ideologies gained/lost ground?
- How did people's daily lives change?
- What became normalized that was once unthinkable?

Return ONLY a JSON array:
[
  {
    "text": "Specific fourth-order systemic transformation",
    "sentiment": "positive|negative|neutral",
    "category": "social|technological|economic|environmental|political|ethical",
    "timeFrame": "immediate|short-term|long-term",
    "probability": "probable|plausible|possible|wildcard",
    "geographicScope": "local|regional|global",
    "importance": "critical|high|medium|low"
  }
]`;
}

export function buildFifthOrderPrompt(
  input: FutureInput,
  allConsequences: Consequence[]
): string {
  const summary = allConsequences
    .filter(c => c.order >= 3)
    .slice(0, 20)
    .map(c => `- ${c.text}`)
    .join('\n');

  const perspectiveText = input.perspective
    ? `\n**PERSPECTIVE:** Continue evaluating from the perspective of: **${input.perspective}**`
    : '';

  return `## Task: Generate Fifth-Order Consequences (Wildcards & Unknown Unknowns)

Now introduce **wildcards and unknown unknowns** - surprising, emergent, or preposterous-seeming possibilities.

**Original Scenario:** ${input.title}${perspectiveText}

**Higher-Order Consequences So Far:**
${summary}

Generate **15-20 fifth-order "wildcard" consequences** ranging from:
- **Mildly surprising** (unexpected but plausible developments)
- **Counterintuitive** (outcomes opposite to what most expect)
- **Black swans** (rare but high-impact events)
- **Preposterous-seeming** (things that sound crazy but have historical precedent)

Requirements:
1. Introduce elements of surprise or unpredictability
2. Consider black swan events or tipping points
3. Explore convergence with unrelated trends (AI, climate, demographics, etc.)
4. Include counter-movements and backlash scenarios
5. Consider what would seem "crazy" today
6. All should have probability: "wildcard" or "possible"
7. Include "importance": mostly "critical" or "high" (wildcards are high-impact by definition)

Creative prompts:
- What if this combined with a climate crisis?
- What unexpected alliance could form?
- What technology might be invented in response?
- What historical pattern might repeat? (1914? 1989? 1648?)
- What religious or ideological movement might emerge?
- What if the response backfires spectacularly?
- What if this triggers something completely unrelated?
- What would make this look trivial in hindsight?

Return ONLY a JSON array:
[
  {
    "text": "Specific wildcard consequence - be creative and bold",
    "sentiment": "positive|negative|neutral",
    "category": "social|technological|economic|environmental|political|ethical",
    "timeFrame": "immediate|short-term|long-term",
    "probability": "wildcard",
    "geographicScope": "local|regional|global",
    "importance": "critical|high|medium|low"
  }
]`;
}

export function buildSolutionsPrompt(
  input: FutureInput,
  consequences: Consequence[]
): string {
  const negativeConsequences = consequences
    .filter(c => c.sentiment === 'negative')
    .slice(0, 20)
    .map(c => `- [${c.category.toUpperCase()}/${c.order}] ${c.text}`)
    .join('\n');

  return `## Task: Generate Solutions (Macro & Micro Interventions)

Based on the negative consequences identified, propose **practical solutions** at both macro and micro levels.

**Original Scenario:** ${input.title}

**Key Negative Consequences to Address:**
${negativeConsequences}

Generate 12-15 solutions including:

**MACRO solutions** (systemic, policy-level, institutional):
- International agreements or treaties
- National policy changes
- Institutional reforms
- Large-scale economic interventions
- Infrastructure investments

**MICRO solutions** (individual, community, organizational):
- Personal preparedness actions
- Community resilience strategies
- Business adaptation strategies
- Civil society initiatives
- Local governance responses

For each solution, specify:
- type: "macro" or "micro"
- category: which STEEPE category it addresses
- feasibility: "high", "medium", or "low"
- timeToImplement: "immediate", "short-term", or "long-term"

Return ONLY a JSON array:
[
  {
    "text": "Specific actionable solution",
    "type": "macro|micro",
    "category": "social|technological|economic|environmental|political|ethical",
    "feasibility": "high|medium|low",
    "timeToImplement": "immediate|short-term|long-term"
  }
]`;
}

// Parse and validate API response for consequences
export function parseConsequencesResponse(
  response: string,
  order: ConsequenceOrder,
  defaultParentId: string,
  previousOrderConsequences: Consequence[] = []
): Consequence[] {
  try {
    let jsonStr = response;
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    const parsed = JSON.parse(jsonStr);

    if (!Array.isArray(parsed)) {
      throw new Error('Response is not an array');
    }

    const validCategories: STEEPCategory[] = ['social', 'technological', 'economic', 'environmental', 'political', 'ethical'];
    const validSentiments: Sentiment[] = ['positive', 'negative', 'neutral'];
    const validTimeFrames: TimeFrame[] = ['immediate', 'short-term', 'long-term'];
    const validProbabilities: Probability[] = ['probable', 'plausible', 'possible', 'wildcard'];
    const validImportance: Importance[] = ['critical', 'high', 'medium', 'low'];

    console.log(`[Order ${order}] Parsing ${parsed.length} consequences, previousOrder has ${previousOrderConsequences.length} items`);

    return parsed
      .filter((item: any) =>
        item.text &&
        validCategories.includes(item.category) &&
        validSentiments.includes(item.sentiment)
      )
      .map((item: any, index: number) => {
        // Use parentIndex from AI if available and valid, otherwise fallback to cycling
        let parentId = defaultParentId;
        if (order > 1 && previousOrderConsequences.length > 0) {
          const parentIndex = item.parentIndex;
          console.log(`[Order ${order}] Item ${index}: parentIndex=${parentIndex}`);
          if (parentIndex && parentIndex >= 1 && parentIndex <= previousOrderConsequences.length) {
            parentId = previousOrderConsequences[parentIndex - 1].id;
          } else {
            // Fallback: distribute evenly among parents
            parentId = previousOrderConsequences[index % previousOrderConsequences.length]?.id || defaultParentId;
            console.log(`[Order ${order}] Item ${index}: No valid parentIndex, using fallback: ${parentId}`);
          }
        }

        return {
          id: `c${order}-${Date.now()}-${index}`,
          text: item.text,
          sentiment: item.sentiment as Sentiment,
          category: item.category as STEEPCategory,
          order,
          parentId,
          timeFrame: validTimeFrames.includes(item.timeFrame) ? item.timeFrame : 'short-term',
          probability: validProbabilities.includes(item.probability) ? item.probability : 'plausible',
          geographicScope: ['local', 'regional', 'global'].includes(item.geographicScope) ? item.geographicScope : 'regional',
          importance: validImportance.includes(item.importance) ? item.importance : 'medium',
        };
      });
  } catch (error) {
    console.error('Failed to parse consequences response:', error);
    return [];
  }
}

// Parse solutions response
export function parseSolutionsResponse(response: string): Solution[] {
  try {
    let jsonStr = response;
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    const parsed = JSON.parse(jsonStr);

    if (!Array.isArray(parsed)) {
      throw new Error('Response is not an array');
    }

    const validCategories: STEEPCategory[] = ['social', 'technological', 'economic', 'environmental', 'political', 'ethical'];
    const validTypes: SolutionType[] = ['macro', 'micro'];
    const validTimeFrames: TimeFrame[] = ['immediate', 'short-term', 'long-term'];

    return parsed
      .filter((item: any) =>
        item.text &&
        validCategories.includes(item.category) &&
        validTypes.includes(item.type)
      )
      .map((item: any, index: number) => ({
        id: `sol-${Date.now()}-${index}`,
        text: item.text,
        type: item.type as SolutionType,
        category: item.category as STEEPCategory,
        targetConsequenceIds: [],
        feasibility: ['high', 'medium', 'low'].includes(item.feasibility) ? item.feasibility : 'medium',
        timeToImplement: validTimeFrames.includes(item.timeToImplement) ? item.timeToImplement : 'short-term',
      }));
  } catch (error) {
    console.error('Failed to parse solutions response:', error);
    return [];
  }
}
