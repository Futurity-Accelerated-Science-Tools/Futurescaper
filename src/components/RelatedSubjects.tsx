import { useState } from 'react';
import { Box, Flex, Text } from '@chakra-ui/react';
import { ChevronDown, ChevronRight, Compass, Loader2 } from 'lucide-react';
import { RelevantSubject } from '../api/subjects';

/** Brand-colored hexagon subject icon — matches the Engine's IconSubject */
function SubjectHex({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <path d="M12 2L20.196 7V17L12 22L3.804 17V7L12 2Z" fill="#0005E9" stroke="#0005E9" strokeWidth="1" strokeLinejoin="round" />
    </svg>
  );
}

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
          <Box as={Compass} w={4} h={4} color="fg.muted" />
          <Text fontSize="sm" fontWeight="semibold" color="fg">
            Related Subjects
          </Text>
          {isLoading ? (
            <Box as={Loader2} w={3} h={3} color="fg.muted" className="animate-spin" />
          ) : (
            <Text fontSize="xs" color="fg.muted">({totalCount})</Text>
          )}
        </Flex>
      </Box>

      {isExpanded && (
        <Flex direction="column" gap={3} px={4} pb={4}>
          {isLoading && totalCount === 0 && (
            <Flex align="center" gap={2} fontSize="xs" color="fg.muted" py={2}>
              <Box as={Loader2} w={3} h={3} className="animate-spin" />
              Identifying relevant subjects...
            </Flex>
          )}

          {/* Direct subjects */}
          {directSubjects.length > 0 && (
            <Box>
              <Text fontSize="2xs" fontWeight="semibold" color="fg.muted" textTransform="uppercase" letterSpacing="wider" mb={1.5}>
                Directly Relevant ({directSubjects.length})
              </Text>
              <Flex direction="column" gap={0.5}>
                {directSubjects.map((s) => (
                  <Flex
                    key={s.name}
                    as="button"
                    title={s.reason}
                    align="center"
                    gap={2}
                    px={2}
                    py={1.5}
                    rounded="md"
                    fontSize="sm"
                    fontWeight="medium"
                    color="fg"
                    cursor="pointer"
                    _hover={{ bg: 'bg.hover' }}
                    transition="background 0.15s"
                    textAlign="left"
                  >
                    <SubjectHex size={14} />
                    <Text>{s.name}</Text>
                  </Flex>
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
                fontSize="2xs"
                fontWeight="semibold"
                color="fg.muted"
                textTransform="uppercase"
                letterSpacing="wider"
                mb={1.5}
                align="center"
                gap={1}
                _hover={{ color: 'fg' }}
                cursor="pointer"
              >
                Tangential ({tangentialSubjects.length})
                {showTangential ? (
                  <Box as={ChevronDown} w={3} h={3} />
                ) : (
                  <Box as={ChevronRight} w={3} h={3} />
                )}
              </Flex>
              {showTangential && (
                <Flex direction="column" gap={0.5}>
                  {tangentialSubjects.map((s) => (
                    <Flex
                      key={s.name}
                      as="button"
                      title={s.reason}
                      align="center"
                      gap={2}
                      px={2}
                      py={1.5}
                      rounded="md"
                      fontSize="sm"
                      color="fg.muted"
                      cursor="pointer"
                      _hover={{ bg: 'bg.hover', color: 'fg' }}
                      transition="all 0.15s"
                      textAlign="left"
                    >
                      <SubjectHex size={12} />
                      <Text>{s.name}</Text>
                    </Flex>
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
              color="fg.muted"
              _hover={{ color: 'fg' }}
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
