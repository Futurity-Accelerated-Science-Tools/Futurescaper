/**
 * ReportKnowledgeGraph — Placeholder for the knowledge graph visualization.
 *
 * The full Cosmograph-powered knowledge graph is available in the FAST app's
 * Subject pages. This stub preserves the component interface so the report
 * renders cleanly without the heavy @cosmograph/react dependency (which
 * requires React 19 and has packaging issues with Vite).
 *
 * TODO: Re-enable once Cosmograph ships a React 18–compatible build,
 * or when the Futurescaper is fully merged into the FAST app (which
 * already has a working Cosmograph integration).
 */

import { Box, Flex, Text } from '@chakra-ui/react';
import { useColorMode } from '../theme/ColorModeProvider';
import type { Consequence } from '../types';
import type { RelevantSubject } from '../api/subjects';

interface ReportKnowledgeGraphProps {
  consequences: Consequence[];
  subjects?: RelevantSubject[];
  seedTitle: string;
  height?: string;
}

// Node type color mapping (kept for the static legend)
const NODE_TYPE_COLORS: Record<string, string> = {
  Seed: '#ff9f1c',
  'Consequence-positive': '#3DB462',
  'Consequence-negative': '#FF4D53',
  'Consequence-neutral': '#8891a0',
  Idea: '#0005e9',
  'Subject-direct': '#7c5cfc',
  'Subject-tangential': '#0d9488',
};

export function ReportKnowledgeGraph({
  consequences,
  subjects,
  seedTitle,
  height = '480px',
}: ReportKnowledgeGraphProps) {
  const { colorMode } = useColorMode();
  const isDark = colorMode === 'dark';

  const nodeCount = 1 + consequences.length + (subjects?.length || 0);
  const linkCount =
    consequences.reduce((n, c) => n + Math.max(c.parentIds.length, 1), 0) +
    (subjects?.reduce((n, s) => n + s.relatedConsequenceIds.length, 0) || 0);

  const legendItems = [
    { label: 'Scenario', color: NODE_TYPE_COLORS.Seed },
    { label: 'Positive', color: NODE_TYPE_COLORS['Consequence-positive'] },
    { label: 'Negative', color: NODE_TYPE_COLORS['Consequence-negative'] },
    { label: 'Neutral', color: NODE_TYPE_COLORS['Consequence-neutral'] },
    { label: 'Idea / Solution', color: NODE_TYPE_COLORS.Idea },
    ...(subjects && subjects.length > 0
      ? [
          { label: 'Direct Subject', color: NODE_TYPE_COLORS['Subject-direct'] },
          { label: 'Tangential Subject', color: NODE_TYPE_COLORS['Subject-tangential'] },
        ]
      : []),
  ];

  return (
    <Box>
      <Box
        position="relative"
        h={height}
        rounded="xl"
        overflow="hidden"
        border="1px solid"
        borderColor="border.emphasized"
        bg={isDark ? '#111111' : '#FAFAFA'}
      >
        <Flex
          align="center"
          justify="center"
          direction="column"
          h="100%"
          gap={3}
          px={6}
          textAlign="center"
        >
          {/* Simple node count summary */}
          <Flex gap={2} flexWrap="wrap" justify="center">
            {legendItems.map((item) => (
              <Box
                key={item.label}
                w="12px"
                h="12px"
                rounded="full"
                bg={item.color}
                opacity={0.7}
              />
            ))}
          </Flex>

          <Text fontSize="lg" fontWeight="semibold" color="fg">
            Knowledge Graph
          </Text>
          <Text fontSize="sm" color="fg.muted" maxW="400px">
            {nodeCount} nodes · {linkCount} connections
          </Text>
          <Text fontSize="xs" color="fg.muted" maxW="400px" mt={2}>
            The interactive knowledge graph visualization is available in the
            full FAST application on the Subject pages.
          </Text>
        </Flex>
      </Box>

      {/* Legend */}
      <Flex gap={3} mt={3} flexWrap="wrap" justify="center">
        {legendItems.map((item) => (
          <Flex
            key={item.label}
            align="center"
            gap={1.5}
            fontSize="xs"
            color="fg.muted"
          >
            <Box
              w="8px"
              h="8px"
              rounded="full"
              bg={item.color}
              flexShrink={0}
            />
            <Text>{item.label}</Text>
          </Flex>
        ))}
      </Flex>
    </Box>
  );
}
