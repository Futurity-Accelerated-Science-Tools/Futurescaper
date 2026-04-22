// API client for Futurescape - Multi-provider support

import { Consequence, Solution, ConsequenceOrder, FutureInput, GenerationConfig, DEFAULT_GENERATION_CONFIG } from '../types';
import { resolveGenerationParams } from './generationStrategy';
import {
  SYSTEM_PROMPT,
  buildSystemPrompt,
  buildFirstOrderPrompt,
  buildSecondOrderPrompt,
  buildThirdOrderPrompt,
  buildSolutionsPrompt,
  buildChildConsequencesPrompt,
  parseConsequencesResponse,
  parseSolutionsResponse,
  BranchMode,
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
  existingConsequences: Consequence[],
  count?: number
): Promise<Consequence[]> {
  let prompt: string;
  let parentId: string;

  // Gather existing siblings (same parent, same order) to avoid duplicates
  const existingSiblingsForOrder = existingConsequences.filter(c => c.order === order);

  switch (order) {
    case 1:
      prompt = buildFirstOrderPrompt(input, count, existingSiblingsForOrder);
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
  const systemPrompt = buildSystemPrompt(input.verbosity);
  const response = await callAPI([{ role: 'user', content: prompt }], systemPrompt, 8192);
  const previousOrder = existingConsequences.filter(c => c.order === (order - 1) as ConsequenceOrder);
  let consequences = parseConsequencesResponse(response, order, parentId, previousOrder);

  return consequences;
}

// Generate solutions
export async function generateSolutionsWithAI(
  input: FutureInput,
  consequences: Consequence[]
): Promise<Solution[]> {
  const prompt = buildSolutionsPrompt(input, consequences);
  const systemPrompt = buildSystemPrompt(input.verbosity);
  const response = await callAPI([{ role: 'user', content: prompt }], systemPrompt);
  return parseSolutionsResponse(response);
}

// Generate child consequences from a specific parent node (used by radial menu)
export async function generateChildConsequencesWithAI(
  input: FutureInput,
  parentConsequence: Consequence,
  count: number = 3,
  existingSiblings?: Consequence[],
  branchMode: BranchMode = 'normal'
): Promise<Consequence[]> {
  const prompt = buildChildConsequencesPrompt(input, parentConsequence, count, existingSiblings, branchMode);
  const systemPrompt = buildSystemPrompt(input.verbosity);
  const response = await callAPI([{ role: 'user', content: prompt }], systemPrompt);
  const newOrder = Math.min(parentConsequence.order + 1, 5) as ConsequenceOrder;
  const results = parseConsequencesResponse(response, newOrder, parentConsequence.id);
  return results;
}

// Phase type for callbacks
export type GenerationPhase =
  | 'analyzing'
  | 'first-order'
  | 'second-order'
  | 'third-order'
  | 'fourth-order'
  | 'fifth-order'
  | 'solutions';

// Helper: run async tasks in parallel batches to avoid overwhelming the API
async function runInBatches<T>(
  tasks: (() => Promise<T>)[],
  batchSize: number = 3
): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < tasks.length; i += batchSize) {
    const batch = tasks.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(batch.map(fn => fn()));
    for (const r of batchResults) {
      if (r.status === 'fulfilled') results.push(r.value);
      else console.error('Batch task failed:', r.reason);
    }
  }
  return results;
}

// Full comprehensive generation flow with callbacks
// Driven by GenerationConfig → ResolvedGenerationParams
export async function generateComprehensiveFuturescape(
  input: FutureInput,
  callbacks: {
    onPhaseStart: (phase: GenerationPhase) => void;
    onPhaseComplete: (phase: GenerationPhase, consequences: Consequence[], solutions?: Solution[]) => void;
    onProgress: (message: string) => void;
    onError: (error: Error, phase: string) => void;
  },
  config: GenerationConfig = DEFAULT_GENERATION_CONFIG,
): Promise<{ consequences: Consequence[]; solutions: Solution[] }> {
  const params = resolveGenerationParams(config, input.verbosity);
  let allConsequences: Consequence[] = [];
  const importanceScore = (c: Consequence) => ({ critical: 0, high: 1, medium: 2, low: 3 }[c.importance || 'medium']);

  try {
    // ── Phase 1: First-order consequences ──
    callbacks.onPhaseStart('first-order');
    callbacks.onProgress(`Identifying ${params.firstOrderCount} direct, first-order consequences...`);
    const firstOrder = await generateConsequencesWithAI(input, 1, [], params.firstOrderCount);
    allConsequences = [...firstOrder];
    callbacks.onPhaseComplete('first-order', firstOrder);
    callbacks.onProgress(`Found ${firstOrder.length} first-order consequences`);

    // ── Phase 2: Second-order branching ──
    callbacks.onPhaseStart('second-order');
    const { mode, deepChildCount, priorityCount, lightChildCount } = params.secondOrder;

    if (mode === 'priority') {
      callbacks.onProgress('Prioritizing branches for asymmetric exploration...');
      const sortedFirst = [...firstOrder].sort((a, b) => importanceScore(a) - importanceScore(b));
      const priorityIds = new Set(sortedFirst.slice(0, priorityCount ?? 2).map(c => c.id));

      const secondOrderTasks = firstOrder.map(parent => async () => {
        const isPriority = priorityIds.has(parent.id);
        const count = isPriority ? deepChildCount : (lightChildCount ?? 0);
        if (count === 0) return [] as Consequence[];
        const branchMode: BranchMode = isPriority ? 'deep' : 'light';
        callbacks.onProgress(
          isPriority
            ? `Deep dive: "${parent.text.slice(0, 40)}..." → ${count} ripple effects`
            : `Light touch: "${parent.text.slice(0, 40)}..." → ${count} effect`
        );
        const children = await generateChildConsequencesWithAI(input, parent, count, undefined, branchMode);
        callbacks.onPhaseComplete('second-order', children);
        return children;
      });

      const secondOrderBatches = await runInBatches(secondOrderTasks, 3);
      const secondOrder = secondOrderBatches.flat();
      allConsequences = [...allConsequences, ...secondOrder];
      callbacks.onProgress(`Found ${secondOrder.length} second-order consequences`);
    } else {
      // Uniform mode — every first-order node gets the same count
      callbacks.onProgress(`Generating ${deepChildCount} children per first-order node...`);
      const secondOrderTasks = firstOrder.map(parent => async () => {
        callbacks.onProgress(`Exploring "${parent.text.slice(0, 40)}..." → ${deepChildCount} effects`);
        const children = await generateChildConsequencesWithAI(input, parent, deepChildCount, undefined, 'normal');
        callbacks.onPhaseComplete('second-order', children);
        return children;
      });

      const secondOrderBatches = await runInBatches(secondOrderTasks, 3);
      const secondOrder = secondOrderBatches.flat();
      allConsequences = [...allConsequences, ...secondOrder];
      callbacks.onProgress(`Found ${secondOrder.length} second-order consequences`);
    }

    // ── Phase 3: Third-order ──
    if (params.thirdOrder.expandCount > 0 && params.thirdOrder.childrenPer > 0) {
      callbacks.onPhaseStart('third-order');
      callbacks.onProgress('Exploring third-order cascade effects...');
      const secondOrderNodes = allConsequences.filter(c => c.order === 2);
      const sortedSecond = [...secondOrderNodes].sort((a, b) => importanceScore(a) - importanceScore(b));
      const toExpand = sortedSecond.slice(0, params.thirdOrder.expandCount);

      const thirdOrderTasks = toExpand.map(parent => async () => {
        callbacks.onProgress(`Cascading "${parent.text.slice(0, 40)}..." → ${params.thirdOrder.childrenPer} effects`);
        const children = await generateChildConsequencesWithAI(input, parent, params.thirdOrder.childrenPer, undefined, 'deep');
        callbacks.onPhaseComplete('third-order', children);
        return children;
      });

      const thirdOrderBatches = await runInBatches(thirdOrderTasks, 3);
      const thirdOrder = thirdOrderBatches.flat();
      allConsequences = [...allConsequences, ...thirdOrder];
      callbacks.onProgress(`Found ${thirdOrder.length} third-order consequences`);
    }

    // ── Phase 4: Fourth-order (depth-first strategies) ──
    if (params.fourthOrder && params.fourthOrder.expandCount > 0 && params.fourthOrder.childrenPer > 0) {
      callbacks.onPhaseStart('fourth-order');
      callbacks.onProgress('Exploring fourth-order systemic effects...');
      const thirdOrderNodes = allConsequences.filter(c => c.order === 3);
      const sortedThird = [...thirdOrderNodes].sort((a, b) => importanceScore(a) - importanceScore(b));
      const toExpand = sortedThird.slice(0, params.fourthOrder.expandCount);

      const fourthOrderTasks = toExpand.map(parent => async () => {
        callbacks.onProgress(`Deep cascade "${parent.text.slice(0, 40)}..." → ${params.fourthOrder!.childrenPer} effects`);
        const children = await generateChildConsequencesWithAI(input, parent, params.fourthOrder!.childrenPer, undefined, 'deep');
        callbacks.onPhaseComplete('fourth-order', children);
        return children;
      });

      const fourthOrderBatches = await runInBatches(fourthOrderTasks, 3);
      const fourthOrder = fourthOrderBatches.flat();
      allConsequences = [...allConsequences, ...fourthOrder];
      callbacks.onProgress(`Found ${fourthOrder.length} fourth-order consequences`);
    }

    // ── Phase 5: Fifth-order (deep depth-first only) ──
    if (params.fifthOrder && params.fifthOrder.expandCount > 0 && params.fifthOrder.childrenPer > 0) {
      callbacks.onPhaseStart('fifth-order');
      callbacks.onProgress('Exploring fifth-order wildcard effects...');
      const fourthOrderNodes = allConsequences.filter(c => c.order === 4);
      const sortedFourth = [...fourthOrderNodes].sort((a, b) => importanceScore(a) - importanceScore(b));
      const toExpand = sortedFourth.slice(0, params.fifthOrder.expandCount);

      const fifthOrderTasks = toExpand.map(parent => async () => {
        callbacks.onProgress(`Wildcard cascade "${parent.text.slice(0, 40)}..." → ${params.fifthOrder!.childrenPer} effects`);
        const children = await generateChildConsequencesWithAI(input, parent, params.fifthOrder!.childrenPer, undefined, 'deep');
        callbacks.onPhaseComplete('fifth-order', children);
        return children;
      });

      const fifthOrderBatches = await runInBatches(fifthOrderTasks, 3);
      const fifthOrder = fifthOrderBatches.flat();
      allConsequences = [...allConsequences, ...fifthOrder];
      callbacks.onProgress(`Found ${fifthOrder.length} fifth-order consequences`);
    }

    // ── Ideas phase: most important leaf nodes get ideas ──
    callbacks.onPhaseStart('solutions');
    callbacks.onProgress('Generating ideas & solutions for key consequences...');

    const childParentIds = new Set(allConsequences.map(c => c.parentId).filter(Boolean));
    const leafNodes = allConsequences.filter(c => !childParentIds.has(c.id) && c.order >= 2);
    const sortedLeaves = [...leafNodes].sort((a, b) => importanceScore(a) - importanceScore(b));
    const keyConsequences = sortedLeaves.slice(0, params.ideas.leafCount);

    const ideaTasks = keyConsequences.map((node, i) => async () => {
      callbacks.onProgress(`Ideas (${i + 1}/${keyConsequences.length}): "${node.text.slice(0, 40)}..."`);
      const ideas = await generateSolutionIdeas(input, node, allConsequences, params.ideas.ideasPer);
      callbacks.onPhaseComplete('solutions', ideas);
      return ideas;
    });

    const ideaBatches = await runInBatches(ideaTasks, 3);
    const allSolutionIdeas = ideaBatches.flat();
    allConsequences = [...allConsequences, ...allSolutionIdeas];
    callbacks.onProgress(`Generated ${allSolutionIdeas.length} solutions & ideas`);

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

  const response = await callAPI([{ role: 'user', content: prompt }], buildSystemPrompt(input.verbosity));

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
  existingConsequences: Consequence[],
  count: number = 2
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

Generate exactly ${count} actionable solutions or ideas that DIRECTLY FLOW FROM this specific consequence.${input.perspective ? ` Remember: at least 1 of the ${count} must be specifically relevant and actionable for "${input.perspective}".` : ''}

## KEY PRINCIPLE
Each solution/idea must have a clear causal link to the consequence:
- NEGATIVE consequence → SOLUTION: "Because [consequence], we should [preemptive action]"
- POSITIVE consequence → IDEA: "Because [consequence], we could [new opportunity]"
- The connection should be obvious and direct, not tangential

## CRITICAL: MIX OF RADICAL AND CONSERVATIVE
You MUST provide a deliberate mix in these ${count} items:
- At least 1 should be RADICAL and highly creative - the kind of thing that sounds wild but is logically sound. Think "moralgorithm", "digital funerals", "autonomous dining experiences". Push boundaries. Be provocative. This should make someone pause and say "wait, that's actually brilliant."
- At least 1 should be CONSERVATIVE and immediately feasible - practical, realistic, implementable within existing systems. Think policy changes, business pivots, training programs. Something a board would greenlight tomorrow.

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

  const response = await callAPI([{ role: 'user', content: prompt }], buildSystemPrompt(input.verbosity));

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
  const response = await callAPI([{ role: 'user', content: prompt }], buildSystemPrompt(input.verbosity), 8192);
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
