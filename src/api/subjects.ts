import { ALL_SUBJECTS } from '../data/subjects';
import { FutureInput, Consequence } from '../types';
import { callAPI } from './claude';

export interface RelevantSubject {
  name: string;
  relevance: 'direct' | 'tangential';
  reason: string;
}

// Pre-filter subjects using keyword matching to get a manageable subset for the LLM
function preFilterSubjects(input: FutureInput, consequences: Consequence[]): string[] {
  // Build keyword set from the scenario title, description, and consequence texts
  const allText = [
    input.title,
    input.description,
    ...consequences.map(c => c.text),
  ].join(' ').toLowerCase();

  // Extract meaningful words (3+ chars, skip common words)
  const stopWords = new Set([
    'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her',
    'was', 'one', 'our', 'out', 'has', 'his', 'how', 'its', 'may', 'new', 'now',
    'old', 'see', 'way', 'who', 'did', 'get', 'let', 'say', 'she', 'too', 'use',
    'will', 'with', 'this', 'that', 'from', 'they', 'been', 'have', 'many', 'some',
    'them', 'than', 'each', 'make', 'like', 'into', 'over', 'such', 'more', 'also',
    'most', 'very', 'when', 'what', 'your', 'just', 'about', 'would', 'could',
    'should', 'their', 'which', 'there', 'these', 'other', 'being', 'where',
    'those', 'after', 'first', 'through', 'between', 'leading', 'significant',
    'major', 'including', 'potential', 'based', 'across', 'toward', 'while',
  ]);

  const words = allText
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !stopWords.has(w));

  // Also extract bigrams for better matching
  const bigrams: string[] = [];
  const wordArr = allText.replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(w => w.length >= 2);
  for (let i = 0; i < wordArr.length - 1; i++) {
    bigrams.push(`${wordArr[i]} ${wordArr[i + 1]}`);
  }

  const keywordSet = new Set(words);

  // Score each subject by keyword overlap
  const scored = ALL_SUBJECTS.map(subject => {
    const subjectLower = subject.toLowerCase();
    const subjectWords = subjectLower.split(/[\s-]+/).filter(w => w.length >= 3);
    let score = 0;

    // Direct word match
    for (const w of subjectWords) {
      if (keywordSet.has(w)) score += 2;
    }

    // Check if subject appears as substring in the scenario text
    if (allText.includes(subjectLower)) score += 5;

    // Partial matches (subject word starts with scenario word or vice versa)
    for (const sw of subjectWords) {
      for (const kw of words) {
        if (sw !== kw && (sw.startsWith(kw) || kw.startsWith(sw)) && Math.min(sw.length, kw.length) >= 4) {
          score += 1;
        }
      }
    }

    return { name: subject, score };
  });

  // Return top 300 scored subjects (the LLM will do final selection)
  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 300)
    .map(s => s.name);
}

export async function findRelevantSubjects(
  input: FutureInput,
  consequences: Consequence[],
  onProgress?: (msg: string) => void,
): Promise<RelevantSubject[]> {
  onProgress?.('Pre-filtering subjects...');
  const candidates = preFilterSubjects(input, consequences);

  if (candidates.length === 0) {
    // Fallback: just send the full list description to the LLM
    onProgress?.('No keyword matches, using AI to search broadly...');
  }

  onProgress?.(`Analyzing ${candidates.length} candidate subjects...`);

  const consequenceSummary = consequences
    .filter(c => !c.nodeType || c.nodeType === 'consequence')
    .slice(0, 25)
    .map(c => `- [${c.sentiment}/${c.category}] ${c.text}`)
    .join('\n');

  const prompt = `You are analyzing the future scenario: "${input.title}"

${input.description}

## Key consequences identified:
${consequenceSummary}

## Your Task
From the following list of technology/innovation subjects, select:
1. Up to 20 DIRECTLY RELEVANT subjects - technologies, innovations, or fields that are central to this scenario and its consequences
2. Up to 10 TANGENTIALLY DISRUPTIVE subjects - things that aren't obviously related but could unexpectedly disrupt or transform how this scenario plays out (wildcards, unexpected connections)

## Candidate subjects:
${candidates.join(', ')}

${candidates.length < 50 ? `\nNote: if the candidates above seem limited, you may also suggest subjects from this broader sample:\n${ALL_SUBJECTS.slice(0, 500).join(', ')}` : ''}

## Response Format
Return a JSON object:
\`\`\`json
{
  "direct": [
    {"name": "exact subject name from the list", "reason": "one-line explanation of relevance"}
  ],
  "tangential": [
    {"name": "exact subject name from the list", "reason": "one-line explanation of how it could be disruptive"}
  ]
}
\`\`\`

IMPORTANT: Use the EXACT subject names from the lists provided. Do not invent new names.`;

  const response = await callAPI(
    [{ role: 'user', content: prompt }],
    'You are a futures analyst identifying technology and innovation subjects relevant to a scenario. Be creative with tangential connections - find unexpected links.',
  );

  try {
    const jsonMatch = response.match(/```json\s*([\s\S]*?)```/) || response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found');

    const jsonStr = jsonMatch[1] || jsonMatch[0];
    const parsed = JSON.parse(jsonStr);

    const results: RelevantSubject[] = [];

    if (parsed.direct) {
      for (const item of parsed.direct.slice(0, 20)) {
        results.push({
          name: item.name,
          relevance: 'direct',
          reason: item.reason || '',
        });
      }
    }

    if (parsed.tangential) {
      for (const item of parsed.tangential.slice(0, 10)) {
        results.push({
          name: item.name,
          relevance: 'tangential',
          reason: item.reason || '',
        });
      }
    }

    return results;
  } catch (err) {
    console.error('Failed to parse subjects response:', err, response);
    return [];
  }
}
