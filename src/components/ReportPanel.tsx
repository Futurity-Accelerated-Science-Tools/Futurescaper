import { useState, useRef, useEffect } from 'react';
import { Box, Flex, Text } from '@chakra-ui/react';
import type { Node, Edge } from '@xyflow/react';
import {
  ArrowLeft,
  Clock,
  ChevronDown,
  ChevronRight,
  List,
  FileText,
  AlertTriangle,
  Lightbulb,
  BarChart3,
  BookOpen,
  TrendingDown,
  TrendingUp,
  Zap,
  Sparkles,
  Target,
  Moon,
  Sun,
  Globe,
  Network,
  Download,
} from 'lucide-react';
import { useColorMode } from '../theme/ColorModeProvider';
import {
  ReportData,
  ReportSection,
  ReportSubSection,
  Consequence,
  STEEP_LABELS,
  HORIZON_LABELS,
} from '../types';
import { ReadOnlyMap } from './ReadOnlyMap';
import {
  STEEPERadarChart,
  SentimentFlowChart,
  RiskOpportunityMatrix,
  TimelineDistribution,
  InsightCard,
  IdeaCard,
  SubjectCard,
} from './ReportCharts';
import { parseReportProse, ConsequenceCardPreview } from './ConsequenceRef';
import { ReportKnowledgeGraph } from './ReportKnowledgeGraph';
import { snapshotReportToHtml } from './reportHtmlExport';

// ── Icon map ─────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ElementType> = {
  FileText,
  AlertTriangle,
  Lightbulb,
  BarChart3,
  BookOpen,
};

function SectionIcon({ name, size = 16 }: { name: string; size?: number }) {
  const Icon = ICON_MAP[name] || FileText;
  return <Icon size={size} />;
}

// ── Key Metrics Bar ─────────────────────────────────────────────

function KeyMetrics({ report }: { report: ReportData }) {
  const { statistics: s } = report;
  const metrics = [
    { label: 'Consequences', value: s.totalConsequences, icon: Zap },
    { label: 'High Risk', value: s.criticalNegativeCount, icon: TrendingDown, color: '#ff4d6d' },
    { label: 'Wildcards', value: s.wildcardCount, icon: AlertTriangle, color: '#ff9f1c' },
    { label: 'Positive', value: s.bySentiment.positive, icon: TrendingUp, color: '#3DB462' },
  ];

  return (
    <Flex gap={3} flexWrap="wrap">
      {metrics.map(m => (
        <Flex
          key={m.label}
          flex="1"
          minW="120px"
          align="center"
          gap={3}
          p={4}
          rounded="xl"
          border="1px solid"
          borderColor="border.emphasized"
          bg="bg"
        >
          <Flex
            align="center"
            justify="center"
            w="36px" h="36px"
            rounded="lg"
            bg="bg.subtle"
            color={m.color || 'fg.muted'}
            flexShrink={0}
          >
            <m.icon size={18} />
          </Flex>
          <Box>
            <Text fontSize="xl" fontWeight="bold" fontFamily="mono" color="fg" lineHeight={1}>
              {m.value}
            </Text>
            <Text fontSize="2xs" color="fg.muted" fontWeight="semibold" textTransform="uppercase" letterSpacing="wider">
              {m.label}
            </Text>
          </Box>
        </Flex>
      ))}
    </Flex>
  );
}

// ── Distribution Bar (for statistics section) ───────────────────

function DistributionBar({ data }: { data: Record<string, number> }) {
  const total = Object.values(data).reduce((sum, n) => sum + n, 0);
  if (total === 0) return null;

  const barColors = [
    '#8285FF', '#00d4aa', '#ff9f1c', '#ff4d6d', '#7c5cfc', '#22c55e',
    '#e91e8c', '#46ACC8', '#F2CD5D', '#c8e600',
  ];

  const entries = Object.entries(data).filter(([, n]) => n > 0);

  return (
    <Box mt={2}>
      <Flex h="6px" rounded="full" overflow="hidden" bg="bg.muted" mb={2}>
        {entries.map(([label, count], i) => (
          <Box key={label} w={`${(count / total) * 100}%`} bg={barColors[i % barColors.length]} transition="width 0.3s ease" />
        ))}
      </Flex>
      <Flex gap={3} flexWrap="wrap">
        {entries.map(([label, count], i) => (
          <Flex key={label} align="center" gap={1.5} fontSize="xs" color="fg.muted">
            <Box w="8px" h="8px" rounded="sm" bg={barColors[i % barColors.length]} flexShrink={0} />
            <Text>{label}</Text>
            <Text fontWeight="semibold" color="fg">{count}</Text>
          </Flex>
        ))}
      </Flex>
    </Box>
  );
}

// ── SubSection Renderer ─────────────────────────────────────────

function SubSectionCard({ sub }: { sub: ReportSubSection }) {
  return (
    <Box p={4} rounded="lg" bg="bg.subtle" border="1px solid" borderColor="border.muted">
      <Text fontSize="xs" fontWeight="semibold" color="fg.muted" textTransform="uppercase" letterSpacing="wider" mb={2}>
        {sub.title}
      </Text>
      {sub.type === 'distribution' && sub.data ? (
        <>
          <Text fontSize="sm" color="fg.muted" mb={1}>{sub.content}</Text>
          <DistributionBar data={sub.data} />
        </>
      ) : (
        <Text fontSize="sm" color="fg" whiteSpace="pre-wrap" lineHeight="1.6">{sub.content}</Text>
      )}
    </Box>
  );
}

// ── Section Card (collapsible) ──────────────────────────────────

interface SectionCardProps {
  section: ReportSection;
  defaultExpanded: boolean;
  consequences?: Consequence[];
  /** Extra content rendered after the main prose (e.g., charts) */
  extraContent?: React.ReactNode;
  /** When true, force the section open (used during export snapshot) */
  forceExpanded?: boolean;
}

function SectionCard({ section, defaultExpanded, consequences, extraContent, forceExpanded }: SectionCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const isExpanded = forceExpanded || expanded;

  return (
    <Box
      id={`report-section-${section.id}`}
      border="1px solid"
      borderColor="border.emphasized"
      rounded="xl"
      overflow="hidden"
      bg="bg"
      transition="box-shadow 0.2s"
      _hover={{ shadow: 'xs' }}
    >
      {/* Header */}
      <Flex
        {...(!forceExpanded ? { as: 'button' as const, onClick: () => setExpanded(!expanded), cursor: 'pointer', _hover: { bg: 'bg.subtle' } } : {})}
        align="center"
        gap={3}
        w="full"
        p={5}
        transition="background 0.15s"
      >
        <Flex align="center" justify="center" w="36px" h="36px" rounded="lg" bg="bg.subtle" color="fg.muted" flexShrink={0}>
          <SectionIcon name={section.icon} size={18} />
        </Flex>
        <Text fontSize="md" fontWeight="semibold" fontFamily="heading" color="fg" flex={1} textAlign="left">
          {section.title}
        </Text>
        {!forceExpanded && (
          <Box color="fg.muted">
            {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          </Box>
        )}
      </Flex>

      {/* Body */}
      {isExpanded && (
        <Box px={5} pb={5}>
          {/* Main content — AI prose gets consequence ID parsing */}
          {section.type === 'ai-prose' && consequences ? (
            <Text fontSize="sm" color="fg" lineHeight="1.75" fontFamily="sans" whiteSpace="pre-wrap">
              {parseReportProse(section.content, consequences)}
            </Text>
          ) : section.type === 'ai-prose' ? (
            <Text fontSize="sm" color="fg" lineHeight="1.75" fontFamily="sans" whiteSpace="pre-wrap">
              {section.content}
            </Text>
          ) : section.type === 'methodology' ? (
            <Text fontSize="sm" color="fg.muted" lineHeight="1.75" fontFamily="sans" whiteSpace="pre-wrap">
              {section.content}
            </Text>
          ) : (
            <Text fontSize="sm" color="fg.muted" mb={3}>{section.content}</Text>
          )}

          {/* Extra content (charts, etc.) */}
          {extraContent}

          {/* Subsections */}
          {section.subsections && section.subsections.length > 0 && (
            <Flex direction="column" gap={3} mt={4}>
              {section.subsections.map(sub => (
                <SubSectionCard key={sub.id} sub={sub} />
              ))}
            </Flex>
          )}
        </Box>
      )}
    </Box>
  );
}

// ── Generic Collapsible Section ─────────────────────────────────
// Used for sections that don't come from ReportSection (Key Insights, etc.)

interface CollapsibleSectionProps {
  id: string;
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  defaultExpanded: boolean;
  children: React.ReactNode;
  /** When true, force the section open (used during export snapshot) */
  forceExpanded?: boolean;
}

function CollapsibleSection({ id, icon, title, subtitle, defaultExpanded, children, forceExpanded }: CollapsibleSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const isExpanded = forceExpanded || expanded;

  return (
    <Box
      id={`report-section-${id}`}
      border="1px solid"
      borderColor="border.emphasized"
      rounded="xl"
      overflow="hidden"
      bg="bg"
      transition="box-shadow 0.2s"
      _hover={{ shadow: 'xs' }}
    >
      <Flex
        {...(!forceExpanded ? { as: 'button' as const, onClick: () => setExpanded(!expanded), cursor: 'pointer', _hover: { bg: 'bg.subtle' } } : {})}
        align="center"
        gap={3}
        w="full"
        p={5}
        transition="background 0.15s"
      >
        <Flex align="center" justify="center" w="36px" h="36px" rounded="lg" bg="bg.subtle" color="fg.muted" flexShrink={0}>
          {icon}
        </Flex>
        <Box flex={1} textAlign="left">
          <Text fontSize="md" fontWeight="semibold" fontFamily="heading" color="fg">
            {title}
          </Text>
          {subtitle && (
            <Text fontSize="xs" color="fg.muted" mt={0.5}>
              {subtitle}
            </Text>
          )}
        </Box>
        {!forceExpanded && (
          <Box color="fg.muted">
            {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          </Box>
        )}
      </Flex>

      {isExpanded && (
        <Box px={5} pb={5}>
          {children}
        </Box>
      )}
    </Box>
  );
}

// ── Table of Contents ───────────────────────────────────────────

function TableOfContents({ items, isOpen, onToggle }: {
  items: { id: string; title: string }[];
  isOpen: boolean;
  onToggle: () => void;
}) {
  const [isNarrow, setIsNarrow] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 1100px)');
    const handler = (e: MediaQueryListEvent | MediaQueryList) => setIsNarrow(e.matches);
    handler(mql);
    mql.addEventListener('change', handler as (e: MediaQueryListEvent) => void);
    return () => mql.removeEventListener('change', handler as (e: MediaQueryListEvent) => void);
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(`report-section-${id}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // On narrow viewports, show only a floating icon button
  if (isNarrow) {
    return (
      <Box position="fixed" left={3} top="72px" zIndex={10}>
        <Box
          as="button"
          onClick={onToggle}
          p={2}
          rounded="lg"
          bg="bg"
          border="1px solid"
          borderColor="border.muted"
          shadow="sm"
          cursor="pointer"
          _hover={{ shadow: 'md' }}
          transition="all 0.15s"
          color="fg.muted"
          title="Table of Contents"
        >
          <List size={16} />
        </Box>

        {isOpen && (
          <Box
            mt={1}
            bg="bg"
            border="1px solid"
            borderColor="border.muted"
            rounded="lg"
            shadow="lg"
            py={1}
            maxW="200px"
            maxH="60vh"
            overflowY="auto"
          >
            {items.map((item, i) => (
              <Flex
                key={item.id} as="button" onClick={() => scrollTo(item.id)}
                align="center" gap={2} w="full" px={3} py={2}
                fontSize="xs" color="fg.muted"
                _hover={{ bg: 'bg.subtle', color: 'fg' }}
                transition="all 0.15s" cursor="pointer" textAlign="left"
              >
                <Text fontWeight="semibold" color="fg.muted" w="16px" flexShrink={0}>{i + 1}.</Text>
                <Text truncate>{item.title}</Text>
              </Flex>
            ))}
          </Box>
        )}
      </Box>
    );
  }

  // Wide viewport: full TOC with label
  return (
    <Box position="fixed" left={4} top="80px" zIndex={10} maxW="220px">
      <Flex
        as="button" onClick={onToggle}
        align="center" gap={1.5} px={3} py={2}
        rounded="lg" bg="bg" border="1px solid" borderColor="border.muted" shadow="sm"
        cursor="pointer" _hover={{ shadow: 'md' }} transition="all 0.15s" mb={1}
      >
        <List size={14} />
        <Text fontSize="xs" fontWeight="semibold" color="fg">Contents</Text>
        {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </Flex>

      {isOpen && (
        <Box bg="bg" border="1px solid" borderColor="border.muted" rounded="lg" shadow="md" py={1}>
          {items.map((item, i) => (
            <Flex
              key={item.id} as="button" onClick={() => scrollTo(item.id)}
              align="center" gap={2} w="full" px={3} py={2}
              fontSize="xs" color="fg.muted"
              _hover={{ bg: 'bg.subtle', color: 'fg' }}
              transition="all 0.15s" cursor="pointer" textAlign="left"
            >
              <Text fontWeight="semibold" color="fg.muted" w="16px" flexShrink={0}>{i + 1}.</Text>
              <Text truncate>{item.title}</Text>
            </Flex>
          ))}
        </Box>
      )}
    </Box>
  );
}

// ── Main ReportPanel ────────────────────────────────────────────

interface ReportPanelProps {
  isOpen: boolean;
  onClose: () => void;
  report: ReportData | null;
  mapNodes: Node[];
  mapEdges: Edge[];
  /** When true, hides back button / export button / dark-mode toggle (for standalone HTML export) */
  exportMode?: boolean;
}

export function ReportPanel({ isOpen, onClose, report, mapNodes, mapEdges, exportMode = false }: ReportPanelProps) {
  const { colorMode, toggleColorMode, setColorMode } = useColorMode();
  const [tocOpen, setTocOpen] = useState(true);
  const [exportPreparing, setExportPreparing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && panelRef.current) panelRef.current.scrollTop = 0;
  }, [isOpen]);

  // Export handler: force light mode → expand all → wait for render → snapshot → restore
  const handleExport = async () => {
    if (!panelRef.current || !report) return;
    const prevMode = colorMode;
    setColorMode('light');
    setExportPreparing(true);
    // Wait for React to re-render with all sections expanded + light mode
    await new Promise(r => setTimeout(r, 600));
    await snapshotReportToHtml(panelRef.current, report);
    setExportPreparing(false);
    if (prevMode !== 'light') setColorMode(prevMode);
  };

  if (!isOpen || !report) return null;

  const formattedDate = new Date(report.generatedAt).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const { statistics: stats, consequences, insightCards, ideaRecommendations, subjects } = report;
  const hasSubjects = subjects && subjects.length > 0;

  // Build TOC items
  const tocItems = [
    { id: 'scenario-overview', title: 'Scenario Overview' },
    { id: 'executive-summary', title: 'Executive Summary' },
    ...(insightCards.length > 0 ? [{ id: 'key-insights', title: 'Key Insights' }] : []),
    { id: 'opportunities', title: 'Opportunities & Recommendations' },
    { id: 'key-risks', title: 'Risk Landscape' },
    { id: 'connected-knowledge', title: 'Connected Knowledge' },
    { id: 'statistics', title: 'Statistical Breakdown' },
    { id: 'methodology', title: 'Methodology' },
  ];

  // Identify specific sections
  const execSummary = report.sections.find(s => s.id === 'executive-summary');
  const keyRisks = report.sections.find(s => s.id === 'key-risks');
  const opportunities = report.sections.find(s => s.id === 'opportunities');
  const statsSection = report.sections.find(s => s.id === 'statistics');
  const methodology = report.sections.find(s => s.id === 'methodology');

  return (
    <Box
      ref={panelRef}
      data-report-panel
      position="fixed"
      top={0} left={0} right={0} bottom={0}
      bg="bg" zIndex={1500} overflowY="auto"
    >
      {/* Sticky header */}
      <Box data-report-header position="sticky" top={0} zIndex={10} bg="bg" borderBottom="1px solid" borderColor="border.muted" backdropFilter="blur(10px)">
        <Flex align="center" justify="space-between" maxW="960px" mx="auto" px={6} py={4}>
          {!exportMode ? (
            <Flex
              data-export-hide
              as="button" onClick={onClose}
              align="center" gap={1.5}
              fontSize="13px" fontFamily="heading" fontWeight={500}
              color="fg.muted" _hover={{ color: 'fg' }}
              cursor="pointer" transition="color 0.15s"
            >
              <ArrowLeft size={16} />
              Back to Map
            </Flex>
          ) : (
            <Text fontSize="11px" fontFamily="heading" color="fg.muted">Exported Report</Text>
          )}
          <Flex align="center" gap={3}>
            <Flex align="center" gap={1.5}>
              <Clock size={12} color="var(--chakra-colors-fg-muted)" />
              <Text fontSize="11px" color="fg.muted">{formattedDate}</Text>
            </Flex>
            {!exportMode && (
              <>
                <Box
                  data-export-hide
                  as="button"
                  onClick={handleExport}
                  p={1.5}
                  rounded="md"
                  color="fg.muted"
                  _hover={{ color: 'fg', bg: 'bg.hover' }}
                  transition="all 0.15s"
                  title="Export as HTML"
                >
                  {exportPreparing
                    ? <Text fontSize="xs" color="fg.muted" fontFamily="mono">Exporting...</Text>
                    : <Download style={{ width: 14, height: 14 }} />}
                </Box>
                <Box
                  data-export-hide
                  as="button"
                  onClick={toggleColorMode}
                  p={1.5}
                  rounded="md"
                  color="fg.muted"
                  _hover={{ color: 'fg', bg: 'bg.hover' }}
                  transition="all 0.15s"
                  title={colorMode === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
                >
                  {colorMode === 'light' ? <Moon style={{ width: 14, height: 14 }} /> : <Sun style={{ width: 14, height: 14 }} />}
                </Box>
              </>
            )}
          </Flex>
        </Flex>
      </Box>

      {/* TOC — hidden in export since it needs JS for scrolling */}
      <Box data-export-hide>
        <TableOfContents items={tocItems} isOpen={tocOpen} onToggle={() => setTocOpen(!tocOpen)} />
      </Box>

      {/* Report body */}
      <Box maxW="960px" mx="auto" px={6} py={8}>
        {/* Title + subtitle */}
        <Box mb={6}>
          <Text fontSize="2xl" fontWeight="bold" fontFamily="heading" color="fg" lineHeight="1.3" mb={1}>
            {report.input.title}
          </Text>
          <Text fontSize="sm" color="fg.muted" fontFamily="heading">
            Futurescape Analysis Report — {HORIZON_LABELS[report.input.horizon]} horizon
          </Text>
        </Box>

        {/* ═══════════════════════════════════════════════════════════
            1. SCENARIO OVERVIEW — Map + Metrics
           ═══════════════════════════════════════════════════════════ */}
        <Box id="report-section-scenario-overview" mb={8}>
          <Box mb={4}>
            <KeyMetrics report={report} />
          </Box>
          <Box>
            <Text fontSize="xs" fontWeight="semibold" color="fg.muted" textTransform="uppercase" letterSpacing="wider" mb={3}>
              Consequence Map
            </Text>
            <ReadOnlyMap nodes={mapNodes} edges={mapEdges} height="480px" resetView={exportPreparing} />
          </Box>
        </Box>

        {/* ═══════════════════════════════════════════════════════════
            2. EXECUTIVE SUMMARY
           ═══════════════════════════════════════════════════════════ */}
        {execSummary && (
          <Box mb={6}>
            <SectionCard
              section={execSummary}
              defaultExpanded={true}
              forceExpanded={exportPreparing}
              consequences={consequences}
              extraContent={
                <Flex gap={4} mt={5} direction="row" flexWrap="wrap">
                  <Box flex={1} minW="280px">
                    <STEEPERadarChart stats={stats} />
                  </Box>
                  <Box flex={1} minW="280px">
                    <SentimentFlowChart consequences={consequences} />
                  </Box>
                </Flex>
              }
            />
          </Box>
        )}

        {/* ═══════════════════════════════════════════════════════════
            3. KEY INSIGHTS — The Centerpiece
           ═══════════════════════════════════════════════════════════ */}
        {insightCards.length > 0 && (
          <Box mb={6}>
            <CollapsibleSection
              id="key-insights"
              icon={<Sparkles size={18} />}
              title="Key Insights"
              subtitle="What the map alone doesn't tell you — structural patterns and hidden dynamics"
              defaultExpanded={true}
              forceExpanded={exportPreparing}
            >
              <Flex direction="column" gap={4}>
                {insightCards.map((card, i) => (
                  <InsightCard key={i} card={card} consequences={consequences} />
                ))}
              </Flex>
            </CollapsibleSection>
          </Box>
        )}

        {/* ═══════════════════════════════════════════════════════════
            4. OPPORTUNITIES & RECOMMENDATIONS (merged)
           ═══════════════════════════════════════════════════════════ */}
        {opportunities && (
          <Box mb={6}>
            <SectionCard
              section={opportunities}
              defaultExpanded={true}
              forceExpanded={exportPreparing}
              consequences={consequences}
              extraContent={
                ideaRecommendations.length > 0 ? (
                  <Box mt={5}>
                    <Flex align="center" gap={2} mb={3}>
                      <Target size={14} style={{ color: 'var(--chakra-colors-fg-muted)' }} />
                      <Text fontSize="xs" fontWeight="semibold" color="fg.muted" textTransform="uppercase" letterSpacing="wider">
                        Recommended Actions
                      </Text>
                    </Flex>
                    <Flex direction="column" gap={4}>
                      {ideaRecommendations.map((idea, i) => (
                        <IdeaCard key={i} idea={idea} consequences={consequences} />
                      ))}
                    </Flex>
                  </Box>
                ) : undefined
              }
            />
          </Box>
        )}

        {/* ═══════════════════════════════════════════════════════════
            5. RISK LANDSCAPE
           ═══════════════════════════════════════════════════════════ */}
        {keyRisks && (
          <Box mb={6}>
            <SectionCard
              section={keyRisks}
              defaultExpanded={true}
              forceExpanded={exportPreparing}
              consequences={consequences}
              extraContent={
                <Box mt={5}>
                  <RiskOpportunityMatrix consequences={consequences} />
                </Box>
              }
            />
          </Box>
        )}

        {/* ═══════════════════════════════════════════════════════════
            7. CONNECTED KNOWLEDGE (Subjects + Knowledge Graph)
           ═══════════════════════════════════════════════════════════ */}
        <Box mb={6}>
          <CollapsibleSection
            id="connected-knowledge"
            icon={<Network size={18} />}
            title="Connected Knowledge"
            subtitle="Linked subjects, domains, and their relationships to this scenario"
            defaultExpanded={true}
            forceExpanded={exportPreparing}
          >
            {/* Connected Subjects */}
            {hasSubjects && (
              <Box mb={6}>
                <Flex align="center" gap={2} mb={3}>
                  <Globe size={14} style={{ color: 'var(--chakra-colors-fg-muted)' }} />
                  <Text fontSize="xs" fontWeight="semibold" color="fg.muted" textTransform="uppercase" letterSpacing="wider">
                    Connected Subjects
                  </Text>
                  <Text fontSize="xs" color="fg.muted" fontFamily="mono" ml="auto">
                    {subjects!.filter(s => s.relevance === 'direct').length} direct · {subjects!.filter(s => s.relevance === 'tangential').length} tangential
                  </Text>
                </Flex>

                <Flex direction="column" gap={4}>
                  {subjects!
                    .sort((a, b) => (a.relevance === 'direct' ? -1 : 1) - (b.relevance === 'direct' ? -1 : 1))
                    .map((subject, i) => (
                      <SubjectCard key={i} subject={subject} consequences={consequences} />
                    ))
                  }
                </Flex>
              </Box>
            )}

            {/* Knowledge Graph — hidden in export (WebGL canvas can't snapshot) */}
            <Box data-export-hide>
              <Flex align="center" gap={2} mb={3}>
                <Network size={14} style={{ color: 'var(--chakra-colors-fg-muted)' }} />
                <Text fontSize="xs" fontWeight="semibold" color="fg.muted" textTransform="uppercase" letterSpacing="wider">
                  Knowledge Graph
                </Text>
              </Flex>

              <ReportKnowledgeGraph
                consequences={consequences}
                subjects={subjects}
                seedTitle={report.input.title}
                height="480px"
              />
            </Box>
          </CollapsibleSection>
        </Box>

        {/* ═══════════════════════════════════════════════════════════
            9. STATISTICS
           ═══════════════════════════════════════════════════════════ */}
        {statsSection && (
          <Box mb={6}>
            <SectionCard
              section={statsSection}
              defaultExpanded={false}
              forceExpanded={exportPreparing}
              extraContent={
                <Box mt={5}>
                  <TimelineDistribution consequences={consequences} />
                </Box>
              }
            />
          </Box>
        )}

        {/* ═══════════════════════════════════════════════════════════
            8. METHODOLOGY
           ═══════════════════════════════════════════════════════════ */}
        {methodology && (
          <Box mb={6}>
            <SectionCard section={methodology} defaultExpanded={false} forceExpanded={exportPreparing} />
          </Box>
        )}

        {/* Footer */}
        <Flex justify="center" align="center" gap={2} mt={4} pt={6} borderTop="1px solid" borderColor="border.muted">
          <Text fontSize="xs" color="fg.muted">
            Generated by Futurescaper — {stats.totalConsequences} consequences analyzed — {formattedDate}
          </Text>
        </Flex>

        {/* Hidden pre-rendered tooltip cards for export interactivity.
            During export preparation, we render every ConsequenceCardPreview
            into a hidden container. The export script injects vanilla JS that
            shows these cards on chip click / risk-dot hover. */}
        {exportPreparing && (
          <div id="export-tooltip-cards" style={{ display: 'none' }}>
            {consequences.map(c => (
              <div key={c.id} data-tooltip-card={c.id}>
                <ConsequenceCardPreview consequence={c} />
              </div>
            ))}
          </div>
        )}
      </Box>
    </Box>
  );
}
