import React from 'react';
import { Box, Flex, Text, Button } from '@chakra-ui/react';
import { X, Layers } from 'lucide-react';
import {
  GenerationConfig,
  BranchingStrategy,
  DensityPreset,
  STRATEGY_LABELS,
  STRATEGY_DESCRIPTIONS,
  DENSITY_LABELS,
  DENSITY_DESCRIPTIONS,
} from '../types';
import { estimateNodeCount } from '../api/generationStrategy';

interface GenerationConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: GenerationConfig;
  onChange: (config: GenerationConfig) => void;
  verbosity: 'concise' | 'normal' | 'detailed';
}

// ── Mini SVG Tree Schematics ────────────────────────────────────

function TreeAsymmetric() {
  return (
    <svg viewBox="0 0 120 70" width="120" height="70" style={{ display: 'block' }}>
      {/* Seed */}
      <circle cx="10" cy="35" r="5" fill="var(--chakra-colors-fg, #1B1B1D)" opacity="0.8" />
      {/* First order — 3 visible */}
      <line x1="15" y1="35" x2="35" y2="12" stroke="var(--chakra-colors-fg-muted, #94a3b8)" strokeWidth="1.2" />
      <line x1="15" y1="35" x2="35" y2="35" stroke="var(--chakra-colors-fg-muted, #94a3b8)" strokeWidth="1.2" />
      <line x1="15" y1="35" x2="35" y2="58" stroke="var(--chakra-colors-fg-muted, #94a3b8)" strokeWidth="1.2" />
      <circle cx="35" cy="12" r="4" fill="#e91e8c" opacity="0.9" />
      <circle cx="35" cy="35" r="3.5" fill="var(--chakra-colors-fg-muted, #94a3b8)" opacity="0.5" />
      <circle cx="35" cy="58" r="3.5" fill="var(--chakra-colors-fg-muted, #94a3b8)" opacity="0.5" />
      {/* Deep branch from top (priority) — 4 children */}
      <line x1="39" y1="12" x2="60" y2="4" stroke="#e91e8c" strokeWidth="1.2" opacity="0.7" />
      <line x1="39" y1="12" x2="60" y2="12" stroke="#e91e8c" strokeWidth="1.2" opacity="0.7" />
      <line x1="39" y1="12" x2="60" y2="20" stroke="#e91e8c" strokeWidth="1.2" opacity="0.7" />
      <line x1="39" y1="12" x2="60" y2="28" stroke="#e91e8c" strokeWidth="1.2" opacity="0.7" />
      <circle cx="60" cy="4" r="3" fill="#e91e8c" opacity="0.6" />
      <circle cx="60" cy="12" r="3" fill="#e91e8c" opacity="0.6" />
      <circle cx="60" cy="20" r="3" fill="#e91e8c" opacity="0.6" />
      <circle cx="60" cy="28" r="3" fill="#e91e8c" opacity="0.6" />
      {/* Light branch from middle — 1 child */}
      <line x1="39" y1="35" x2="60" y2="38" stroke="var(--chakra-colors-fg-muted, #94a3b8)" strokeWidth="1" opacity="0.4" />
      <circle cx="60" cy="38" r="2.5" fill="var(--chakra-colors-fg-muted, #94a3b8)" opacity="0.35" />
      {/* Light branch from bottom — 1 child */}
      <line x1="39" y1="58" x2="60" y2="58" stroke="var(--chakra-colors-fg-muted, #94a3b8)" strokeWidth="1" opacity="0.4" />
      <circle cx="60" cy="58" r="2.5" fill="var(--chakra-colors-fg-muted, #94a3b8)" opacity="0.35" />
      {/* 3rd order from deep branch */}
      <line x1="63" y1="4" x2="82" y2="2" stroke="#e91e8c" strokeWidth="1" opacity="0.4" />
      <line x1="63" y1="4" x2="82" y2="10" stroke="#e91e8c" strokeWidth="1" opacity="0.4" />
      <circle cx="82" cy="2" r="2.5" fill="#e91e8c" opacity="0.35" />
      <circle cx="82" cy="10" r="2.5" fill="#e91e8c" opacity="0.35" />
      {/* Idea node */}
      <line x1="85" y1="2" x2="100" y2="2" stroke="#f59e0b" strokeWidth="1" opacity="0.5" />
      <circle cx="100" cy="2" r="2.5" fill="#f59e0b" opacity="0.6" />
    </svg>
  );
}

function TreeBalanced() {
  return (
    <svg viewBox="0 0 120 70" width="120" height="70" style={{ display: 'block' }}>
      <circle cx="10" cy="35" r="5" fill="var(--chakra-colors-fg, #1B1B1D)" opacity="0.8" />
      {/* 3 first-order */}
      <line x1="15" y1="35" x2="38" y2="12" stroke="var(--chakra-colors-fg-muted, #94a3b8)" strokeWidth="1.2" />
      <line x1="15" y1="35" x2="38" y2="35" stroke="var(--chakra-colors-fg-muted, #94a3b8)" strokeWidth="1.2" />
      <line x1="15" y1="35" x2="38" y2="58" stroke="var(--chakra-colors-fg-muted, #94a3b8)" strokeWidth="1.2" />
      <circle cx="38" cy="12" r="3.5" fill="#00d4aa" opacity="0.7" />
      <circle cx="38" cy="35" r="3.5" fill="#00d4aa" opacity="0.7" />
      <circle cx="38" cy="58" r="3.5" fill="#00d4aa" opacity="0.7" />
      {/* 2 children each */}
      {[12, 35, 58].map((y, i) => (
        <React.Fragment key={i}>
          <line x1="42" y1={y} x2="65" y2={y - 8} stroke="#00d4aa" strokeWidth="1" opacity="0.5" />
          <line x1="42" y1={y} x2="65" y2={y + 8} stroke="#00d4aa" strokeWidth="1" opacity="0.5" />
          <circle cx="65" cy={y - 8} r="2.5" fill="#00d4aa" opacity="0.45" />
          <circle cx="65" cy={y + 8} r="2.5" fill="#00d4aa" opacity="0.45" />
        </React.Fragment>
      ))}
      {/* 3rd order from top branch */}
      <line x1="68" y1="4" x2="88" y2="2" stroke="#00d4aa" strokeWidth="1" opacity="0.3" />
      <line x1="68" y1="4" x2="88" y2="8" stroke="#00d4aa" strokeWidth="1" opacity="0.3" />
      <circle cx="88" cy="2" r="2" fill="#00d4aa" opacity="0.3" />
      <circle cx="88" cy="8" r="2" fill="#00d4aa" opacity="0.3" />
    </svg>
  );
}

function TreeBreadth() {
  return (
    <svg viewBox="0 0 120 70" width="120" height="70" style={{ display: 'block' }}>
      <circle cx="10" cy="35" r="5" fill="var(--chakra-colors-fg, #1B1B1D)" opacity="0.8" />
      {/* 5 first-order — fanned out wide */}
      {[8, 20, 35, 50, 62].map((y, i) => (
        <React.Fragment key={i}>
          <line x1="15" y1="35" x2="38" y2={y} stroke="var(--chakra-colors-fg-muted, #94a3b8)" strokeWidth="1.2" />
          <circle cx="38" cy={y} r="3" fill="#7c5cfc" opacity="0.7" />
        </React.Fragment>
      ))}
      {/* 1-2 children each (sparse) */}
      {[8, 20, 35, 50, 62].map((y, i) => (
        <React.Fragment key={`c-${i}`}>
          <line x1="41" y1={y} x2="60" y2={y - 3} stroke="#7c5cfc" strokeWidth="1" opacity="0.4" />
          <circle cx="60" cy={y - 3} r="2" fill="#7c5cfc" opacity="0.35" />
          {i < 3 && (
            <>
              <line x1="41" y1={y} x2="60" y2={y + 5} stroke="#7c5cfc" strokeWidth="1" opacity="0.3" />
              <circle cx="60" cy={y + 5} r="2" fill="#7c5cfc" opacity="0.25" />
            </>
          )}
        </React.Fragment>
      ))}
    </svg>
  );
}

function TreeDepth() {
  return (
    <svg viewBox="0 0 120 70" width="120" height="70" style={{ display: 'block' }}>
      <circle cx="6" cy="35" r="5" fill="var(--chakra-colors-fg, #1B1B1D)" opacity="0.8" />
      {/* 2 first-order */}
      <line x1="11" y1="35" x2="26" y2="18" stroke="var(--chakra-colors-fg-muted, #94a3b8)" strokeWidth="1.2" />
      <line x1="11" y1="35" x2="26" y2="52" stroke="var(--chakra-colors-fg-muted, #94a3b8)" strokeWidth="1.2" />
      <circle cx="26" cy="18" r="3.5" fill="#ff6b35" opacity="0.8" />
      <circle cx="26" cy="52" r="3.5" fill="#ff6b35" opacity="0.5" />
      {/* Deep chain from top: 2nd order */}
      <line x1="30" y1="18" x2="44" y2="10" stroke="#ff6b35" strokeWidth="1.2" opacity="0.7" />
      <line x1="30" y1="18" x2="44" y2="24" stroke="#ff6b35" strokeWidth="1.2" opacity="0.7" />
      <circle cx="44" cy="10" r="3" fill="#ff6b35" opacity="0.65" />
      <circle cx="44" cy="24" r="3" fill="#ff6b35" opacity="0.45" />
      {/* 3rd order */}
      <line x1="47" y1="10" x2="62" y2="6" stroke="#ff6b35" strokeWidth="1" opacity="0.55" />
      <line x1="47" y1="10" x2="62" y2="16" stroke="#ff6b35" strokeWidth="1" opacity="0.55" />
      <circle cx="62" cy="6" r="2.5" fill="#ff6b35" opacity="0.5" />
      <circle cx="62" cy="16" r="2.5" fill="#ff6b35" opacity="0.4" />
      {/* 4th order */}
      <line x1="65" y1="6" x2="80" y2="4" stroke="#ff6b35" strokeWidth="1" opacity="0.4" />
      <line x1="65" y1="6" x2="80" y2="11" stroke="#ff6b35" strokeWidth="1" opacity="0.4" />
      <circle cx="80" cy="4" r="2" fill="#ff6b35" opacity="0.35" />
      <circle cx="80" cy="11" r="2" fill="#ff6b35" opacity="0.35" />
      {/* 5th order */}
      <line x1="82" y1="4" x2="96" y2="4" stroke="#ff6b35" strokeWidth="1" opacity="0.3" />
      <circle cx="96" cy="4" r="2" fill="#ff6b35" opacity="0.25" />
      {/* Light branch from bottom */}
      <line x1="30" y1="52" x2="44" y2="52" stroke="#ff6b35" strokeWidth="1" opacity="0.3" />
      <circle cx="44" cy="52" r="2.5" fill="#ff6b35" opacity="0.3" />
      <line x1="47" y1="52" x2="62" y2="50" stroke="#ff6b35" strokeWidth="1" opacity="0.2" />
      <circle cx="62" cy="50" r="2" fill="#ff6b35" opacity="0.2" />
    </svg>
  );
}

const STRATEGY_TREES: Record<BranchingStrategy, React.FC> = {
  asymmetric: TreeAsymmetric,
  balanced: TreeBalanced,
  breadth: TreeBreadth,
  depth: TreeDepth,
};

// ── Component ───────────────────────────────────────────────────

export function GenerationConfigModal({ isOpen, onClose, config, onChange, verbosity }: GenerationConfigModalProps) {
  if (!isOpen) return null;

  const strategies: BranchingStrategy[] = ['asymmetric', 'balanced', 'breadth', 'depth'];
  const densities: DensityPreset[] = ['focused', 'standard', 'comprehensive'];
  const estimated = estimateNodeCount(config, verbosity);

  const densityRanges: Record<DensityPreset, string> = {
    focused: '~15-20',
    standard: '~25-35',
    comprehensive: '~45-60',
  };

  return (
    <Box
      position="fixed"
      inset={0}
      zIndex={50}
      display="flex"
      alignItems="center"
      justifyContent="center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <Box position="absolute" inset={0} bg="blackAlpha.500" />

      {/* Modal panel */}
      <Box
        position="relative"
        w={{ base: '95%', md: '640px' }}
        maxH="90vh"
        bg="bg.canvas"
        rounded="2xl"
        shadow="2xl"
        borderWidth="1px"
        borderColor="border.muted"
        overflowY="auto"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        {/* Header */}
        <Flex px={6} py={4} align="center" justify="space-between" borderBottom="1px solid" borderColor="border.muted">
          <Flex align="center" gap={2}>
            <Box as={Layers} w={5} h={5} color="fg.muted" />
            <Text fontSize="lg" fontWeight="semibold" color="fg">Configure Generation</Text>
          </Flex>
          <Box
            as="button"
            onClick={onClose}
            p={1.5}
            rounded="md"
            color="fg.muted"
            _hover={{ color: 'fg', bg: 'bg.hover' }}
            transition="all 0.15s"
          >
            <X style={{ width: 18, height: 18 }} />
          </Box>
        </Flex>

        {/* Body */}
        <Box px={6} py={5}>
          {/* Branching Strategy */}
          <Box mb={6}>
            <Text fontSize="sm" fontWeight="semibold" color="fg" mb={3}>Branching Strategy</Text>
            <Box display="grid" gridTemplateColumns="repeat(2, 1fr)" gap={3}>
              {strategies.map((s) => {
                const isActive = config.strategy === s;
                const TreeSvg = STRATEGY_TREES[s];
                return (
                  <Box
                    as="button"
                    key={s}
                    type="button"
                    onClick={() => onChange({ ...config, strategy: s })}
                    p={4}
                    rounded="xl"
                    borderWidth="2px"
                    transition="all 0.15s"
                    cursor="pointer"
                    textAlign="left"
                    borderColor={isActive ? 'brand' : 'border.muted'}
                    bg={isActive ? 'brand/5' : 'transparent'}
                    _hover={!isActive ? { borderColor: 'fg.muted', bg: 'bg.hover' } : undefined}
                  >
                    <Box mb={2} opacity={isActive ? 1 : 0.6}>
                      <TreeSvg />
                    </Box>
                    <Text fontSize="sm" fontWeight="semibold" color={isActive ? 'brand' : 'fg'} mb={0.5}>
                      {STRATEGY_LABELS[s]}
                    </Text>
                    <Text fontSize="xs" color="fg.muted" lineHeight="1.4">
                      {STRATEGY_DESCRIPTIONS[s]}
                    </Text>
                  </Box>
                );
              })}
            </Box>
          </Box>

          {/* Density */}
          <Box mb={5}>
            <Text fontSize="sm" fontWeight="semibold" color="fg" mb={3}>Density</Text>
            <Box display="grid" gridTemplateColumns="repeat(3, 1fr)" gap={2}>
              {densities.map((d) => {
                const isActive = config.density === d;
                return (
                  <Box
                    as="button"
                    key={d}
                    type="button"
                    onClick={() => onChange({ ...config, density: d })}
                    py={3}
                    px={3}
                    rounded="lg"
                    borderWidth="2px"
                    transition="all 0.15s"
                    cursor="pointer"
                    borderColor={isActive ? 'brand' : 'border.muted'}
                    bg={isActive ? 'brand/5' : 'transparent'}
                    _hover={!isActive ? { borderColor: 'fg.muted' } : undefined}
                  >
                    <Text fontSize="sm" fontWeight="semibold" color={isActive ? 'brand' : 'fg'}>
                      {DENSITY_LABELS[d]}
                    </Text>
                    <Text fontSize="xs" color="fg.muted">
                      {DENSITY_DESCRIPTIONS[d]}
                    </Text>
                    <Text fontSize="xs" color="fg.muted" mt={0.5} opacity={0.7}>
                      {densityRanges[d]} nodes
                    </Text>
                  </Box>
                );
              })}
            </Box>
          </Box>

          {/* Live estimate */}
          <Flex
            justify="center"
            align="center"
            gap={2}
            py={3}
            px={4}
            rounded="lg"
            bg="bg.hover"
            borderWidth="1px"
            borderColor="border.muted"
            mb={4}
          >
            <Text fontSize="sm" color="fg.secondary">
              Estimated output:
            </Text>
            <Text fontSize="sm" fontWeight="bold" color="fg">
              ~{estimated} nodes
            </Text>
            {verbosity !== 'normal' && (
              <Text fontSize="xs" color="fg.muted">
                (adjusted for {verbosity} detail)
              </Text>
            )}
          </Flex>

          {/* Done */}
          <Button
            type="button"
            onClick={onClose}
            w="full"
            py={3}
            bg="brand"
            color="brand.contrast"
            rounded="xl"
            fontWeight="semibold"
            fontSize="sm"
            _hover={{ bg: 'brand.hover' }}
          >
            Done
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
