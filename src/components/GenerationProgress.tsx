import React from 'react';
import { Box, Flex, Text, Button } from '@chakra-ui/react';
import { Loader2, CheckCircle2, Circle } from 'lucide-react';

type Phase = 'idle' | 'first-order' | 'second-order' | 'third-order' | 'complete';

interface GenerationProgressProps {
  phase: Phase;
  onContinue?: () => void;
  onPause?: () => void;
  isPaused?: boolean;
}

export function GenerationProgress({ phase, onContinue, onPause, isPaused }: GenerationProgressProps) {
  const phases = [
    { key: 'first-order', label: 'First-Order Consequences', description: 'Obvious, intuitive effects' },
    { key: 'second-order', label: 'Second-Order Consequences', description: 'STEEP framework analysis' },
    { key: 'third-order', label: 'Third-Order Consequences', description: 'Wild cards & unknown unknowns' },
  ] as const;

  const getPhaseStatus = (phaseKey: string): 'complete' | 'active' | 'pending' => {
    const phaseOrder: string[] = ['first-order', 'second-order', 'third-order', 'complete'];
    const currentPhase: string = phase;
    const currentIndex = phaseOrder.indexOf(currentPhase);
    const phaseIndex = phaseOrder.indexOf(phaseKey);

    if (phaseIndex < currentIndex || currentPhase === 'complete') return 'complete';
    if (phaseIndex === currentIndex && currentPhase !== 'complete') return 'active';
    return 'pending';
  };

  if (phase === 'idle') return null;

  return (
    <Box bg="bg.canvas" rounded="xl" shadow="sm" borderWidth="1px" borderColor="border.muted" p={4}>
      <Flex align="center" justify="space-between" mb={3}>
        <Text fontSize="sm" fontWeight="semibold" color="fg" fontFamily="heading">
          {phase === 'complete' ? 'Generation Complete' : 'Generating Map'}
        </Text>
        {phase !== 'complete' && (
          <Flex gap={2}>
            {isPaused ? (
              <Button
                onClick={onContinue}
                size="sm"
                bg="brand"
                color="brand.contrast"
                rounded="lg"
                _hover={{ bg: 'brand.hover' }}
              >
                Continue
              </Button>
            ) : (
              <Button
                onClick={onPause}
                size="sm"
                bg="bg.hover"
                color="fg"
                rounded="lg"
                _hover={{ bg: 'bg.active' }}
              >
                Pause
              </Button>
            )}
          </Flex>
        )}
      </Flex>

      <Flex direction="column" gap={2.5}>
        {phases.map((p) => {
          const status = getPhaseStatus(p.key);
          return (
            <Flex key={p.key} align="center" gap={2.5}>
              {status === 'complete' ? (
                <Box as={CheckCircle2} w={4} h={4} color="fg" flexShrink={0} />
              ) : status === 'active' ? (
                <Box as={Loader2} w={4} h={4} color="brand" flexShrink={0} className="animate-spin" />
              ) : (
                <Box as={Circle} w={4} h={4} color="fg.muted" flexShrink={0} />
              )}
              <Box>
                <Text fontSize="xs" fontWeight="medium" color={status === 'pending' ? 'fg.muted' : 'fg'}>
                  {p.label}
                </Text>
                <Text fontSize="2xs" color="fg.muted">
                  {p.description}
                </Text>
              </Box>
            </Flex>
          );
        })}
      </Flex>

      {/* Waiting message */}
      {phase !== 'complete' && (
        <Box mt={4} pt={3} borderTopWidth="1px" borderColor="border.muted">
          <Text fontSize="xs" color="fg.muted">
            This takes 2–4 minutes. Feel free to switch tabs — results will be here when you return.
          </Text>
        </Box>
      )}
    </Box>
  );
}
