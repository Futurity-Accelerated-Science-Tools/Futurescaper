import React from 'react';
import { Box, Flex, Text } from '@chakra-ui/react';
import { STEEPCategory, Sentiment, ConsequenceOrder, STEEP_LABELS, SENTIMENT_SYMBOLS, ORDER_LABELS } from '../types';
import { Filter } from 'lucide-react';
import { SteepIcon, getSteepMutedBg, getSteepTextColor } from './SteepIcon';
import { useColorMode } from '../theme/ColorModeProvider';

interface FilterPanelProps {
  categories: STEEPCategory[];
  sentiments: Sentiment[];
  orders: ConsequenceOrder[];
  onToggleCategory: (category: STEEPCategory) => void;
  onToggleSentiment: (sentiment: Sentiment) => void;
  onToggleOrder: (order: ConsequenceOrder) => void;
}

export function FilterPanel({
  categories,
  sentiments,
  orders,
  onToggleCategory,
  onToggleSentiment,
  onToggleOrder,
}: FilterPanelProps) {
  const { colorMode } = useColorMode();
  const isDark = colorMode === 'dark';
  const allCategories: STEEPCategory[] = ['social', 'technological', 'economic', 'environmental', 'political', 'ethical'];
  const allSentiments: Sentiment[] = ['positive', 'negative', 'neutral'];
  const allOrders: ConsequenceOrder[] = [1, 2, 3];

  const sentimentLabels: Record<Sentiment, string> = {
    positive: 'Positive',
    negative: 'Negative',
    neutral: 'Neutral',
  };

  const orderShortLabels: Record<ConsequenceOrder, string> = {
    1: '1st',
    2: '2nd',
    3: '3rd',
  };

  return (
    <Box p={4} borderBottom="1px solid" borderColor="border.muted">
      <Flex align="center" gap={2} mb={4}>
        <Box as={Filter} w={4} h={4} color="fg.muted" />
        <Text fontWeight="semibold" color="fg">Filters</Text>
      </Flex>

      {/* STEEP Categories */}
      <Box mb={4}>
        <Text fontSize="xs" fontWeight="semibold" color="fg.muted" textTransform="uppercase" letterSpacing="wider" mb={2}>
          STEEP Categories
        </Text>
        <Flex direction="column" gap={1}>
          {allCategories.map((cat) => {
            const isActive = categories.includes(cat);
            return (
              <Box
                as="button"
                key={cat}
                onClick={() => onToggleCategory(cat)}
                display="flex"
                alignItems="center"
                gap={2}
                w="full"
                px={3}
                py={1.5}
                rounded="lg"
                fontSize="sm"
                transition="all 0.15s"
                style={isActive ? { backgroundColor: getSteepMutedBg(cat, isDark), color: getSteepTextColor(cat, isDark) } : {}}
                color={isActive ? undefined : 'fg.muted'}
                _hover={!isActive ? { color: 'fg.secondary' } : {}}
                cursor="pointer"
                fontWeight={isActive ? 'medium' : 'normal'}
              >
                <Box w={4} display="flex" justifyContent="center" opacity={isActive ? 1 : 0.3}>
                  <SteepIcon category={cat} size={14} />
                </Box>
                {STEEP_LABELS[cat]}
              </Box>
            );
          })}
        </Flex>
      </Box>

      {/* Sentiment */}
      <Box mb={4}>
        <Text fontSize="xs" fontWeight="semibold" color="fg.muted" textTransform="uppercase" letterSpacing="wider" mb={2}>
          Sentiment
        </Text>
        <Flex gap={1}>
          {allSentiments.map((sent) => {
            const isActive = sentiments.includes(sent);
            return (
              <Box
                as="button"
                key={sent}
                onClick={() => onToggleSentiment(sent)}
                flex={1}
                display="flex"
                alignItems="center"
                justifyContent="center"
                gap={1}
                px={2}
                py={1.5}
                rounded="lg"
                fontSize="xs"
                transition="all 0.15s"
                bg={isActive ? 'fg' : 'bg.hover'}
                color={isActive ? 'bg.canvas' : 'fg.muted'}
                cursor="pointer"
                title={sentimentLabels[sent]}
              >
                <Text fontSize="sm">{SENTIMENT_SYMBOLS[sent]}</Text>
              </Box>
            );
          })}
        </Flex>
      </Box>

      {/* Order */}
      <Box>
        <Text fontSize="xs" fontWeight="semibold" color="fg.muted" textTransform="uppercase" letterSpacing="wider" mb={2}>
          Consequence Order
        </Text>
        <Flex flexWrap="wrap" gap={1}>
          {allOrders.map((ord) => (
            <Box
              as="button"
              key={ord}
              onClick={() => onToggleOrder(ord)}
              px={2}
              py={1.5}
              rounded="lg"
              fontSize="xs"
              fontWeight="medium"
              transition="all 0.15s"
              bg={orders.includes(ord) ? 'brand' : 'bg.hover'}
              color={orders.includes(ord) ? 'brand.contrast' : 'fg.muted'}
              _hover={!orders.includes(ord) ? { bg: 'bg.active' } : {}}
              cursor="pointer"
              title={ORDER_LABELS[ord]}
            >
              {orderShortLabels[ord]}
            </Box>
          ))}
        </Flex>
        <Text fontSize="2xs" color="fg.muted" mt={1}>
          1: Direct → 2: Ripple → 3: Cascade
        </Text>
      </Box>
    </Box>
  );
}
