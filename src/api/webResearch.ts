// Web research module - scans news and academic sources for relevant information
// Uses free APIs where available

export interface ResearchResult {
  title: string;
  snippet: string;
  url: string;
  source: 'news' | 'academic' | 'general';
  date?: string;
}

export interface ResearchSummary {
  results: ResearchResult[];
  keyInsights: string[];
  missedAngles: string[];
  timestamp: string;
}

// Parse RSS XML into ResearchResult array (shared by Google and Bing)
function parseNewsRSS(xmlText: string, maxResults: number = 8): ResearchResult[] {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

  // Check for XML parse errors
  if (xmlDoc.querySelector('parsererror')) return [];

  const items = xmlDoc.querySelectorAll('item');
  const results: ResearchResult[] = [];

  items.forEach((item, index) => {
    if (index >= maxResults) return;

    const title = item.querySelector('title')?.textContent || '';
    const link = item.querySelector('link')?.textContent || '';
    const description = item.querySelector('description')?.textContent || '';
    const pubDate = item.querySelector('pubDate')?.textContent || '';

    const cleanSnippet = description.replace(/<[^>]*>/g, '').slice(0, 300);

    results.push({
      title,
      snippet: cleanSnippet,
      url: link,
      source: 'news',
      date: pubDate
    });
  });

  return results;
}

// Search news using Google News RSS via nginx reverse proxy
async function searchGoogleNewsRSS(query: string): Promise<ResearchResult[]> {
  try {
    const encodedQuery = encodeURIComponent(query);
    const response = await fetch(
      `/api/news-proxy/rss/search?q=${encodedQuery}&hl=en-US&gl=US&ceid=US:en`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!response.ok) throw new Error(`Google News returned ${response.status}`);

    const results = parseNewsRSS(await response.text());
    if (results.length > 0) {
      console.log(`Found ${results.length} Google News results for: ${query}`);
      return results;
    }
  } catch (error) {
    console.warn(`Google News failed for: ${query}`, error);
  }

  // Fallback to Bing News RSS
  return searchBingNewsRSS(query);
}

// Fallback: Bing News RSS via nginx reverse proxy
async function searchBingNewsRSS(query: string): Promise<ResearchResult[]> {
  try {
    const encodedQuery = encodeURIComponent(query);
    const response = await fetch(
      `/api/bing-news-proxy/news/search?q=${encodedQuery}&format=rss`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!response.ok) return [];

    const results = parseNewsRSS(await response.text());
    if (results.length > 0) {
      console.log(`Found ${results.length} Bing News results for: ${query}`);
    }
    return results;
  } catch (error) {
    console.warn(`Bing News also failed for: ${query}`, error);
    return [];
  }
}

// Search academic papers using Semantic Scholar API via nginx reverse proxy
async function searchSemanticScholar(query: string): Promise<ResearchResult[]> {
  try {
    const encodedQuery = encodeURIComponent(query);
    const response = await fetch(
      `/api/scholar-proxy/graph/v1/paper/search?query=${encodedQuery}&limit=5&fields=title,abstract,url,year`,
      { signal: AbortSignal.timeout(8000) }
    );

    if (!response.ok) return [];

    const data = await response.json();
    const results: ResearchResult[] = [];

    if (data.data) {
      data.data.forEach((paper: any) => {
        results.push({
          title: paper.title,
          snippet: paper.abstract?.slice(0, 300) || 'No abstract available',
          url: paper.url || `https://www.semanticscholar.org/paper/${paper.paperId}`,
          source: 'academic',
          date: paper.year?.toString()
        });
      });
    }

    return results;
  } catch (error) {
    console.error('Semantic Scholar error:', error);
    return [];
  }
}

// Search Wikipedia for background context (CORS-native, no proxy needed)
async function searchWikipedia(query: string): Promise<ResearchResult[]> {
  try {
    const encodedQuery = encodeURIComponent(query);
    const response = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodedQuery}&srlimit=3&srprop=snippet&format=json&origin=*`,
      { signal: AbortSignal.timeout(8000) }
    );

    if (!response.ok) return [];

    const data = await response.json();
    const results: ResearchResult[] = [];

    if (data.query?.search) {
      data.query.search.forEach((item: any) => {
        results.push({
          title: item.title,
          snippet: item.snippet.replace(/<[^>]*>/g, '').slice(0, 300),
          url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`,
          source: 'general'
        });
      });
    }

    return results;
  } catch (error) {
    console.warn('Wikipedia search failed:', error);
    return [];
  }
}

// Generate expanded search queries for comprehensive coverage
function generateExpandedQueries(topic: string): string[] {
  const queries: string[] = [topic];

  // Extract key entities from the topic
  const topicLower = topic.toLowerCase();

  // Add consequence-focused searches
  const consequenceAngles = [
    `${topic} consequences`,
    `${topic} impact`,
    `${topic} response`,
    `${topic} retaliation`,
    `${topic} implications`,
  ];

  // Add STEEP-focused searches
  const steepSearches = [
    `${topic} economic impact`,
    `${topic} political response`,
    `${topic} financial markets`,
    `${topic} international relations`,
    `${topic} trade war`,
  ];

  // Add stakeholder-specific searches based on topic content
  const stakeholderSearches: string[] = [];

  // Detect geopolitical topics and add relevant stakeholder searches
  if (topicLower.includes('trump') || topicLower.includes('us ') || topicLower.includes('america')) {
    stakeholderSearches.push(`${topic} EU response`);
    stakeholderSearches.push(`${topic} China response`);
    stakeholderSearches.push(`${topic} NATO`);
    stakeholderSearches.push(`${topic} European Union`);
  }

  if (topicLower.includes('greenland') || topicLower.includes('arctic')) {
    stakeholderSearches.push(`Greenland Denmark sovereignty`);
    stakeholderSearches.push(`Arctic geopolitics`);
    stakeholderSearches.push(`EU treasury bonds US`);
    stakeholderSearches.push(`European financial retaliation US`);
  }

  if (topicLower.includes('china') || topicLower.includes('taiwan')) {
    stakeholderSearches.push(`${topic} US response`);
    stakeholderSearches.push(`${topic} Japan response`);
    stakeholderSearches.push(`${topic} ASEAN`);
  }

  if (topicLower.includes('russia') || topicLower.includes('ukraine')) {
    stakeholderSearches.push(`${topic} NATO response`);
    stakeholderSearches.push(`${topic} sanctions`);
    stakeholderSearches.push(`${topic} energy Europe`);
  }

  // Add financial consequence searches for any geopolitical topic
  if (topicLower.includes('war') || topicLower.includes('invasion') ||
      topicLower.includes('annex') || topicLower.includes('take') ||
      topicLower.includes('conflict') || topicLower.includes('military')) {
    stakeholderSearches.push(`${topic} financial markets`);
    stakeholderSearches.push(`${topic} treasury bonds`);
    stakeholderSearches.push(`${topic} currency war`);
    stakeholderSearches.push(`${topic} economic sanctions`);
    stakeholderSearches.push(`${topic} trade retaliation`);
  }

  return [...queries, ...consequenceAngles.slice(0, 1), ...steepSearches.slice(0, 1), ...stakeholderSearches.slice(0, 1)];
}

// Main research function
export async function conductWebResearch(
  topic: string,
  options: {
    includeNews?: boolean;
    includeAcademic?: boolean;
    includeGeneral?: boolean;
  } = { includeNews: true, includeAcademic: true, includeGeneral: true }
): Promise<ResearchSummary> {
  const allResults: ResearchResult[] = [];

  // Generate expanded queries for comprehensive coverage
  const expandedQueries = generateExpandedQueries(topic);
  console.log('Searching with expanded queries:', expandedQueries);

  // Run searches in parallel (allSettled so one failure doesn't kill others)
  const searchPromises: Promise<ResearchResult[]>[] = [];

  if (options.includeNews) {
    // Limit to 4 expanded queries to avoid hammering the proxy
    expandedQueries.slice(0, 4).forEach(query => {
      searchPromises.push(searchGoogleNewsRSS(query));
    });
  }

  if (options.includeAcademic) {
    searchPromises.push(searchSemanticScholar(topic));
  }

  if (options.includeGeneral) {
    searchPromises.push(searchWikipedia(topic));
  }

  const results = await Promise.allSettled(searchPromises);
  results.forEach(r => {
    if (r.status === 'fulfilled') {
      allResults.push(...r.value);
    }
  });

  // Deduplicate by URL
  const uniqueResults = Array.from(
    new Map(allResults.map(r => [r.url, r])).values()
  );

  // Extract key insights from the expanded research
  const keyInsights = extractKeyInsights(uniqueResults);

  // Identify potentially missed angles
  const missedAngles = identifyMissedAngles(topic, uniqueResults);

  console.log(`Web research found ${uniqueResults.length} unique results`);

  return {
    results: uniqueResults,
    keyInsights,
    missedAngles,
    timestamp: new Date().toISOString()
  };
}

// Extract key themes from research results
function extractKeyInsights(results: ResearchResult[]): string[] {
  const insights: string[] = [];

  // Group by source type
  const news = results.filter(r => r.source === 'news');
  const academic = results.filter(r => r.source === 'academic');

  if (news.length > 0) {
    insights.push(`Found ${news.length} recent news articles on this topic`);
  }

  if (academic.length > 0) {
    insights.push(`Found ${academic.length} academic papers related to this topic`);
  }

  // Extract common terms (simplified)
  const allText = results.map(r => r.snippet).join(' ').toLowerCase();
  const importantTerms = ['impact', 'risk', 'opportunity', 'challenge', 'crisis', 'growth', 'decline'];
  importantTerms.forEach(term => {
    if (allText.includes(term)) {
      insights.push(`Research mentions "${term}" - consider including in analysis`);
    }
  });

  return insights.slice(0, 5);
}

// Suggest potentially missed angles
function identifyMissedAngles(topic: string, results: ResearchResult[]): string[] {
  const angles: string[] = [];
  const allText = results.map(r => r.snippet).join(' ').toLowerCase();

  // STEEP categories that might be missing
  const steepAngles: Record<string, string[]> = {
    'social': ['demographics', 'culture', 'education', 'health', 'inequality'],
    'technological': ['AI', 'automation', 'digital', 'innovation', 'cybersecurity'],
    'economic': ['market', 'trade', 'employment', 'inflation', 'GDP'],
    'environmental': ['climate', 'pollution', 'sustainability', 'resources', 'biodiversity'],
    'political': ['policy', 'regulation', 'government', 'geopolitical', 'international']
  };

  Object.entries(steepAngles).forEach(([category, terms]) => {
    const found = terms.some(term => allText.includes(term));
    if (!found) {
      angles.push(`Consider ${category} implications - not prominent in current research`);
    }
  });

  return angles.slice(0, 3);
}

// Format research for display
export function formatResearchForPrompt(research: ResearchSummary): string {
  if (research.results.length === 0) {
    return '';
  }

  let text = '## CRITICAL: Recent Research & News Context\n\n';
  text += '**YOU MUST incorporate these real-world developments into your consequence analysis.**\n';
  text += '**If news mentions specific consequences (e.g., "EU threatens to dump Treasury bonds"), you MUST include those as consequences.**\n\n';

  // Group by source
  const bySource: Record<string, ResearchResult[]> = {
    news: [],
    academic: [],
    general: []
  };

  research.results.forEach(r => {
    bySource[r.source].push(r);
  });

  if (bySource.news.length > 0) {
    text += '### Recent News (MUST be reflected in consequences):\n';
    // Include more results - up to 15 news items
    bySource.news.slice(0, 15).forEach(r => {
      text += `- **${r.title}**: ${r.snippet.slice(0, 250)}\n`;
    });
    text += '\n';
  }

  if (bySource.academic.length > 0) {
    text += '### Academic Research:\n';
    bySource.academic.slice(0, 5).forEach(r => {
      text += `- **${r.title}** (${r.date || 'n.d.'}): ${r.snippet.slice(0, 200)}\n`;
    });
    text += '\n';
  }

  if (bySource.general.length > 0) {
    text += '### Background Context:\n';
    bySource.general.slice(0, 3).forEach(r => {
      text += `- **${r.title}**: ${r.snippet.slice(0, 200)}\n`;
    });
    text += '\n';
  }

  if (research.keyInsights.length > 0) {
    text += '### Key Insights:\n';
    research.keyInsights.forEach(i => {
      text += `- ${i}\n`;
    });
    text += '\n';
  }

  text += '\n**IMPORTANT: Any specific consequences, responses, or retaliatory actions mentioned in the news above MUST appear in your consequence list.**\n';

  return text;
}
