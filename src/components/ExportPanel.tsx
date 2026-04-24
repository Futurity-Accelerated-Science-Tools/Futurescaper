import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Box, Flex, Text, Button } from '@chakra-ui/react';
import { FutureInput, Consequence, Solution, STEEP_LABELS, HORIZON_LABELS, ORDER_LABELS, PROBABILITY_LABELS, TIMEFRAME_LABELS } from '../types';
import { Download, FileText, FileSpreadsheet, LayoutDashboard, Globe, ChevronDown, Check, Link, AlertTriangle, X, Copy } from 'lucide-react';
import { buildUnifiedExport } from '../api/miroExport';
import { encodeGraphForURL, MAX_SAFE_URL_LENGTH } from '../shareCodec';

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

  // Pre-compute the encoded share link so we can check its size
  const shareEncoded = useMemo(
    () => encodeGraphForURL(input, consequences, solutions),
    [input, consequences, solutions],
  );
  const shareURL = `${window.location.origin}${window.location.pathname}?d=${shareEncoded}`;
  const shareTooLarge = shareURL.length > MAX_SAFE_URL_LENGTH;

  const copyShareLink = () => {
    if (shareTooLarge) return; // blocked by UI, but guard anyway
    navigator.clipboard.writeText(shareURL);
    setLinkCopied(true);
    setShareModalOpen(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const stats = {
    total: consequences.length,
    solutions: solutions.length,
  };

  const [menuOpen, setMenuOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const exportOptions = [
    { label: 'CSV (Excel)', icon: FileSpreadsheet, action: exportCSV },
    { label: 'JSON (Miro + Reload)', icon: LayoutDashboard, action: exportJSON },
    { label: 'Markdown Report', icon: FileText, action: exportMarkdown },
    { label: 'HTML (Standalone)', icon: Globe, action: handleDownloadHTML },
  ];

  return (
    <Box p={4} borderTop="1px solid" borderColor="border.muted" mt="auto">
      <Flex align="center" gap={2} mb={4}>
        <Box as={Download} w={4} h={4} color="fg.muted" />
        <Text fontWeight="semibold" color="fg" fontFamily="heading">Export & Share</Text>
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
        {/* Primary action: Copy Share Link (with tooltip when disabled) */}
        <Box position="relative" className="share-link-wrapper">
          <Button
            onClick={copyShareLink}
            w="full"
            size="sm"
            bg={shareTooLarge ? 'bg.hover' : 'brand'}
            color={shareTooLarge ? 'fg.muted' : 'brand.contrast'}
            rounded="lg"
            fontWeight="medium"
            _hover={{ bg: shareTooLarge ? 'bg.hover' : 'brand.hover' }}
            disabled={shareTooLarge}
            style={shareTooLarge ? { cursor: 'not-allowed', opacity: 0.6 } : undefined}
          >
            <Box as={linkCopied ? Check : shareTooLarge ? AlertTriangle : Link} w={4} h={4} mr={2} />
            {linkCopied ? 'Link Copied!' : shareTooLarge ? 'Graph too large for link' : 'Copy Share Link'}
          </Button>
          {shareTooLarge && (
            <Box
              className="share-link-tooltip"
              position="absolute"
              bottom="calc(100% + 8px)"
              left={0}
              right={0}
              bg="fg"
              color="bg"
              fontSize="xs"
              px={3}
              py={2}
              rounded="lg"
              zIndex={30}
              opacity={0}
              pointerEvents="none"
              transition="opacity 0.15s"
              boxShadow="lg"
              lineHeight="1.4"
            >
              <Text fontWeight="semibold" mb={1}>URL too long for reliable sharing</Text>
              <Text>
                This graph encodes to ~{Math.round(shareURL.length / 1000)}k characters, which exceeds
                the ~{Math.round(MAX_SAFE_URL_LENGTH / 1000)}k limit supported by most browsers, email clients,
                and messaging apps. Use "Download As → JSON" to share the full graph as a file instead.
              </Text>
              {/* Tooltip arrow */}
              <Box
                position="absolute"
                bottom="-4px"
                left="50%"
                transform="translateX(-50%) rotate(45deg)"
                w="8px"
                h="8px"
                bg="fg"
              />
            </Box>
          )}
        </Box>

        {/* Export dropdown */}
        <Box position="relative" ref={menuRef}>
          <Button
            onClick={() => setMenuOpen(!menuOpen)}
            w="full"
            size="sm"
            bg="bg.hover"
            color="fg"
            rounded="lg"
            fontWeight="medium"
            _hover={{ bg: 'bg.active' }}
          >
            <Box as={Download} w={4} h={4} mr={2} />
            Download As...
            <Box as={ChevronDown} w={4} h={4} ml="auto" style={{ transform: menuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
          </Button>

          {menuOpen && (
            <Box
              position="absolute"
              bottom="100%"
              left={0}
              right={0}
              mb={1}
              bg="bg"
              border="1px solid"
              borderColor="border.muted"
              rounded="lg"
              overflow="hidden"
              boxShadow="lg"
              zIndex={20}
            >
              {exportOptions.map((opt) => (
                <Box
                  key={opt.label}
                  as="button"
                  display="flex"
                  alignItems="center"
                  w="full"
                  px={3}
                  py={2}
                  fontSize="sm"
                  color="fg"
                  bg="transparent"
                  _hover={{ bg: 'bg.hover' }}
                  cursor="pointer"
                  onClick={() => {
                    opt.action();
                    setMenuOpen(false);
                  }}
                  style={{ border: 'none', textAlign: 'left' }}
                >
                  <Box as={opt.icon} w={4} h={4} mr={2} flexShrink={0} color="fg.muted" />
                  {opt.label}
                </Box>
              ))}
            </Box>
          )}
        </Box>
      </Flex>

      {/* Share link confirmation modal */}
      {shareModalOpen && (
        <Box
          position="fixed"
          inset={0}
          zIndex={50}
          display="flex"
          alignItems="center"
          justifyContent="center"
          onClick={() => setShareModalOpen(false)}
        >
          {/* Backdrop */}
          <Box position="absolute" inset={0} bg="blackAlpha.500" backdropFilter="blur(8px)" />

          {/* Modal panel */}
          <Box
            position="relative"
            w={{ base: '90%', md: '440px' }}
            bg="bg.canvas"
            rounded="8px"
            shadow="xl"
            borderWidth="1px"
            borderStyle="solid"
            borderColor="border.emphasized"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            {/* Header */}
            <Flex px={5} py={3} align="center" justify="space-between" borderBottom="1px solid" borderColor="border.muted">
              <Flex align="center" gap={2}>
                <Box as={Check} w={5} h={5} color="green.500" />
                <Text fontSize="md" fontWeight="semibold" color="fg" fontFamily="heading">Link Copied</Text>
              </Flex>
              <Box
                as="button"
                onClick={() => setShareModalOpen(false)}
                p={1.5}
                rounded="6px"
                color="fg.muted"
                _hover={{ color: 'fg', bg: 'bg.hover' }}
                transition="all 0.2s"
              >
                <X style={{ width: 18, height: 18 }} />
              </Box>
            </Flex>

            {/* Body */}
            <Box px={5} py={4}>
              <Text fontSize="sm" color="fg" mb={3}>
                The share link has been copied to your clipboard. Anyone who opens it will get their own
                independent copy of this graph.
              </Text>
              <Box bg="bg.hover" rounded="md" px={3} py={2} mb={4}>
                <Text fontSize="xs" color="fg.muted" fontWeight="medium" mb={1}>Keep in mind:</Text>
                <Text fontSize="xs" color="fg.muted">
                  This is not a collaboration link — changes the recipient makes won't sync back to you,
                  and any changes you make after sharing won't appear in their copy.
                </Text>
              </Box>
              <Flex gap={2}>
                <Button
                  onClick={() => {
                    navigator.clipboard.writeText(shareURL);
                    setLinkCopied(true);
                    setTimeout(() => setLinkCopied(false), 2000);
                  }}
                  size="sm"
                  bg="bg.hover"
                  color="fg"
                  rounded="lg"
                  fontWeight="medium"
                  _hover={{ bg: 'bg.active' }}
                >
                  <Box as={Copy} w={3.5} h={3.5} mr={1.5} />
                  Copy Again
                </Button>
                <Button
                  onClick={() => setShareModalOpen(false)}
                  size="sm"
                  bg="brand"
                  color="brand.contrast"
                  rounded="lg"
                  fontWeight="medium"
                  _hover={{ bg: 'brand.hover' }}
                  ml="auto"
                >
                  Done
                </Button>
              </Flex>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
}
