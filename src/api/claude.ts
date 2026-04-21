// API client for Futurescape - Multi-provider support

import { Consequence, Solution, ConsequenceOrder, FutureInput, STEEPCategory } from '../types';
import {
  SYSTEM_PROMPT,
  buildFirstOrderPrompt,
  buildSecondOrderPrompt,
  buildThirdOrderPrompt,
  buildSolutionsPrompt,
  buildChildConsequencesPrompt,
  parseConsequencesResponse,
  parseSolutionsResponse,
} from './prompts';
import {
  callProviderAPI,
  hasApiKey as providerHasApiKey,
  setApiKey as providerSetApiKey,
  getApiKey as providerGetApiKey,
  loadSavedConfig,
} from './providers';

// Re-export provider functions for backward compatibility
export const setApiKey = providerSetApiKey;
export const getApiKey = providerGetApiKey;
export const hasApiKey = providerHasApiKey;

// Initialize on module load
loadSavedConfig();

// Main API call function - now uses provider system
export async function callAPI(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  systemPrompt: string = SYSTEM_PROMPT,
  maxTokens: number = 4096
): Promise<string> {
  return callProviderAPI(messages, systemPrompt, maxTokens);
}

// Generate consequences for a specific order
export async function generateConsequencesWithAI(
  input: FutureInput,
  order: ConsequenceOrder,
  existingConsequences: Consequence[]
): Promise<Consequence[]> {
  let prompt: string;
  let parentId: string;

  switch (order) {
    case 1:
      prompt = buildFirstOrderPrompt(input);
      parentId = 'seed';
      break;
    case 2:
      prompt = buildSecondOrderPrompt(input, existingConsequences);
      parentId = 'first-order';
      break;
    case 3:
      prompt = buildThirdOrderPrompt(input, existingConsequences);
      parentId = 'second-order';
      break;
    default:
      throw new Error(`Invalid order: ${order}`);
  }

  // Use higher token limit for generation calls - 3rd order especially needs room for 10-15 items
  const response = await callAPI([{ role: 'user', content: prompt }], SYSTEM_PROMPT, 8192);
  const previousOrder = existingConsequences.filter(c => c.order === (order - 1) as ConsequenceOrder);
  const consequences = parseConsequencesResponse(response, order, parentId, previousOrder);

  return consequences;
}

// Generate solutions
export async function generateSolutionsWithAI(
  input: FutureInput,
  consequences: Consequence[]
): Promise<Solution[]> {
  const prompt = buildSolutionsPrompt(input, consequences);
  const response = await callAPI([{ role: 'user', content: prompt }], SYSTEM_PROMPT);
  return parseSolutionsResponse(response);
}

// Generate child consequences from a specific parent node (used by radial menu)
export async function generateChildConsequencesWithAI(
  input: FutureInput,
  parentConsequence: Consequence
): Promise<Consequence[]> {
  const prompt = buildChildConsequencesPrompt(input, parentConsequence);
  const response = await callAPI([{ role: 'user', content: prompt }], SYSTEM_PROMPT);
  const newOrder = Math.min(parentConsequence.order + 1, 5) as ConsequenceOrder;
  return parseConsequencesResponse(response, newOrder, parentConsequence.id);
}

// Phase type for callbacks (reduced to 3 orders)
export type GenerationPhase =
  | 'analyzing'
  | 'first-order'
  | 'second-order'
  | 'third-order'
  | 'solutions';

// Full comprehensive generation flow with callbacks
export async function generateComprehensiveFuturescape(
  input: FutureInput,
  callbacks: {
    onPhaseStart: (phase: GenerationPhase) => void;
    onPhaseComplete: (phase: GenerationPhase, consequences: Consequence[], solutions?: Solution[]) => void;
    onProgress: (message: string) => void;
    onError: (error: Error, phase: string) => void;
  }
): Promise<{ consequences: Consequence[]; solutions: Solution[] }> {
  let allConsequences: Consequence[] = [];

  try {
    // First order - Direct consequences
    callbacks.onPhaseStart('first-order');
    callbacks.onProgress('Identifying direct, first-order consequences...');
    const firstOrder = await generateConsequencesWithAI(input, 1, []);
    allConsequences = [...firstOrder];
    callbacks.onPhaseComplete('first-order', firstOrder);
    callbacks.onProgress(`Found ${firstOrder.length} first-order consequences`);

    // Second order - Ripple effects
    callbacks.onPhaseStart('second-order');
    callbacks.onProgress('Analyzing second-order ripple effects...');
    const secondOrder = await generateConsequencesWithAI(input, 2, allConsequences);
    allConsequences = [...allConsequences, ...secondOrder];
    callbacks.onPhaseComplete('second-order', secondOrder);
    callbacks.onProgress(`Found ${secondOrder.length} second-order consequences`);

    // Third order - Cascade effects (final order - includes some wildcards)
    callbacks.onPhaseStart('third-order');
    callbacks.onProgress('Exploring third-order cascade effects and wildcards...');
    const thirdOrder = await generateConsequencesWithAI(input, 3, allConsequences);
    allConsequences = [...allConsequences, ...thirdOrder];
    callbacks.onPhaseComplete('third-order', thirdOrder);
    callbacks.onProgress(`Found ${thirdOrder.length} third-order consequences`);

    // Solutions & Ideas phase - generate graph-connected nodes for key consequences
    callbacks.onPhaseStart('solutions');
    callbacks.onProgress('Generating solutions & ideas for key consequences...');

    // Pick consequences to generate solutions/ideas for
    // KEY: Spread evenly across STEEPE categories, different parent chains, and all orders
    const candidateConsequences = allConsequences
      .filter(c => c.importance === 'critical' || c.importance === 'high' || c.importance === 'medium')
      .sort((a, b) => {
        const importanceScore = (c: Consequence) => ({ critical: 0, high: 1, medium: 2, low: 3 }[c.importance || 'medium']);
        return importanceScore(a) - importanceScore(b);
      });

    // Round-robin across categories to ensure spatial distribution around the map
    const categories: STEEPCategory[] = ['social', 'technological', 'economic', 'environmental', 'political', 'ethical'];
    const byCategory: Record<string, Consequence[]> = {};
    for (const cat of categories) {
      byCategory[cat] = candidateConsequences.filter(c => c.category === cat);
    }

    const usedParentIds = new Set<string>();
    const usedNodeIds = new Set<string>();
    const keyConsequences: Consequence[] = [];

    // Round-robin: pick one from each category that has candidates, repeat until we have 8
    let passes = 0;
    while (keyConsequences.length < 8 && passes < 5) {
      for (const cat of categories) {
        if (keyConsequences.length >= 8) break;
        const pick = byCategory[cat]?.find(c =>
          !usedNodeIds.has(c.id) &&
          !usedParentIds.has(c.parentId || '') &&
          !usedParentIds.has(c.id)
        );
        if (pick) {
          keyConsequences.push(pick);
          usedParentIds.add(pick.parentId || pick.id);
          usedNodeIds.add(pick.id);
        }
      }
      passes++;
      // After first pass, relax the parent constraint so we can fill remaining slots
      if (passes === 1) usedParentIds.clear();
    }

    // Fallback: if still under 5, just grab whatever's left
    if (keyConsequences.length < 5) {
      for (const c of candidateConsequences) {
        if (keyConsequences.length >= 5) break;
        if (!usedNodeIds.has(c.id)) {
          keyConsequences.push(c);
          usedNodeIds.add(c.id);
        }
      }
    }

    let allSolutionIdeas: Consequence[] = [];
    for (let i = 0; i < keyConsequences.length; i++) {
      const node = keyConsequences[i];
      callbacks.onProgress(`Generating solutions/ideas (${i + 1}/${keyConsequences.length}): "${node.text.slice(0, 50)}..."`);
      try {
        const ideas = await generateSolutionIdeas(input, node, [...allConsequences, ...allSolutionIdeas]);
        allSolutionIdeas = [...allSolutionIdeas, ...ideas];
        // Add to consequences in real time so they appear on the graph progressively
        callbacks.onPhaseComplete('solutions', ideas);
      } catch (err) {
        console.error(`Failed to generate solutions for node ${node.id}:`, err);
        // Continue with other nodes even if one fails
      }
    }

    callbacks.onProgress(`Generated ${allSolutionIdeas.length} solutions & ideas on the map`);
    allConsequences = [...allConsequences, ...allSolutionIdeas];

    return { consequences: allConsequences, solutions: [] };
  } catch (error) {
    callbacks.onError(error as Error, 'generation');
    throw error;
  }
}

// Expand a specific node - generate 2-4 more consequences from it
export async function expandNodeConsequences(
  input: FutureInput,
  nodeToExpand: Consequence,
  existingConsequences: Consequence[]
): Promise<Consequence[]> {
  const newOrder = Math.min(nodeToExpand.order + 1, 5) as ConsequenceOrder;

  const prompt = `You are analyzing the future scenario: "${input.title}"

${input.description}

${input.perspective ? `## PERSPECTIVE: ${input.perspective}\nAll sentiment ratings MUST be from this stakeholder's viewpoint.` : ''}

## Your Task
The user wants to explore MORE consequences that flow from this specific consequence:

**Parent Consequence (${nodeToExpand.order}° order):**
"${nodeToExpand.text}"
- Category: ${nodeToExpand.category}
- Sentiment: ${nodeToExpand.sentiment}

Generate 3-4 NEW ${newOrder}° order consequences that flow DIRECTLY from this parent consequence.
These should be different from existing consequences.

## Existing consequences to AVOID duplicating:
${existingConsequences.map(c => `- ${c.text}`).slice(0, 20).join('\n')}

## Response Format
Return a JSON array with 3-4 consequences:
\`\`\`json
[
  {
    "text": "Consequence description",
    "category": "social|technological|economic|environmental|political|ethical",
    "sentiment": "positive|negative|neutral",
    "probability": "probable|plausible|possible|wildcard",
    "importance": "critical|high|medium|low",
    "timeFrame": "immediate|short-term|long-term"
  }
]
\`\`\``;

  const response = await callAPI([{ role: 'user', content: prompt }], SYSTEM_PROMPT);

  // Parse the response
  try {
    const jsonMatch = response.match(/```json\s*([\s\S]*?)```/) || response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const jsonStr = jsonMatch[1] || jsonMatch[0];
    const parsed = JSON.parse(jsonStr);

    return parsed.map((item: any, index: number) => ({
      id: `expand-${nodeToExpand.id}-${Date.now()}-${index}`,
      text: item.text,
      category: item.category || 'social',
      sentiment: item.sentiment || 'neutral',
      order: newOrder,
      parentId: nodeToExpand.id,
      probability: item.probability || 'plausible',
      importance: item.importance || 'medium',
      timeFrame: item.timeFrame,
    }));
  } catch (err) {
    console.error('Error parsing expand response:', err, response);
    throw new Error('Failed to parse AI response for node expansion');
  }
}

// Generate solution/idea nodes connected to a consequence
export async function generateSolutionIdeas(
  input: FutureInput,
  targetNode: Consequence,
  existingConsequences: Consequence[]
): Promise<Consequence[]> {
  const sentimentContext = targetNode.sentiment === 'negative'
    ? `This is a NEGATIVE consequence (a risk/threat). Generate practical SOLUTIONS - preemptive actions, mitigations, or strategies that address this risk BEFORE it becomes a crisis. Think like a risk strategist finding ways to neutralize the threat or turn it into an advantage.`
    : targetNode.sentiment === 'positive'
    ? `This is a POSITIVE consequence (an opportunity). Generate creative IDEAS that leverage this opportunity - new businesses, products, services, policies, or strategies that capitalize on what this consequence makes possible. Think like an entrepreneur or innovator spotting what this new reality enables.

EXAMPLE: If the consequence is "No need for humans to drive autonomous vehicles", a good idea would be "Autonomous dining experiences - convert vehicles into mobile restaurants where passengers eat gourmet meals during commutes" because it directly leverages the freed-up attention.`
    : `This is a NEUTRAL consequence. Generate a mix of IDEAS (to leverage the opportunities it creates) and SOLUTIONS (to preemptively address risks it introduces).`;

  const prompt = `You are analyzing the future scenario: "${input.title}"

${input.description}

${input.perspective ? `## PERSPECTIVE: ${input.perspective}
This is the stakeholder perspective chosen by the user. AT LEAST 70% of all ideas and solutions you generate MUST be directly relevant, actionable, and useful for "${input.perspective}" specifically. Frame ideas in terms of what THIS stakeholder can do, benefit from, invest in, or advocate for. The remaining ideas can be broader but should still connect back to how they affect "${input.perspective}".` : ''}

## Your Task
Given this consequence from the futures analysis:

**Consequence (${targetNode.order}° order):**
"${targetNode.text}"
- Category: ${targetNode.category}
- Sentiment: ${targetNode.sentiment}

${sentimentContext}

Generate exactly 2 actionable solutions or ideas that DIRECTLY FLOW FROM this specific consequence.${input.perspective ? ` Remember: at least 1 of the 2 must be specifically relevant and actionable for "${input.perspective}".` : ''}

## KEY PRINCIPLE
Each solution/idea must have a clear causal link to the consequence:
- NEGATIVE consequence → SOLUTION: "Because [consequence], we should [preemptive action]"
- POSITIVE consequence → IDEA: "Because [consequence], we could [new opportunity]"
- The connection should be obvious and direct, not tangential

## CRITICAL: MIX OF RADICAL AND CONSERVATIVE
You MUST provide a deliberate mix in these 2 items:
- 1 should be RADICAL and highly creative - the kind of thing that sounds wild but is logically sound. Think "moralgorithm", "digital funerals", "autonomous dining experiences". Push boundaries. Be provocative. This should make someone pause and say "wait, that's actually brilliant."
- 1 should be CONSERVATIVE and immediately feasible - practical, realistic, implementable within existing systems. Think policy changes, business pivots, training programs. Something a board would greenlight tomorrow.

For example:
- Consequence: "Autonomous vehicles eliminate need for human drivers"
  → RADICAL: "Nomad-as-a-Service" - subscription autonomous homes-on-wheels that eliminate the concept of a fixed address
  → CONSERVATIVE: "Driver Retraining Fund" - government-funded programs pairing ex-drivers with fleet management AI roles

Each should be concrete, specific, and actionable - not vague platitudes. Think like a strategist AND a sci-fi author.

## Existing items to AVOID duplicating:
${existingConsequences.filter(c => c.nodeType === 'solution' || c.nodeType === 'idea').map(c => `- ${c.text}`).slice(0, 15).join('\n') || '(none yet)'}

## Response Format
Return a JSON array:
\`\`\`json
[
  {
    "title": "Short Catchy Name (2-5 words, memorable and punchy like 'Digital Funerals', 'Moralgorithm', 'Redistribution of Wealth')",
    "text": "Description of the solution or idea",
    "nodeType": "solution|idea",
    "category": "social|technological|economic|environmental|political|ethical",
    "importance": "critical|high|medium|low",
    "timeFrame": "immediate|short-term|long-term"
  }
]
\`\`\`

IMPORTANT: The "title" must be a short, memorable name (2-5 words) that captures the essence of the idea. Think brand names, campaign slogans, or concept labels. NOT a full sentence.`;

  const response = await callAPI([{ role: 'user', content: prompt }], SYSTEM_PROMPT);

  try {
    const jsonMatch = response.match(/```json\s*([\s\S]*?)```/) || response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const jsonStr = jsonMatch[1] || jsonMatch[0];
    const parsed = JSON.parse(jsonStr);

    return parsed.map((item: any, index: number) => ({
      id: `sol-${targetNode.id}-${Date.now()}-${index}`,
      text: item.text,
      title: item.title || undefined, // Short memorable name for the node
      category: item.category || targetNode.category,
      sentiment: 'positive' as const, // solutions/ideas are inherently positive action
      order: Math.min(targetNode.order + 1, 5) as ConsequenceOrder, // one ring out from parent so layout groups them correctly
      parentId: targetNode.id,
      probability: 'plausible' as const,
      importance: item.importance || 'medium',
      timeFrame: item.timeFrame,
      nodeType: (item.nodeType === 'solution' || item.nodeType === 'idea') ? item.nodeType : (targetNode.sentiment === 'negative' ? 'solution' : 'idea'),
    }));
  } catch (err) {
    console.error('Error parsing solution/idea response:', err, response);
    throw new Error('Failed to parse AI response for solution/idea generation');
  }
}

// Free-prompt expansion: let the user ask for anything in natural language
export async function freePromptExpand(
  input: FutureInput,
  existingConsequences: Consequence[],
  userPrompt: string,
  onProgress?: (message: string) => void
): Promise<Consequence[]> {
  // Build a compact summary of the existing map for context
  const mapSummary = existingConsequences
    .slice(0, 60)
    .map(c => `[${c.order}°|${c.category}|${c.sentiment}] ${c.text}`)
    .join('\n');

  const maxOrder = Math.max(...existingConsequences.map(c => c.order));
  // If user asks for "more orders" or "deeper", default to next order
  // Otherwise let the AI decide based on the prompt
  const suggestedOrder = Math.min(maxOrder + 1, 5) as ConsequenceOrder;

  const prompt = `You are analyzing the future scenario: "${input.title}"

${input.description}

${input.perspective ? `## PERSPECTIVE: ${input.perspective}\nAll sentiment ratings MUST be from this stakeholder's viewpoint.\n- "positive" = HELPS ${input.perspective}\n- "negative" = HURTS ${input.perspective}` : ''}

## Existing Consequence Map (${existingConsequences.length} nodes, up to ${maxOrder}° order)
${mapSummary}

## User's Request
The user wants to EXPAND this map. Here is their instruction:

"${userPrompt}"

## Your Task
Generate NEW consequences based on the user's request. Interpret their intent:
- If they ask for "more orders" or "go deeper" or "push further": generate consequences at order ${suggestedOrder} (or higher) that flow from existing high-order nodes
- If they ask for more of a specific type (e.g. "more negative economic"): generate consequences matching those filters, at whatever order makes sense
- If they ask to explore a specific consequence: generate children of that consequence
- If they ask for wildcards or black swans: generate low-probability, high-impact scenarios
- Otherwise: use your best judgment

Generate 8-15 NEW consequences. Each must have a parentId referencing an existing consequence by its position in the map summary above (use "parentIndex" as 1-based index into the summary).

For the "order" field:
- Use ${suggestedOrder} if generating deeper consequences
- Use the same order as the parent if adding density at that level
- Use your judgment based on what the user asked for
- Valid values: 1, 2, 3, 4, or 5

AVOID duplicating existing consequences. Be specific and concrete.

Return ONLY a JSON array:
\`\`\`json
[
  {
    "text": "Specific consequence description",
    "category": "social|technological|economic|environmental|political|ethical",
    "sentiment": "positive|negative|neutral",
    "probability": "probable|plausible|possible|wildcard",
    "importance": "critical|high|medium|low",
    "timeFrame": "immediate|short-term|long-term",
    "geographicScope": "local|regional|global",
    "order": ${suggestedOrder},
    "parentIndex": 1
  }
]
\`\`\``;

  onProgress?.('Interpreting your request...');
  const response = await callAPI([{ role: 'user', content: prompt }], SYSTEM_PROMPT, 8192);
  onProgress?.('Parsing new consequences...');

  try {
    const jsonMatch = response.match(/```json\s*([\s\S]*?)```/) || response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const jsonStr = jsonMatch[1] || jsonMatch[0];
    const parsed = JSON.parse(jsonStr);

    // Map parentIndex back to actual consequence IDs
    const summaryConsequences = existingConsequences.slice(0, 60);

    return parsed.map((item: any, index: number) => {
      let parentId = 'seed';
      if (item.parentIndex && item.parentIndex >= 1 && item.parentIndex <= summaryConsequences.length) {
        parentId = summaryConsequences[item.parentIndex - 1].id;
      } else {
        // Fallback: attach to a random high-order node
        const highOrder = existingConsequences.filter(c => c.order === maxOrder);
        parentId = highOrder[index % highOrder.length]?.id || 'seed';
      }

      const order = Math.min(Math.max(item.order || suggestedOrder, 1), 5) as ConsequenceOrder;

      return {
        id: `prompt-${Date.now()}-${index}`,
        text: item.text,
        category: item.category || 'social',
        sentiment: item.sentiment || 'neutral',
        order,
        parentId,
        probability: item.probability || 'plausible',
        importance: item.importance || 'medium',
        timeFrame: item.timeFrame || 'short-term',
        geographicScope: item.geographicScope || 'regional',
      };
    });
  } catch (err) {
    console.error('Error parsing free prompt response:', err, response);
    throw new Error('Failed to parse AI response. Try rephrasing your request.');
  }
}

// Fetch and extract content from URL
export async function fetchUrlContent(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status}`);
    }
    const html = await response.text();

    // Basic HTML to text extraction
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Remove script and style elements
    doc.querySelectorAll('script, style, nav, footer, header').forEach(el => el.remove());

    // Get main content
    const article = doc.querySelector('article') || doc.querySelector('main') || doc.body;
    const text = article?.textContent || '';

    // Clean up whitespace
    return text.replace(/\s+/g, ' ').trim().slice(0, 8000);
  } catch (error) {
    console.error('Error fetching URL:', error);
    throw new Error(`Could not fetch URL content. Please paste the article text manually.`);
  }
}
