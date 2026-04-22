import React from 'react';
import { Box, Flex, Text, Button } from '@chakra-ui/react';
import { FutureInput, Consequence, Solution, STEEP_LABELS, HORIZON_LABELS, ORDER_LABELS, PROBABILITY_LABELS, TIMEFRAME_LABELS } from '../types';
import { Download, FileJson, FileText, Share2, FileSpreadsheet, LayoutDashboard, Globe } from 'lucide-react';
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
      md += `## 1st Order Consequences (Direct Effects)\n`;
      md += `*Obvious, immediate impacts that flow directly from the scenario*\n\n`;
      byOrder[1].forEach(c => {
        const symbol = c.sentiment === 'positive' ? '↑' : c.sentiment === 'negative' ? '↓' : '—';
        const prob = c.probability ? ` [${PROBABILITY_LABELS[c.probability]}]` : '';
        const time = c.timeFrame ? ` ${TIMEFRAME_LABELS[c.timeFrame]}` : '';
        md += `- ${symbol} **[${STEEP_LABELS[c.category]}]**${prob}${time}\n  ${c.text}\n\n`;
      });
    }

    // Second Order
    if (byOrder[2].length > 0) {
      md += `## 2nd Order Consequences (Ripple Effects)\n`;
      md += `*Cascading effects that emerge from first-order consequences*\n\n`;
      byOrder[2].forEach(c => {
        const symbol = c.sentiment === 'positive' ? '↑' : c.sentiment === 'negative' ? '↓' : '—';
        const prob = c.probability ? ` [${PROBABILITY_LABELS[c.probability]}]` : '';
        md += `- ${symbol} **[${STEEP_LABELS[c.category]}]**${prob}\n  ${c.text}\n\n`;
      });
    }

    // Third Order (includes wildcards)
    if (byOrder[3].length > 0) {
      md += `## 3rd Order Consequences (Cascade Effects & Wildcards)\n`;
      md += `*Deeper systemic changes and surprising possibilities*\n\n`;
      byOrder[3].forEach(c => {
        const symbol = c.sentiment === 'positive' ? '↑' : c.sentiment === 'negative' ? '↓' : '—';
        const wildcard = c.probability === 'wildcard' ? '✦ ' : '';
        md += `- ${symbol} ${wildcard}**[${STEEP_LABELS[c.category]}]** ${c.text}\n`;
      });
      md += `\n`;
    }

    // Fourth Order
    if (byOrder[4].length > 0) {
      md += `## 4th Order Consequences (Systemic Shifts)\n`;
      md += `*Deep structural transformations emerging from cascading effects*\n\n`;
      byOrder[4].forEach(c => {
        const symbol = c.sentiment === 'positive' ? '↑' : c.sentiment === 'negative' ? '↓' : '—';
        const wildcard = c.probability === 'wildcard' ? '✦ ' : '';
        md += `- ${symbol} ${wildcard}**[${STEEP_LABELS[c.category]}]** ${c.text}\n`;
      });
      md += `\n`;
    }

    // Fifth Order
    if (byOrder[5].length > 0) {
      md += `## 5th Order Consequences (Paradigm Shifts)\n`;
      md += `*Fundamental paradigm changes and civilizational-level impacts*\n\n`;
      byOrder[5].forEach(c => {
        const symbol = c.sentiment === 'positive' ? '↑' : c.sentiment === 'negative' ? '↓' : '—';
        const wildcard = c.probability === 'wildcard' ? '✦ ' : '';
        md += `- ${symbol} ${wildcard}**[${STEEP_LABELS[c.category]}]** ${c.text}\n`;
      });
      md += `\n`;
    }

    // Solutions
    if (solutions.length > 0) {
      md += `---\n\n`;
      md += `## Proposed Solutions\n\n`;

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
    const headers = [
      'Order', 'Category', 'Sentiment', 'Importance', 'Probability',
      'TimeFrame', 'Geographic Scope', 'Consequence'
    ];

    const rows = consequences.map(c => [
      c.order,
      STEEP_LABELS[c.category],
      c.sentiment,
      c.importance || 'medium',
      c.probability ? PROBABILITY_LABELS[c.probability] : '',
      c.timeFrame ? TIMEFRAME_LABELS[c.timeFrame] : '',
      c.geographicScope || '',
      `"${c.text.replace(/"/g, '""')}"`
    ]);

    if (solutions.length > 0) {
      rows.push([]);
      rows.push(['--- SOLUTIONS ---', '', '', '', '', '', '', '']);
      rows.push(['Type', 'Category', 'Feasibility', 'Timeline', '', '', '', 'Solution']);
      solutions.forEach(s => {
        rows.push([
          s.type, STEEP_LABELS[s.category], s.feasibility,
          TIMEFRAME_LABELS[s.timeToImplement], '', '', '',
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

  const handleDownloadHTML = () => {
    const exportData = { input, consequences, solutions };
    const dataScript = `<script id="futurescaper-data" type="application/json">${JSON.stringify(exportData)}<\/script>`;

    // Get the full HTML and inject the data
    const html = document.documentElement.outerHTML;
    const injectedHtml = html.replace('</head>', `${dataScript}\n</head>`);

    const blob = new Blob([`<!DOCTYPE html>\n${injectedHtml}`], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `futurescaper-${slug}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyShareLink = () => {
    const shareData = btoa(JSON.stringify({ input, consequences }));
    navigator.clipboard.writeText(`${window.location.origin}?data=${shareData.slice(0, 100)}...`);
    alert('Share link copied! (Demo only - full sharing requires backend)');
  };

  const stats = {
    total: consequences.length,
    solutions: solutions.length,
  };

  return (
    <Box p={4} borderTop="1px solid" borderColor="border.muted" mt="auto">
      <Flex align="center" gap={2} mb={4}>
        <Box as={Download} w={4} h={4} color="fg.muted" />
        <Text fontWeight="semibold" color="fg">Export & Share</Text>
      </Flex>

      <Flex gap={2} mb={4}>
        <Box flex={1} textAlign="center" p={3} bg="bg.hover" rounded="lg">
          <Text fontSize="2xl" fontWeight="bold" color="fg">{stats.total}</Text>
          <Text fontSize="xs" color="fg.muted">Consequences</Text>
        </Box>
        <Box flex={1} textAlign="center" p={3} bg="bg.hover" rounded="lg">
          <Text fontSize="2xl" fontWeight="bold" color="fg">{stats.solutions}</Text>
          <Text fontSize="xs" color="fg.muted">Solutions</Text>
        </Box>
      </Flex>

      <Flex direction="column" gap={2}>
        <Button
          onClick={exportCSV}
          w="full"
          size="sm"
          bg="bg.hover"
          color="fg"
          rounded="lg"
          fontWeight="medium"
          _hover={{ bg: 'bg.active' }}
        >
          <Box as={FileSpreadsheet} w={4} h={4} mr={2} />
          Export CSV (Excel)
        </Button>
        <Button
          onClick={exportJSON}
          w="full"
          size="sm"
          bg="bg.hover"
          color="fg"
          rounded="lg"
          fontWeight="medium"
          _hover={{ bg: 'bg.active' }}
        >
          <Box as={LayoutDashboard} w={4} h={4} mr={2} />
          Export JSON (Miro + Reload)
        </Button>
        <Button
          onClick={exportMarkdown}
          w="full"
          size="sm"
          bg="bg.hover"
          color="fg"
          rounded="lg"
          fontWeight="medium"
          _hover={{ bg: 'bg.active' }}
        >
          <Box as={FileText} w={4} h={4} mr={2} />
          Export Report (MD)
        </Button>
        <Button
          onClick={handleDownloadHTML}
          w="full"
          size="sm"
          bg="bg.hover"
          color="fg"
          rounded="lg"
          fontWeight="medium"
          _hover={{ bg: 'bg.active' }}
        >
          <Box as={Globe} w={4} h={4} mr={2} />
          Download HTML
        </Button>
        <Button
          onClick={copyShareLink}
          w="full"
          size="sm"
          bg="brand"
          color="brand.contrast"
          rounded="lg"
          fontWeight="medium"
          _hover={{ bg: 'brand.hover' }}
        >
          <Box as={Share2} w={4} h={4} mr={2} />
          Copy Share Link
        </Button>
      </Flex>
    </Box>
  );
}
