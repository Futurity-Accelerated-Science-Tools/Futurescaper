import React, { useState } from 'react';
import { Box, Flex, Text, Button } from '@chakra-ui/react';
import { Consequence, STEEP_LABELS, SENTIMENT_SYMBOLS } from '../types';
import { TrendingUp, TrendingDown, Minus, X, Edit3, Trash2, Zap, Expand, Loader2, AlertTriangle, Lightbulb, Wrench } from 'lucide-react';
import { SteepIcon, getSteepMutedBg, getSteepTextColor } from './SteepIcon';
import { useColorMode } from '../theme/ColorModeProvider';

interface DetailPanelProps {
  consequence: Consequence | null;
  allConsequences: Consequence[];
  onClose: () => void;
  onEdit?: (id: string, newText: string) => void;
  onDelete?: (id: string) => void;
  onExpand?: (id: string) => void;
  onGenerateIdeas?: (id: string) => void;
  isExpanding?: boolean;
  isGeneratingIdeas?: boolean;
}

function DeleteSection({ consequence, children, onEdit, onDelete }: {
  consequence: Consequence;
  children: Consequence[];
  onEdit?: (id: string, newText: string) => void;
  onDelete?: (id: string) => void;
}) {
  const [showConfirm, setShowConfirm] = useState(false);
  const hasChildren = children.length > 0;

  return (
    <Box pt={3} borderTopWidth="1px" borderColor="border.muted">
      {showConfirm ? (
        <Box bg="error/8" borderWidth="1px" borderColor="error/20" rounded="lg" p={3}>
          <Flex align="center" gap={2} mb={2}>
            <Box as={AlertTriangle} w={4} h={4} color="fg.error" />
            <Text fontSize="sm" fontWeight="medium" color="fg.error">Delete this node?</Text>
          </Flex>
          <Text fontSize="xs" color="fg.muted" mb={3}>This action cannot be undone.</Text>
          <Flex gap={2}>
            <Button
              flex={1}
              size="xs"
              py={1.5}
              fontSize="xs"
              fontWeight="medium"
              color="white"
              bg="red.500"
              _hover={{ bg: 'red.600' }}
              rounded="md"
              onClick={() => { onDelete?.(consequence.id); setShowConfirm(false); }}
            >
              Yes, Delete
            </Button>
            <Button
              flex={1}
              size="xs"
              py={1.5}
              fontSize="xs"
              fontWeight="medium"
              color="fg.secondary"
              bg="bg.hover"
              _hover={{ bg: 'bg.active' }}
              rounded="md"
              onClick={() => setShowConfirm(false)}
            >
              Cancel
            </Button>
          </Flex>
        </Box>
      ) : (
        <Flex gap={2}>
          {onEdit && (
            <Button
              flex={1}
              variant="ghost"
              size="sm"
              fontSize="sm"
              color="fg.secondary"
              _hover={{ bg: 'bg.hover' }}
              rounded="lg"
              onClick={() => {
                const newText = prompt('Edit consequence:', consequence.text);
                if (newText) onEdit(consequence.id, newText);
              }}
            >
              <Flex align="center" justify="center" gap={2}>
                <Box as={Edit3} w={4} h={4} />
                <Text>Edit</Text>
              </Flex>
            </Button>
          )}
          {onDelete && (
            <Button
              flex={1}
              variant="ghost"
              size="sm"
              fontSize="sm"
              rounded="lg"
              color={hasChildren ? 'fg.muted' : 'fg.error'}
              cursor={hasChildren ? 'not-allowed' : 'pointer'}
              _hover={hasChildren ? {} : { bg: 'error/8' }}
              disabled={hasChildren}
              onClick={() => hasChildren ? null : setShowConfirm(true)}
              title={hasChildren ? 'Remove child nodes first' : 'Delete this node'}
            >
              <Flex align="center" justify="center" gap={2}>
                <Box as={Trash2} w={4} h={4} />
                <Text>{hasChildren ? 'Has Children' : 'Delete'}</Text>
              </Flex>
            </Button>
          )}
        </Flex>
      )}
      {hasChildren && !showConfirm && (
        <Text fontSize="xs" color="fg.muted" mt={1} textAlign="center">Remove child nodes first to delete this node</Text>
      )}
    </Box>
  );
}

export function DetailPanel({ consequence, allConsequences, onClose, onEdit, onDelete, onExpand, onGenerateIdeas, isExpanding, isGeneratingIdeas }: DetailPanelProps) {
  const { colorMode } = useColorMode();
  const isDark = colorMode === 'dark';

  if (!consequence) return null;

  const isSolutionOrIdea = consequence.nodeType === 'solution' || consequence.nodeType === 'idea';
  const steepMutedColor = getSteepMutedBg(consequence.category, isDark);
  const steepTextColor = getSteepTextColor(consequence.category, isDark);
  const sentimentSymbol = SENTIMENT_SYMBOLS[consequence.sentiment];

  const SentimentIcon = isSolutionOrIdea
    ? (consequence.nodeType === 'idea' ? Lightbulb : Wrench)
    : consequence.sentiment === 'positive'
      ? TrendingUp
      : consequence.sentiment === 'negative'
        ? TrendingDown
        : Minus;

  // Find parent consequence (use primary parent — first in the array)
  const primaryParentId = consequence.parentIds.length > 0 ? consequence.parentIds[0] : null;
  const parent = primaryParentId && primaryParentId !== 'seed'
    ? allConsequences.find(c => c.id === primaryParentId)
    : null;

  // Find child consequences
  const children = allConsequences.filter(c => c.parentIds.includes(consequence.id));

  const orderLabels = ['', 'First-Order', 'Second-Order', 'Third-Order'];

  return (
    <Box bg="bg.canvas" rounded="xl" shadow="sm" borderWidth="1px" borderColor="border.muted" p={5} w="320px" className="fade-in-up">
      <Flex align="start" justify="space-between" mb={4}>
        <Box
          display="inline-flex"
          alignItems="center"
          gap={1.5}
          fontSize="sm"
          fontWeight="medium"
          style={{ backgroundColor: steepMutedColor, color: steepTextColor }}
          px={2}
          py={0.5}
          rounded="md"
        >
          <SteepIcon category={consequence.category} size={14} />
          <Text as="span">{STEEP_LABELS[consequence.category]}</Text>
        </Box>
        <Button variant="ghost" size="xs" color="fg.muted" _hover={{ color: 'fg.secondary' }} onClick={onClose}>
          <Box as={X} w={5} h={5} />
        </Button>
      </Flex>

      <Box
        rounded="lg"
        p={4}
        mb={4}
        bg="bg.hover"
      >
        <Flex align="start" gap={2}>
          <Box as={SentimentIcon} w={5} h={5} flexShrink={0} mt={0.5} color="fg" />
          <Box>
            {isSolutionOrIdea && consequence.title && (
              <Text fontWeight="bold" fontSize="lg" mb={1} color="fg">
                {consequence.title}
              </Text>
            )}
            <Text fontWeight="medium" color="fg">
              {consequence.text}
            </Text>
          </Box>
        </Flex>
      </Box>

      <Flex direction="column" gap={3} mb={4}>
        {isSolutionOrIdea && (
          <Flex align="center" gap={2} fontSize="sm">
            <Text color="fg.secondary">Type:</Text>
            <Flex align="center" gap={1} fontWeight="medium" color="fg">
              <Box as={consequence.nodeType === 'idea' ? Lightbulb : Wrench} w={3.5} h={3.5} />
              <Text>{consequence.nodeType === 'idea' ? 'Idea / Opportunity' : 'Solution / Mitigation'}</Text>
            </Flex>
          </Flex>
        )}
        <Flex align="center" gap={2} fontSize="sm">
          <Text color="fg.secondary">Order:</Text>
          <Text fontWeight="medium" color="fg">
            {orderLabels[consequence.order]}
            {consequence.probability === 'wildcard' && (
              <Text as="span" display="inline-flex" alignItems="center" gap={1} ml={2} color="purple.600">
                <Box as={Zap} w={3} h={3} /> Wildcard
              </Text>
            )}
          </Text>
        </Flex>

        {!isSolutionOrIdea && (
          <Flex align="center" gap={2} fontSize="sm">
            <Text color="fg.secondary">Sentiment:</Text>
            <Box
              display="inline-flex"
              alignItems="center"
              gap={1}
              px={2}
              py={0.5}
              rounded="md"
              fontSize="xs"
              fontWeight="medium"
              style={{
                backgroundColor: consequence.sentiment === 'positive'
                  ? (isDark ? 'rgba(34,197,94,0.15)' : '#e6fff5')
                  : consequence.sentiment === 'negative'
                    ? (isDark ? 'rgba(239,68,68,0.15)' : '#fff0f3')
                    : (isDark ? 'rgba(148,163,184,0.15)' : '#e8eaef'),
                color: consequence.sentiment === 'positive'
                  ? (isDark ? '#4ade80' : '#0a6847')
                  : consequence.sentiment === 'negative'
                    ? (isDark ? '#f87171' : '#a4133c')
                    : (isDark ? '#94a3b8' : '#2d3341'),
              }}
            >
              <Text as="span">{sentimentSymbol}</Text>
              <Box as={SentimentIcon} w={3.5} h={3.5} />
              <Text as="span" textTransform="capitalize">{consequence.sentiment}</Text>
            </Box>
          </Flex>
        )}
      </Flex>

      {parent && (
        <Box mb={4}>
          <Text fontSize="xs" fontWeight="semibold" color="fg.secondary" textTransform="uppercase" letterSpacing="wider" mb={2}>Caused By</Text>
          <Box
            fontSize="sm"
            p={2}
            rounded="lg"
            bg="bg.hover"
            color="fg"
          >
            {parent.text}
          </Box>
        </Box>
      )}

      {children.length > 0 && (
        <Box mb={4}>
          <Text fontSize="xs" fontWeight="semibold" color="fg.secondary" textTransform="uppercase" letterSpacing="wider" mb={2}>
            Leads To ({children.length})
          </Text>
          <Flex direction="column" gap={2} maxH="128px" overflowY="auto">
            {children.map((child) => (
              <Box
                key={child.id}
                fontSize="sm"
                p={2}
                rounded="lg"
                bg="bg.hover"
                color="fg"
              >
                {child.text}
              </Box>
            ))}
          </Flex>
        </Box>
      )}

      {/* Expand button - Generate more consequences from this node */}
      {onExpand && consequence.order < 3 && (
        <Box mb={4}>
          <Button
            w="full"
            size="sm"
            py={2.5}
            fontSize="sm"
            fontWeight="medium"
            color="white"
            bg="seed"
            _hover={{ bg: 'seed-dark' }}
            _disabled={{ bg: 'bg.active', color: 'fg.muted' }}
            rounded="lg"
            disabled={isExpanding || isGeneratingIdeas}
            onClick={() => onExpand(consequence.id)}
          >
            {isExpanding ? (
              <Flex align="center" justify="center" gap={2}>
                <Box as={Loader2} w={4} h={4} className="animate-spin" />
                <Text>Generating...</Text>
              </Flex>
            ) : (
              <Flex align="center" justify="center" gap={2}>
                <Box as={Expand} w={4} h={4} />
                <Text>Expand Node (Generate 3-4 More)</Text>
              </Flex>
            )}
          </Button>
          <Text fontSize="xs" color="fg.secondary" mt={1} textAlign="center">
            AI will generate more consequences from this node
          </Text>
        </Box>
      )}

      {/* Generate Ideas/Solutions button - only for consequence nodes */}
      {onGenerateIdeas && !isSolutionOrIdea && (
        <Box mb={4}>
          <Button
            w="full"
            size="sm"
            py={2.5}
            fontSize="sm"
            fontWeight="medium"
            color="fg"
            bg="bg.hover"
            _hover={{ bg: 'bg.active' }}
            borderWidth="1px"
            borderColor="border.muted"
            _disabled={{ bg: 'bg.hover', color: 'fg.muted', borderColor: 'border.muted' }}
            rounded="lg"
            disabled={isGeneratingIdeas || isExpanding}
            onClick={() => onGenerateIdeas(consequence.id)}
          >
            {isGeneratingIdeas ? (
              <Flex align="center" justify="center" gap={2}>
                <Box as={Loader2} w={4} h={4} className="animate-spin" />
                <Text>Generating...</Text>
              </Flex>
            ) : (
              <Flex align="center" justify="center" gap={2}>
                <Box as={Lightbulb} w={4} h={4} />
                <Text>
                  {consequence.sentiment === 'negative' ? 'Generate Solutions' : consequence.sentiment === 'positive' ? 'Generate Ideas' : 'Generate Ideas & Solutions'}
                </Text>
              </Flex>
            )}
          </Button>
          <Text fontSize="xs" color="fg.secondary" mt={1} textAlign="center">
            {consequence.sentiment === 'negative' ? 'AI will suggest mitigations for this risk' : consequence.sentiment === 'positive' ? 'AI will suggest ways to capitalize on this' : 'AI will suggest ideas and solutions'}
          </Text>
        </Box>
      )}

      {(onEdit || onDelete) && (
        <DeleteSection
          consequence={consequence}
          children={children}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      )}
    </Box>
  );
}
