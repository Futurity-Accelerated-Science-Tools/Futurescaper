import { useState } from 'react';
import { Box, Flex, Text } from '@chakra-ui/react';
import { ChevronDown, ChevronRight, Compass, Zap, Loader2 } from 'lucide-react';
import { RelevantSubject } from '../api/subjects';

interface RelatedSubjectsProps {
  subjects: RelevantSubject[];
  isLoading: boolean;
  onRetry?: () => void;
}

export function RelatedSubjects({ subjects, isLoading, onRetry }: RelatedSubjectsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showTangential, setShowTangential] = useState(true);

  const directSubjects = subjects.filter(s => s.relevance === 'direct');
  const tangentialSubjects = subjects.filter(s => s.relevance === 'tangential');
  const totalCount = subjects.length;

  if (!isLoading && totalCount === 0) {
    return null;
  }

  return (
    <Box borderBottom="1px solid" borderColor="border.muted">
      <Box
        as="button"
        onClick={() => setIsExpanded(!isExpanded)}
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        w="full"
        p={4}
        _hover={{ bg: 'bg.hover' }}
        transition="background 0.15s"
        cursor="pointer"
      >
        <Flex align="center" gap={2}>
          {isExpanded ? (
            <Box as={ChevronDown} w={4} h={4} color="fg.muted" />
          ) : (
            <Box as={ChevronRight} w={4} h={4} color="fg.muted" />
          )}
          <Box as={Compass} w={4} h={4} color="brand.subtle" />
          <Text fontSize="sm" fontWeight="semibold" color="fg">
            Related Subjects
          </Text>
          {isLoading ? (
            <Box as={Loader2} w={3} h={3} color="brand.subtle" className="animate-spin" />
          ) : (
            <Text fontSize="xs" color="fg.muted">({totalCount})</Text>
          )}
        </Flex>
      </Box>

      {isExpanded && (
        <Flex direction="column" gap={3} px={4} pb={4}>
          {isLoading && totalCount === 0 && (
            <Flex align="center" gap={2} fontSize="xs" color="fg.secondary" py={2}>
              <Box as={Loader2} w={3} h={3} className="animate-spin" />
              Identifying relevant subjects...
            </Flex>
          )}

          {/* Direct subjects */}
          {directSubjects.length > 0 && (
            <Box>
              <Flex fontSize="xs" fontWeight="medium" color="fg.secondary" mb={1.5} align="center" gap={1}>
                <Box w={2} h={2} rounded="full" bg="brand.subtle" />
                Directly Relevant ({directSubjects.length})
              </Flex>
              <Flex flexWrap="wrap" gap={1.5}>
                {directSubjects.map((s) => (
                  <Text
                    key={s.name}
                    title={s.reason}
                    display="inline-block"
                    px={2}
                    py={0.5}
                    bg="brand/8"
                    color="fg.link"
                    borderWidth="1px"
                    borderColor="brand/20"
                    rounded="full"
                    fontSize="xs"
                    cursor="default"
                    _hover={{ bg: 'brand/12' }}
                    transition="background 0.15s"
                  >
                    {s.name}
                  </Text>
                ))}
              </Flex>
            </Box>
          )}

          {/* Tangential subjects */}
          {tangentialSubjects.length > 0 && (
            <Box>
              <Flex
                as="button"
                onClick={(e: React.MouseEvent) => { e.stopPropagation(); setShowTangential(!showTangential); }}
                fontSize="xs"
                fontWeight="medium"
                color="fg.secondary"
                mb={1.5}
                align="center"
                gap={1}
                _hover={{ color: 'fg' }}
                cursor="pointer"
              >
                <Box as={Zap} w={3} h={3} color="warning" />
                Tangential / Wildcard ({tangentialSubjects.length})
                {showTangential ? (
                  <Box as={ChevronDown} w={3} h={3} />
                ) : (
                  <Box as={ChevronRight} w={3} h={3} />
                )}
              </Flex>
              {showTangential && (
                <Flex flexWrap="wrap" gap={1.5}>
                  {tangentialSubjects.map((s) => (
                    <Text
                      key={s.name}
                      title={s.reason}
                      display="inline-block"
                      px={2}
                      py={0.5}
                      bg="warning/10"
                      color="fg"
                      borderWidth="1px"
                      borderColor="warning/25"
                      rounded="full"
                      fontSize="xs"
                      cursor="default"
                      _hover={{ bg: 'warning/15' }}
                      transition="background 0.15s"
                    >
                      {s.name}
                    </Text>
                  ))}
                </Flex>
              )}
            </Box>
          )}

          {!isLoading && totalCount === 0 && onRetry && (
            <Text
              as="button"
              onClick={onRetry}
              fontSize="xs"
              color="fg.link"
              _hover={{ textDecoration: 'underline' }}
              cursor="pointer"
            >
              Retry finding related subjects
            </Text>
          )}
        </Flex>
      )}
    </Box>
  );
}
