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

export function buildSystemPrompt(verbosity?: 'concise' | 'detailed'): string {
  let prompt = SYSTEM_PROMPT;
  if (verbosity === 'detailed') {
    prompt += '\n\nProvide 2-3 detailed sentences per item (consequences, solutions, and ideas) with specific examples and concrete details.';
  } else {
    prompt += '\n\nKeep each item description (consequences, solutions, and ideas) to 1 short sentence (under 15 words).';
  }
  return prompt;
}

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

// Build horizon-aware time frame instructions
function getHorizonBias(horizon: string | undefined): string {
  switch (horizon) {
    case 'near':
      return `
## TIME HORIZON BIAS: NEAR-TERM (1-3 years)
Focus consequences on the **immediate and short-term** future:
- At least 4 out of 6 consequences should have timeFrame "immediate" or "short-term"
- At most 2 may be "long-term" — and only if they're clearly triggered within 1-3 years
- Think about what happens in the first days, weeks, and months
- Prioritize consequences that would unfold within 1-3 years`;
    case 'far':
      return `
## TIME HORIZON BIAS: FAR-FUTURE (10+ years)
Focus consequences on **long-term structural changes**:
- At least 4 out of 6 consequences should have timeFrame "long-term"
- At most 2 may be "immediate" or "short-term" — only if they're catalysts for the long-term shift
- Think about paradigm shifts, generational changes, and institutional transformations
- Prioritize consequences that unfold over a decade or more`;
    case 'medium':
    default:
      return `
## TIME HORIZON: BALANCED (3-10 years)
Distribute consequences across all time frames:
- Include a mix of "immediate", "short-term", and "long-term" timeFrames
- Aim for roughly equal distribution across time horizons`;
  }
}

export function buildFirstOrderPrompt(input: FutureInput, count?: number, existingSiblings?: Consequence[]): string {
  const horizonText = getHorizonBias(input.horizon);
  const perspectiveText = input.perspective
    ? `

## CRITICAL: PERSPECTIVE — ${input.perspective}
**This entire analysis is conducted FROM THE VIEWPOINT of: ${input.perspective}**

### Content Framing
Generate consequences that are RELEVANT and MATERIAL to "${input.perspective}". At least 70% of consequences should directly affect this stakeholder's operations, strategy, market position, or interests. The remaining 30% can cover broader societal consequences, but EVEN THESE should be framed in terms of how they impact "${input.perspective}".

Ask yourself for each consequence: "Would ${input.perspective} care about this? Would this come up in their strategic planning?" If not, replace it with something they WOULD care about.

### Sentiment Evaluation
**ALL sentiment ratings MUST be from the perspective of: ${input.perspective}**

This is NOT about objective "good" or "bad" - it's about what benefits or harms THIS SPECIFIC STAKEHOLDER.

**BEFORE assigning sentiment, ask: "Does this outcome HELP or HURT ${input.perspective}?"**
- "positive" = HELPS ${input.perspective}'s interests, goals, security, prosperity
- "negative" = HURTS ${input.perspective}'s interests, goals, security, prosperity
- "neutral" = Mixed impact OR doesn't significantly affect ${input.perspective}`
    : '';

  return `## Task: Generate First-Order Consequences (Direct & Immediate)

Analyze this scenario and identify **ALL obvious, direct, first-order consequences** across every STEEPE category and geographic scope.

**Title:** ${input.title}
**Description:** ${input.description}${perspectiveText}${horizonText}
${input.sourceText ? `\n**Context:**\n${input.sourceText.slice(0, 3000)}` : ''}

Generate **exactly ${count ? count : 6} first-order consequences**${!count || count === 6 ? ' — exactly one for each STEEPE category (Social, Technological, Economic, Environmental, Political, Ethical). Do NOT generate more or fewer than 6.' : `. Return exactly ${count} items in the JSON array, no more and no fewer. Choose the ${count} most impactful STEEPE categories for this scenario.`} Include a MIX of:
- **Mundane/obvious** consequences (everyday impacts people would notice immediately)
- **Moderate** consequences (significant but expected developments)
- **Dramatic** consequences (major shifts that would make headlines)

Requirements:
1. ${!count || count === 6 ? 'Cover ALL 6 STEEPE categories (exactly 1 per category)' : `Spread across as many different STEEPE categories as possible (up to ${count} of: Social, Technological, Economic, Environmental, Political, Ethical). Do NOT repeat the same category unless you have more items than categories.`}
2. Include positive, negative, AND neutral consequences (aim for balance)
3. Vary the timeFrame: mix of "immediate", "short-term", and "long-term"
4. Vary the probability: mostly "probable" and "plausible", some "possible"
5. Vary geographicScope: "local" (directly affected area), "regional" (Europe, Americas, etc.), "global"
6. **IMPORTANCE RATINGS DRIVE EXPLORATION DEPTH** — your importance ratings determine which branches get explored deeply vs. lightly. Be deliberate and differentiated:
   - Assign **"critical"** to exactly 1–2 consequences that are truly game-changing and deserve the deepest exploration
   - Assign **"high"** to 1–2 consequences that are significant but secondary
   - Assign **"medium"** or **"low"** to the rest — these are real consequences but less pivotal
   - Do NOT mark everything as "critical" or "high" — the differentiation matters
7. Be SPECIFIC with concrete details, names of institutions, specific economic figures, etc.

Think about:
- What happens in the first 24 hours? First week? First month?
- How do different governments react?
- What do ordinary citizens experience?
- What markets and industries are affected?
- What military/security changes occur?
${existingSiblings && existingSiblings.length > 0 ? `
## CRITICAL: AVOID DUPLICATES
The following consequences have ALREADY been generated for this scenario. You MUST NOT generate consequences that are similar to, overlap with, or rephrase any of these. Each new consequence must cover genuinely different ground:
${existingSiblings.map(c => `- [${c.category.toUpperCase()}] ${c.text}`).join('\n')}

Generate consequences that explore DIFFERENT aspects, categories, angles, or stakeholders than those listed above.
` : ''}
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

## CRITICAL: PERSPECTIVE — ${input.perspective}
**This analysis is conducted FROM THE VIEWPOINT of: ${input.perspective}**

### Content Framing
Generate consequences that are RELEVANT and MATERIAL to "${input.perspective}". At least 70% should directly affect this stakeholder's operations, strategy, market position, or interests. Frame even broader consequences in terms of how they impact "${input.perspective}".

### Sentiment Evaluation
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

Generate **15-20 second-order consequences** with a MIX of radicality:
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
- Supply chain and procurement impacts
- Regulatory and compliance changes
- Competitive dynamics and market positioning
- Technology development and R&D pivots
- Customer behavior and demand shifts
- Investment flows and funding changes
- Workforce and talent implications
- Trade policy and geopolitical effects
- Consumer sentiment and brand perception
- Industry standards and certification changes
- Cross-sector spillover effects
- Regional market divergences

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

## CRITICAL: PERSPECTIVE — ${input.perspective}
**This analysis is conducted FROM THE VIEWPOINT of: ${input.perspective}**
Generate consequences that are RELEVANT and MATERIAL to this stakeholder. Frame consequences in terms of how they affect "${input.perspective}" specifically.
- "positive" = HELPS ${input.perspective}
- "negative" = HURTS ${input.perspective}`
    : '';

  return `## Task: Generate Third-Order Consequences (Cascade Effects & Wildcards)

Now identify **third-order cascade effects** - deeper systemic changes that emerge from accumulated consequences. This is the FINAL order, so also include some wildcards and surprising developments.

**Original Scenario:** ${input.title}${perspectiveText}

**Second-Order Consequences:**
${secondOrder}

Generate **6-10 third-order consequences** representing structural changes AND wildcards:

Include a MIX of:
- **Market restructuring** (new value chains, industry consolidation, market creation/destruction)
- **Regulatory shifts** (new standards, compliance regimes, trade barriers)
- **Technological pivots** (R&D directions, emerging capabilities, platform shifts)
- **Competitive dynamics** (new entrants, strategic alliances, business model changes)
- **Societal/behavioral shifts** (consumer preferences, workforce changes, cultural attitudes)
- **WILDCARDS** (1-3 surprising, counterintuitive, or black swan developments)

Requirements:
1. **CRITICAL: Each consequence MUST specify which second-order consequence (by number) it flows from using "parentIndex"**
2. Systemic changes to industry structures and value chains
3. Shifts in competitive landscape and market dynamics
4. Emerging business models and strategic pivots
5. Long-term regulatory and standards evolution
6. Technology development trajectories
7. Include "importance": "critical", "high", "medium", or "low"
8. Include 1-3 WILDCARDS with probability: "wildcard" - these are surprising, counterintuitive, or black swan possibilities

Think about 1-10 year timeframe:
- How does the industry restructure?
- What new standards or regulations emerge?
- How do supply chains and value chains reorganize?
- What new business models or market categories appear?
- What technological capabilities become critical?
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

// Branch exploration modes for asymmetric priority generation
export type BranchMode = 'deep' | 'light' | 'normal';

// Generate child consequences from a specific parent node (used by radial menu AI Generate)
export function buildChildConsequencesPrompt(
  input: FutureInput,
  parentConsequence: Consequence,
  count: number = 3,
  existingSiblings?: Consequence[],
  branchMode: BranchMode = 'normal'
): string {
  const nextOrder = Math.min(parentConsequence.order + 1, 5) as ConsequenceOrder;
  const orderLabels: Record<number, string> = {
    2: 'second-order ripple effects',
    3: 'third-order cascade effects',
    4: 'fourth-order systemic transformations',
    5: 'fifth-order wildcard developments',
  };
  const orderLabel = orderLabels[nextOrder] || 'downstream consequences';

  const perspectiveText = input.perspective
    ? `\n**Perspective: ${input.perspective}** — Generate consequences that are relevant and material to this stakeholder. Frame consequences in terms of how they affect "${input.perspective}" specifically.\nEvaluate ALL sentiment from their viewpoint: "positive" = HELPS ${input.perspective}, "negative" = HURTS ${input.perspective}.`
    : '';

  const branchModeText = branchMode === 'deep'
    ? `\n\n## DEEP EXPLORATION MODE
This is a **high-priority branch** selected for deep exploration because of its critical importance. Generate ${count} consequences that:
- Cover **maximally diverse angles** — different STEEPE categories, different stakeholders, different time horizons
- Include at least one **counterintuitive or surprising** downstream effect
- Include at least one consequence that **crosses domains** (e.g., a political consequence causing economic ripples)
- Be bold and specific — this branch deserves thorough analysis
- Assign importance ratings deliberately: mark 1–2 as "critical" or "high" to guide further depth, the rest as "medium" or "low"`
    : branchMode === 'light'
    ? `\n\n## LIGHT TOUCH MODE
This is a **lower-priority branch** that gets a brief exploration. Generate exactly ${count} consequence(s) representing only the **single most significant and likely downstream effect**. Focus on:
- The most impactful and probable consequence — the one a futures analyst would highlight first
- Be concise but specific
- This consequence should capture the essence of where this branch leads`
    : '';

  const horizonChildText = input.horizon === 'near'
    ? '\n**Time bias:** Focus on immediate and short-term consequences (1-3 year horizon).'
    : input.horizon === 'far'
    ? '\n**Time bias:** Focus on long-term structural consequences (10+ year horizon).'
    : '';

  return `## Task: Generate Child Consequences

You are analyzing consequences of this scenario:
**Scenario:** ${input.title}
${input.description}${perspectiveText}${branchModeText}${horizonChildText}

A user has selected this specific consequence and wants to explore its downstream effects:

**Parent Consequence [Order ${parentConsequence.order}, ${parentConsequence.category.toUpperCase()}, ${parentConsequence.sentiment}]:**
"${parentConsequence.text}"

Generate exactly **${count} ${orderLabel}** that flow directly from this parent consequence.

Requirements:
1. Each must be a logical, specific consequence OF THE PARENT (not the original scenario)
2. Spread across different STEEPE categories where possible
3. Include a mix of sentiments — remember consequences often flip sentiment
4. Be concrete with specific details, institutions, figures
5. Vary probability and timeframe
${existingSiblings && existingSiblings.length > 0 ? `
## CRITICAL: AVOID DUPLICATES
This parent already has the following child consequences. You MUST NOT generate consequences that are similar to, overlap with, or rephrase any of these. Each new consequence must cover genuinely different ground:
${existingSiblings.map(c => `- [${c.category.toUpperCase()}] ${c.text}`).join('\n')}

Generate consequences that explore DIFFERENT aspects, categories, angles, or stakeholders than those listed above.
` : ''}
Return ONLY a JSON array:
[
  {
    "text": "Specific consequence flowing from the parent",
    "sentiment": "positive|negative|neutral",
    "category": "social|technological|economic|environmental|political|ethical",
    "timeFrame": "immediate|short-term|long-term",
    "probability": "probable|plausible|possible|wildcard",
    "importance": "critical|high|medium|low"
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
          parentIds: [parentId],
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
