import { Consequence, STEEPCategory, Sentiment, ConsequenceOrder } from './types';

// Simulated AI-generated consequences based on the methodology
export function generateConsequences(
  title: string,
  description: string,
  order: ConsequenceOrder,
  existingConsequences: Consequence[]
): Promise<Consequence[]> {
  return new Promise((resolve) => {
    // Simulate AI processing time
    const delay = order === 1 ? 1500 : order === 2 ? 2000 : 2500;

    setTimeout(() => {
      if (order === 1) {
        resolve(generateFirstOrder(title, description));
      } else if (order === 2) {
        resolve(generateSecondOrder(existingConsequences));
      } else {
        resolve(generateThirdOrder(existingConsequences));
      }
    }, delay);
  });
}

function generateFirstOrder(title: string, description: string): Consequence[] {
  // First-order: obvious, intuitive consequences
  const lowerTitle = title.toLowerCase();
  const lowerDesc = description.toLowerCase();

  // Generic first-order consequences that apply broadly
  const consequences: Consequence[] = [
    {
      id: 'c1-pos-1',
      text: 'Early adopters gain competitive advantage and market positioning',
      sentiment: 'positive',
      category: 'economic',
      order: 1,
      parentId: 'seed',
    },
    {
      id: 'c1-pos-2',
      text: 'New job roles and skill requirements emerge in related industries',
      sentiment: 'positive',
      category: 'social',
      order: 1,
      parentId: 'seed',
    },
    {
      id: 'c1-neg-1',
      text: 'Initial implementation costs create barriers for smaller players',
      sentiment: 'negative',
      category: 'economic',
      order: 1,
      parentId: 'seed',
    },
    {
      id: 'c1-neg-2',
      text: 'Existing workforce may face displacement or need significant retraining',
      sentiment: 'negative',
      category: 'social',
      order: 1,
      parentId: 'seed',
    },
    {
      id: 'c1-neu-1',
      text: 'Regulatory frameworks need to evolve to address new paradigms',
      sentiment: 'neutral',
      category: 'political',
      order: 1,
      parentId: 'seed',
    },
  ];

  // Add context-specific consequences based on keywords
  if (lowerTitle.includes('ai') || lowerDesc.includes('artificial intelligence') || lowerDesc.includes('autonomous')) {
    consequences.push(
      {
        id: 'c1-pos-ai-1',
        text: 'Automation of repetitive tasks frees human capacity for creative work',
        sentiment: 'positive',
        category: 'technological',
        order: 1,
        parentId: 'seed',
      },
      {
        id: 'c1-neg-ai-1',
        text: 'Questions of accountability and liability become complex',
        sentiment: 'negative',
        category: 'political',
        order: 1,
        parentId: 'seed',
      }
    );
  }

  if (lowerTitle.includes('climate') || lowerDesc.includes('environment') || lowerDesc.includes('sustainable')) {
    consequences.push(
      {
        id: 'c1-pos-env-1',
        text: 'Reduced environmental footprint across value chain',
        sentiment: 'positive',
        category: 'environmental',
        order: 1,
        parentId: 'seed',
      },
      {
        id: 'c1-neg-env-1',
        text: 'Transition period may temporarily increase resource consumption',
        sentiment: 'negative',
        category: 'environmental',
        order: 1,
        parentId: 'seed',
      }
    );
  }

  if (lowerTitle.includes('health') || lowerDesc.includes('medical') || lowerDesc.includes('healthcare')) {
    consequences.push(
      {
        id: 'c1-pos-health-1',
        text: 'Improved health outcomes and quality of life for affected populations',
        sentiment: 'positive',
        category: 'social',
        order: 1,
        parentId: 'seed',
      },
      {
        id: 'c1-neg-health-1',
        text: 'Potential for widening health equity gaps if access is unequal',
        sentiment: 'negative',
        category: 'social',
        order: 1,
        parentId: 'seed',
      }
    );
  }

  return consequences;
}

function generateSecondOrder(firstOrderConsequences: Consequence[]): Consequence[] {
  const secondOrder: Consequence[] = [];
  const firstOrder = firstOrderConsequences.filter(c => c.order === 1);

  // Generate STEEP-informed second-order consequences for each first-order
  firstOrder.forEach((parent, idx) => {
    const steepConsequences = generateSTEEPConsequences(parent, idx);
    secondOrder.push(...steepConsequences);
  });

  return secondOrder;
}

function generateSTEEPConsequences(parent: Consequence, index: number): Consequence[] {
  const consequences: Consequence[] = [];
  const categories: STEEPCategory[] = ['social', 'technological', 'economic', 'environmental', 'political', 'ethical'];

  // Generate 1-2 second-order consequences per first-order, across different STEEP categories
  const numConsequences = Math.random() > 0.5 ? 2 : 1;
  const usedCategories: STEEPCategory[] = [parent.category];

  for (let i = 0; i < numConsequences; i++) {
    // Pick a different STEEP category to show cross-domain effects
    const availableCategories = categories.filter(c => !usedCategories.includes(c));
    const category = availableCategories[Math.floor(Math.random() * availableCategories.length)];
    usedCategories.push(category);

    const sentiment: Sentiment = Math.random() > 0.6
      ? (parent.sentiment === 'positive' ? 'negative' : 'positive')  // Flip sometimes
      : parent.sentiment;

    const text = getSecondOrderText(parent, category, sentiment);

    consequences.push({
      id: `c2-${index}-${i}`,
      text,
      sentiment,
      category,
      order: 2,
      parentId: parent.id,
    });
  }

  return consequences;
}

function getSecondOrderText(parent: Consequence, category: STEEPCategory, sentiment: Sentiment): string {
  const templates: Record<STEEPCategory, Record<Sentiment, string[]>> = {
    social: {
      positive: [
        'Communities develop new forms of collaboration and mutual support',
        'Cultural norms evolve to embrace more inclusive practices',
        'Educational systems adapt to prepare citizens for new realities',
      ],
      negative: [
        'Social stratification deepens between adopters and non-adopters',
        'Traditional community bonds may weaken as behaviors shift',
        'Generational divides emerge around acceptance and usage',
      ],
      neutral: [
        'Social scientists study emerging behavioral patterns',
        'New subcultures and identity groups form around the change',
      ],
    },
    technological: {
      positive: [
        'Complementary innovations accelerate in adjacent fields',
        'Infrastructure improvements cascade across connected systems',
        'Open-source communities build accessible alternatives',
      ],
      negative: [
        'Legacy systems become obsolete faster than anticipated',
        'Cybersecurity vulnerabilities multiply with complexity',
        'Technical debt accumulates in rushed implementations',
      ],
      neutral: [
        'Standards bodies convene to establish interoperability protocols',
        'Hybrid transitional solutions bridge old and new paradigms',
      ],
    },
    economic: {
      positive: [
        'New market segments emerge creating entrepreneurial opportunities',
        'Productivity gains drive down costs for end consumers',
        'Investment flows toward scalable sustainable solutions',
      ],
      negative: [
        'Market concentration increases as scale advantages compound',
        'Economic disruption creates regional unemployment clusters',
        'Speculative bubbles form around perceived opportunities',
      ],
      neutral: [
        'Economic models struggle to capture true value creation',
        'Pricing mechanisms evolve to reflect new cost structures',
      ],
    },
    environmental: {
      positive: [
        'Resource efficiency improvements reduce extraction pressures',
        'Circular economy practices gain mainstream adoption',
        'Biodiversity co-benefits emerge from ecosystem approaches',
      ],
      negative: [
        'Rebound effects partially offset efficiency gains',
        'E-waste and disposal challenges grow without planning',
        'Resource extraction shifts to new vulnerable regions',
      ],
      neutral: [
        'Life-cycle assessments reveal complex tradeoffs',
        'Environmental monitoring expands to track new impacts',
      ],
    },
    political: {
      positive: [
        'International cooperation frameworks strengthen around shared goals',
        'Citizen participation in governance increases through new channels',
        'Evidence-based policymaking gains traction',
      ],
      negative: [
        'Geopolitical tensions emerge over strategic resources',
        'Regulatory capture by incumbents slows beneficial transitions',
        'Enforcement challenges undermine policy effectiveness',
      ],
      neutral: [
        'Political coalitions realign around emerging issues',
        'Jurisdictional boundaries blur requiring new governance models',
      ],
    },
  };

  const options = templates[category][sentiment];
  return options[Math.floor(Math.random() * options.length)];
}

function generateThirdOrder(allConsequences: Consequence[]): Consequence[] {
  const thirdOrder: Consequence[] = [];
  const secondOrder = allConsequences.filter(c => c.order === 2);

  // Add randomness-injected "wild card" consequences
  // These represent the "unknown unknowns" mentioned in the methodology

  const wildCards: Array<{ text: string; sentiment: Sentiment; category: STEEPCategory }> = [
    { text: 'Unexpected cultural renaissance emerges in response to technological change', sentiment: 'positive', category: 'social' },
    { text: 'Black swan event accelerates adoption by decades', sentiment: 'neutral', category: 'technological' },
    { text: 'Grassroots movements repurpose the innovation for unintended social good', sentiment: 'positive', category: 'social' },
    { text: 'Counter-movements emerge advocating for return to traditional approaches', sentiment: 'neutral', category: 'political' },
    { text: 'Convergence with unrelated field creates breakthrough nobody anticipated', sentiment: 'positive', category: 'technological' },
    { text: 'Psychological effects on human cognition only become apparent over time', sentiment: 'negative', category: 'social' },
    { text: 'Novel economic models emerge that transcend traditional capitalism', sentiment: 'neutral', category: 'economic' },
    { text: 'Environmental tipping point triggers urgent planetary-scale response', sentiment: 'negative', category: 'environmental' },
    { text: 'New forms of governance emerge that bridge physical and digital realms', sentiment: 'positive', category: 'political' },
    { text: 'Unintended preservation of endangered practices through digital archiving', sentiment: 'positive', category: 'social' },
  ];

  // Select 3-4 random wild cards and attach them to random second-order consequences
  const numWildCards = 3 + Math.floor(Math.random() * 2);
  const shuffledWildCards = [...wildCards].sort(() => Math.random() - 0.5);

  for (let i = 0; i < Math.min(numWildCards, secondOrder.length); i++) {
    const wildCard = shuffledWildCards[i];
    const parent = secondOrder[Math.floor(Math.random() * secondOrder.length)];

    thirdOrder.push({
      id: `c3-wild-${i}`,
      text: wildCard.text,
      sentiment: wildCard.sentiment,
      category: wildCard.category,
      order: 3,
      parentId: parent.id,
    });
  }

  return thirdOrder;
}
