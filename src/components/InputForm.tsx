import React, { useState, useRef } from 'react';
import { Box, Flex, Text, Button, Input, Textarea } from '@chakra-ui/react';
import { FutureInput, Horizon, HORIZON_LABELS, Consequence, Solution, GenerationConfig, DEFAULT_GENERATION_CONFIG, STRATEGY_LABELS, DENSITY_LABELS } from '../types';
import {
  Sparkles, FileText, Clock, ArrowRight, Upload, X, Loader2,
  Link, Globe, Zap, Users, Search, BookOpen, Newspaper,
  FolderOpen, Hammer, Settings, ChevronRight, Sun, Moon, Layers,
} from 'lucide-react';
import { extractTextFromFile, truncateForContext } from '../api/documentParser';
import { fetchUrlContent } from '../api/claude';
import { conductWebResearch, formatResearchForPrompt, ResearchSummary } from '../api/webResearch';
import { useColorMode } from '../theme/ColorModeProvider';
import { GenerationConfigModal } from './GenerationConfigModal';
import { estimateNodeCount } from '../api/generationStrategy';

interface ImportedData {
  input: FutureInput;
  consequences: Consequence[];
  solutions: Solution[];
}

interface InputFormProps {
  onSubmit: (input: FutureInput, config: GenerationConfig) => void;
  onImport?: (data: ImportedData) => void;
  onManualMode?: (input: FutureInput) => void;
}

export function InputForm({ onSubmit, onImport, onManualMode }: InputFormProps) {
  const { colorMode, toggleColorMode } = useColorMode();

  // Core fields (always visible)
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [inputMode, setInputMode] = useState<'idea' | 'url'>('idea');
  const [verbosity, setVerbosity] = useState<'concise' | 'normal' | 'detailed'>('normal');

  // Settings drawer fields
  const [horizon, setHorizon] = useState<Horizon>('medium');
  const [perspective, setPerspective] = useState('');
  const [sourceText, setSourceText] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [isProcessingUrl, setIsProcessingUrl] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [enableWebResearch, setEnableWebResearch] = useState(true);
  const [isResearching, setIsResearching] = useState(false);
  const [researchResults, setResearchResults] = useState<ResearchSummary | null>(null);

  // Generation config
  const [generationConfig, setGenerationConfig] = useState<GenerationConfig>(DEFAULT_GENERATION_CONFIG);
  const [configModalOpen, setConfigModalOpen] = useState(false);

  // UI state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  // ── Import handling ──
  const handleImportClick = () => importInputRef.current?.click();

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.input || !data.consequences) throw new Error('Invalid file format. Missing required fields.');
      if (!data.input.title || !data.input.horizon) throw new Error('Invalid input data. Missing title or horizon.');
      if (!Array.isArray(data.consequences)) throw new Error('Invalid consequences data. Expected an array.');
      if (onImport) {
        onImport({ input: data.input, consequences: data.consequences, solutions: data.solutions || [] });
      }
    } catch (err) {
      console.error('Import error:', err);
      setImportError(err instanceof Error ? err.message : 'Failed to import file');
    }
    e.target.value = '';
  };

  // ── Submit handling ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    let finalSourceText = sourceText;

    if (enableWebResearch && !researchResults) {
      setIsResearching(true);
      try {
        const research = await conductWebResearch(title);
        setResearchResults(research);
        const researchContext = formatResearchForPrompt(research);
        finalSourceText = researchContext + (sourceText ? '\n\n---\n\n' + sourceText : '');
      } catch (err) {
        console.error('Research error:', err);
      }
      setIsResearching(false);
    } else if (researchResults) {
      const researchContext = formatResearchForPrompt(researchResults);
      finalSourceText = researchContext + (sourceText ? '\n\n---\n\n' + sourceText : '');
    }

    onSubmit({
      title,
      description: description.trim() || title,
      horizon,
      perspective: perspective.trim() || undefined,
      sourceText: finalSourceText,
      sourceUrl: sourceUrl || undefined,
      verbosity,
    }, generationConfig);
  };

  const handleManualSubmit = () => {
    if (!title.trim() || !onManualMode) return;
    onManualMode({
      title,
      description: description.trim() || title,
      horizon,
      perspective: perspective.trim() || undefined,
      sourceText,
      sourceUrl: sourceUrl || undefined,
      verbosity,
    });
  };

  // ── File handling ──
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileError(null);
    setUploadedFile(file);
    setIsProcessingFile(true);
    try {
      const text = await extractTextFromFile(file);
      const truncated = truncateForContext(text, 8000);
      setSourceText(truncated);
    } catch (err) {
      setFileError((err as Error).message);
      setUploadedFile(null);
    } finally {
      setIsProcessingFile(false);
    }
  };

  const handleUrlFetch = async () => {
    if (!sourceUrl.trim()) return;
    setUrlError(null);
    setIsProcessingUrl(true);
    try {
      const text = await fetchUrlContent(sourceUrl);
      setSourceText(text);
      if (!title) {
        const urlObj = new URL(sourceUrl);
        setTitle(`Analysis: ${urlObj.hostname}`);
      }
    } catch (err) {
      setUrlError((err as Error).message);
    } finally {
      setIsProcessingUrl(false);
    }
  };

  const clearFile = () => {
    setUploadedFile(null);
    setSourceText('');
    setFileError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleManualResearch = async () => {
    if (!title.trim()) return;
    setIsResearching(true);
    try {
      const research = await conductWebResearch(title);
      setResearchResults(research);
    } catch (err) {
      console.error('Research error:', err);
    }
    setIsResearching(false);
  };

  // ── Example scenarios ──
  const exampleIdeas = [
    { title: 'Autonomous Vehicles Become Mainstream', description: 'Self-driving cars become the primary mode of transportation across all socioeconomic levels, with fully autonomous vehicles handling commutes, deliveries, and public transit.' },
    { title: 'Universal Basic Income Implemented', description: 'A nationwide universal basic income program provides every adult citizen with a monthly stipend, fundamentally changing work incentives and social safety nets.' },
    { title: 'Remote Work Becomes the Default', description: 'Most knowledge workers permanently shift to remote work, with offices becoming optional collaboration spaces rather than daily workplaces.' },
    { title: 'Lab-Grown Meat Replaces Farming', description: 'Cultured meat becomes cheaper than traditional farming, leading to a dramatic shift away from animal agriculture toward lab-grown protein production.' },
  ];

  const fillExample = (example: { title: string; description: string }) => {
    setTitle(example.title);
    setDescription(example.description);
    setInputMode('idea');
  };

  // ── Settings summary for the clickable bar ──
  const settingsSummary = () => {
    const parts: string[] = [];
    if (perspective) parts.push(perspective);
    parts.push(HORIZON_LABELS[horizon]);
    if (uploadedFile) parts.push(uploadedFile.name);
    if (enableWebResearch) parts.push('Web research on');
    return parts.join(' · ');
  };

  const perspectiveQuickPicks = ['General Public', 'Business Owners', 'Workers/Employees', 'Government', 'Investors', 'Environment'];

  return (
    <Flex direction="column" minH="100vh">
      {/* ── Top Bar (matches FuturescapeMap) ── */}
      <Flex
        h="40px"
        px={4}
        align="center"
        justify="space-between"
        bg="bg.canvas"
        borderBottom="1px solid"
        borderColor="border.muted"
        flexShrink={0}
      >
        <Text fontSize="xs" fontWeight="semibold" color="fg.muted" letterSpacing="wider" textTransform="uppercase">
          Futurescaper
        </Text>
        <Box
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
      </Flex>

      {/* ── Main Content ── */}
      <Box flex={1} bgGradient="to-br" gradientFrom="bg.hover" gradientTo="bg.active" p={{ base: 6, md: 12 }}>
        <Box maxW="2xl" mx="auto">
          {/* Header */}
          <Box mb={8}>
            <Flex align="center" gap={3} mb={2}>
              <Flex w={10} h={10} rounded="lg" bg="brand" align="center" justify="center">
                <Box as={Sparkles} w={5} h={5} color="brand.contrast" />
              </Flex>
              <Text as="h1" fontSize="3xl" fontWeight="bold" color="fg">
                Futurescape
              </Text>
            </Flex>
            <Text color="fg.secondary" fontSize="md">
              Map consequences across Social, Technological, Economic, Environmental, Political &amp; Ethical dimensions.
            </Text>
          </Box>

          {/* Input Mode Toggle */}
          <Flex gap={2} mb={5}>
            <Button
              type="button"
              onClick={() => setInputMode('idea')}
              flex={1}
              py={2.5}
              px={4}
              rounded="lg"
              borderWidth="2px"
              transition="all"
              display="flex"
              alignItems="center"
              justifyContent="center"
              gap={2}
              borderColor={inputMode === 'idea' ? 'brand' : 'border.muted'}
              bg={inputMode === 'idea' ? 'brand/5' : 'transparent'}
              color={inputMode === 'idea' ? 'brand' : 'fg.secondary'}
              _hover={inputMode !== 'idea' ? { borderColor: 'border.muted' } : undefined}
              variant="outline"
              fontSize="sm"
            >
              <Box as={Zap} w={4} h={4} />
              Describe an Idea
            </Button>
            <Button
              type="button"
              onClick={() => setInputMode('url')}
              flex={1}
              py={2.5}
              px={4}
              rounded="lg"
              borderWidth="2px"
              transition="all"
              display="flex"
              alignItems="center"
              justifyContent="center"
              gap={2}
              borderColor={inputMode === 'url' ? 'brand' : 'border.muted'}
              bg={inputMode === 'url' ? 'brand/5' : 'transparent'}
              color={inputMode === 'url' ? 'brand' : 'fg.secondary'}
              _hover={inputMode !== 'url' ? { borderColor: 'border.muted' } : undefined}
              variant="outline"
              fontSize="sm"
            >
              <Box as={Globe} w={4} h={4} />
              Analyze from URL
            </Button>
          </Flex>

          {/* Example pills (idea mode only) */}
          {inputMode === 'idea' && (
            <Box mb={5}>
              <Text fontSize="xs" color="fg.muted" mb={2} fontWeight="medium">Try an example:</Text>
              <Flex flexWrap="wrap" gap={2}>
                {exampleIdeas.map((example, idx) => (
                  <Button
                    key={idx}
                    type="button"
                    onClick={() => fillExample(example)}
                    px={3}
                    py={1.5}
                    fontSize="xs"
                    bg="bg.canvas"
                    _hover={{ bg: 'brand', color: 'brand.contrast' }}
                    borderWidth="1px"
                    borderColor="border.muted"
                    rounded="full"
                    color="fg.secondary"
                    transition="colors"
                    variant="outline"
                  >
                    {example.title}
                  </Button>
                ))}
              </Flex>
            </Box>
          )}

          <Box as="form" onSubmit={handleSubmit}>
            <Flex direction="column" gap={4}>
              {/* URL input (url mode only) */}
              {inputMode === 'url' && (
                <Box bg="bg.canvas" rounded="xl" shadow="sm" borderWidth="1px" borderColor="border.muted" p={5}>
                  <Text as="label" display="block" fontSize="sm" fontWeight="semibold" color="fg" mb={2}>
                    <Box as={Link} w={4} h={4} display="inline" mr={2} />
                    Source URL
                  </Text>
                  <Flex gap={2}>
                    <Input
                      type="url"
                      value={sourceUrl}
                      onChange={(e) => setSourceUrl(e.target.value)}
                      placeholder="https://example.com/article..."
                      flex={1}
                      px={4}
                      py={2.5}
                      rounded="lg"
                      borderColor="border.muted"
                      _focus={{ borderColor: 'border.focus', ring: '2px', ringColor: 'brand/20' }}
                      outline="none"
                      fontSize="sm"
                    />
                    <Button
                      type="button"
                      onClick={handleUrlFetch}
                      disabled={!sourceUrl.trim() || isProcessingUrl}
                      px={4}
                      py={2.5}
                      bg="bg.active"
                      color="fg"
                      rounded="lg"
                      _hover={{ bg: 'bg.active' }}
                      _disabled={{ opacity: 0.5 }}
                      display="flex"
                      alignItems="center"
                      gap={2}
                      fontSize="sm"
                    >
                      {isProcessingUrl ? <Box as={Loader2} w={4} h={4} animation="spin" /> : <Box as={ArrowRight} w={4} h={4} />}
                      Fetch
                    </Button>
                  </Flex>
                  {urlError && <Text mt={2} fontSize="xs" color="orange.600">{urlError}</Text>}
                </Box>
              )}

              {/* Title */}
              <Box bg="bg.canvas" rounded="xl" shadow="sm" borderWidth="1px" borderColor="border.muted" p={5}>
                <Text as="label" display="block" fontSize="sm" fontWeight="semibold" color="fg" mb={2}>
                  {inputMode === 'url' ? 'Title for this analysis' : 'What scenario or event are you analyzing?'}
                </Text>
                <Input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={inputMode === 'url'
                    ? 'e.g., Analysis: Future of Transportation'
                    : 'e.g., Autonomous Vehicles Become Mainstream'}
                  w="full"
                  px={4}
                  py={3}
                  rounded="lg"
                  borderColor="border.muted"
                  _focus={{ borderColor: 'border.focus', ring: '2px', ringColor: 'brand/20' }}
                  outline="none"
                  fontSize="md"
                  required
                />
              </Box>

              {/* Description */}
              <Box bg="bg.canvas" rounded="xl" shadow="sm" borderWidth="1px" borderColor="border.muted" p={5}>
                <Text as="label" display="block" fontSize="sm" fontWeight="semibold" color="fg" mb={2}>
                  Describe the scenario <Text as="span" color="fg.muted" fontWeight="normal">(optional)</Text>
                </Text>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add more details about the event, decision, or change..."
                  rows={3}
                  w="full"
                  px={4}
                  py={3}
                  rounded="lg"
                  borderColor="border.muted"
                  _focus={{ borderColor: 'border.focus', ring: '2px', ringColor: 'brand/20' }}
                  outline="none"
                  resize="none"
                  fontSize="sm"
                />
              </Box>

              {/* AI Verbosity */}
              <Box bg="bg.canvas" rounded="xl" shadow="sm" borderWidth="1px" borderColor="border.muted" px={5} py={4}>
                <Flex align="center" justify="space-between">
                  <Text fontSize="sm" fontWeight="semibold" color="fg">
                    AI Detail Level
                  </Text>
                  <Flex gap={1} bg="bg.hover" rounded="lg" p={0.5}>
                    {(['concise', 'normal', 'detailed'] as const).map((v) => (
                      <Box
                        as="button"
                        key={v}
                        type="button"
                        onClick={() => setVerbosity(v)}
                        px={3}
                        py={1.5}
                        rounded="md"
                        fontSize="xs"
                        fontWeight={verbosity === v ? 'semibold' : 'normal'}
                        cursor="pointer"
                        transition="all 0.15s"
                        bg={verbosity === v ? 'bg.canvas' : 'transparent'}
                        color={verbosity === v ? 'fg' : 'fg.muted'}
                        shadow={verbosity === v ? 'sm' : 'none'}
                        _hover={verbosity !== v ? { color: 'fg.secondary' } : undefined}
                      >
                        {v.charAt(0).toUpperCase() + v.slice(1)}
                      </Box>
                    ))}
                  </Flex>
                </Flex>
                <Text mt={1.5} fontSize="xs" color="fg.muted">
                  {verbosity === 'concise' && 'Short, punchy descriptions — 1 sentence per node'}
                  {verbosity === 'normal' && 'Balanced detail — 1-2 sentences per node'}
                  {verbosity === 'detailed' && 'Rich analysis — 2-3 sentences with specific examples'}
                </Text>
              </Box>

              {/* Generation config bar — click to open modal */}
              <Box
                as="button"
                type="button"
                onClick={() => setConfigModalOpen(true)}
                w="full"
                bg="bg.canvas"
                rounded="xl"
                shadow="sm"
                borderWidth="1px"
                borderColor="border.muted"
                px={5}
                py={3.5}
                cursor="pointer"
                _hover={{ borderColor: 'fg.muted', bg: 'bg.hover' }}
                transition="all 0.15s"
                textAlign="left"
              >
                <Flex align="center" justify="space-between">
                  <Flex align="center" gap={2}>
                    <Box as={Layers} w={4} h={4} color="fg.muted" />
                    <Text fontSize="sm" color="fg.secondary">
                      {STRATEGY_LABELS[generationConfig.strategy]} · {DENSITY_LABELS[generationConfig.density]} (~{estimateNodeCount(generationConfig, verbosity)} nodes)
                    </Text>
                  </Flex>
                  <Box as={ChevronRight} w={4} h={4} color="fg.muted" />
                </Flex>
              </Box>

              {/* Settings summary bar — click to open drawer */}
              <Box
                as="button"
                type="button"
                onClick={() => setDrawerOpen(true)}
                w="full"
                bg="bg.canvas"
                rounded="xl"
                shadow="sm"
                borderWidth="1px"
                borderColor="border.muted"
                px={5}
                py={3.5}
                cursor="pointer"
                _hover={{ borderColor: 'fg.muted', bg: 'bg.hover' }}
                transition="all 0.15s"
                textAlign="left"
              >
                <Flex align="center" justify="space-between">
                  <Flex align="center" gap={2}>
                    <Box as={Settings} w={4} h={4} color="fg.muted" />
                    <Text fontSize="sm" color="fg.secondary">
                      {settingsSummary()}
                    </Text>
                  </Flex>
                  <Box as={ChevronRight} w={4} h={4} color="fg.muted" />
                </Flex>
              </Box>

              {/* Action Buttons */}
              <Flex direction="column" gap={3} mt={1}>
                <Button
                  type="submit"
                  disabled={!title.trim() || isResearching}
                  w="full"
                  py={4}
                  px={6}
                  bg="brand"
                  color="brand.contrast"
                  rounded="xl"
                  fontWeight="semibold"
                  fontSize="md"
                  _hover={{ bg: 'brand.hover' }}
                  transition="colors"
                  _disabled={{ opacity: 0.5, cursor: 'not-allowed' }}
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  gap={2}
                >
                  {isResearching ? (
                    <>
                      <Box as={Loader2} w={5} h={5} animation="spin" />
                      Scanning Web Sources...
                    </>
                  ) : (
                    <>
                      <Box as={Sparkles} w={5} h={5} />
                      Generate Futurescape
                      <Box as={ArrowRight} w={5} h={5} />
                    </>
                  )}
                </Button>

                {onManualMode && (
                  <Button
                    type="button"
                    disabled={!title.trim()}
                    onClick={handleManualSubmit}
                    w="full"
                    py={3}
                    px={6}
                    bg="bg.canvas"
                    borderWidth="2px"
                    borderColor="border.muted"
                    color="fg"
                    rounded="xl"
                    fontWeight="semibold"
                    fontSize="sm"
                    _hover={{ borderColor: 'fg.muted', bg: 'bg.hover' }}
                    transition="colors"
                    _disabled={{ opacity: 0.5, cursor: 'not-allowed' }}
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    gap={2}
                    variant="outline"
                  >
                    <Box as={Hammer} w={4} h={4} />
                    Manual Mode — Build by Hand
                  </Button>
                )}
              </Flex>

              {/* Import link */}
              {onImport && (
                <Flex justify="center" mt={1}>
                  <input type="file" ref={importInputRef} onChange={handleImportFile} accept=".json" hidden />
                  <Box
                    as="button"
                    type="button"
                    onClick={handleImportClick}
                    display="flex"
                    alignItems="center"
                    gap={1.5}
                    fontSize="xs"
                    color="fg.muted"
                    _hover={{ color: 'fg.secondary' }}
                    transition="colors"
                    cursor="pointer"
                    bg="transparent"
                    border="none"
                    p={0}
                  >
                    <Box as={FolderOpen} w={3.5} h={3.5} />
                    Load previous analysis (JSON)
                  </Box>
                  {importError && (
                    <Text color="fg.error" fontSize="xs" ml={2}>{importError}</Text>
                  )}
                </Flex>
              )}

              {/* Footer hint */}
              <Text textAlign="center" fontSize="xs" color="fg.muted" mt={1}>
                {enableWebResearch
                  ? 'Includes web research · Full analysis takes 2-4 minutes'
                  : 'Full analysis takes 2-3 minutes'}
              </Text>
            </Flex>
          </Box>
        </Box>
      </Box>

      {/* ── Settings Drawer Overlay ── */}
      {drawerOpen && (
        <Box
          position="fixed"
          inset={0}
          zIndex={50}
          onClick={() => setDrawerOpen(false)}
        >
          {/* Backdrop */}
          <Box
            position="absolute"
            inset={0}
            bg="blackAlpha.400"
            transition="opacity 0.2s"
          />

          {/* Drawer panel */}
          <Box
            position="absolute"
            top={0}
            right={0}
            h="100vh"
            w={{ base: '100%', md: '420px' }}
            bg="bg.canvas"
            borderLeft="1px solid"
            borderColor="border.muted"
            shadow="xl"
            overflowY="auto"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            {/* Drawer header */}
            <Flex
              px={5}
              py={4}
              align="center"
              justify="space-between"
              borderBottom="1px solid"
              borderColor="border.muted"
            >
              <Flex align="center" gap={2}>
                <Box as={Settings} w={4} h={4} color="fg.muted" />
                <Text fontSize="md" fontWeight="semibold" color="fg">Analysis Settings</Text>
              </Flex>
              <Box
                as="button"
                onClick={() => setDrawerOpen(false)}
                p={1.5}
                rounded="md"
                color="fg.muted"
                _hover={{ color: 'fg', bg: 'bg.hover' }}
                transition="all 0.15s"
              >
                <X style={{ width: 16, height: 16 }} />
              </Box>
            </Flex>

            {/* Drawer body */}
            <Flex direction="column" gap={5} p={5}>

              {/* Perspective */}
              <Box>
                <Flex align="center" gap={2} mb={2}>
                  <Box as={Users} w={4} h={4} color="fg.muted" />
                  <Text fontSize="sm" fontWeight="semibold" color="fg">Perspective</Text>
                </Flex>
                <Input
                  type="text"
                  value={perspective}
                  onChange={(e) => setPerspective(e.target.value)}
                  placeholder="e.g., Urban commuters, Insurance companies..."
                  w="full"
                  px={4}
                  py={2.5}
                  rounded="lg"
                  borderColor="border.muted"
                  _focus={{ borderColor: 'border.focus', ring: '2px', ringColor: 'brand/20' }}
                  outline="none"
                  fontSize="sm"
                />
                <Flex mt={2} flexWrap="wrap" gap={1.5}>
                  {perspectiveQuickPicks.map((p) => (
                    <Button
                      key={p}
                      type="button"
                      onClick={() => setPerspective(p)}
                      px={2}
                      py={1}
                      fontSize="xs"
                      rounded="full"
                      transition="colors"
                      bg={perspective === p ? 'brand' : 'bg.active'}
                      color={perspective === p ? 'brand.contrast' : 'fg.secondary'}
                      _hover={perspective !== p ? { bg: 'bg.active' } : undefined}
                      variant="solid"
                      size="xs"
                    >
                      {p}
                    </Button>
                  ))}
                </Flex>
                <Text mt={2} fontSize="xs" color="fg.muted">
                  Consequences are rated positive/negative from this viewpoint.
                </Text>
              </Box>

              {/* Time Horizon */}
              <Box>
                <Flex align="center" gap={2} mb={2}>
                  <Box as={Clock} w={4} h={4} color="fg.muted" />
                  <Text fontSize="sm" fontWeight="semibold" color="fg">Time Horizon</Text>
                </Flex>
                <Box display="grid" gridTemplateColumns="repeat(3, 1fr)" gap={2}>
                  {(Object.keys(HORIZON_LABELS) as Horizon[]).map((h) => (
                    <Button
                      key={h}
                      type="button"
                      onClick={() => setHorizon(h)}
                      py={2.5}
                      px={3}
                      rounded="lg"
                      borderWidth="2px"
                      transition="all"
                      borderColor={horizon === h ? 'brand' : 'border.muted'}
                      bg={horizon === h ? 'brand/5' : 'transparent'}
                      color={horizon === h ? 'brand' : 'fg.secondary'}
                      _hover={horizon !== h ? { borderColor: 'border.muted' } : undefined}
                      variant="outline"
                      h="auto"
                      flexDirection="column"
                      fontSize="sm"
                    >
                      <Text fontWeight="semibold" fontSize="sm">{HORIZON_LABELS[h]}</Text>
                      <Text fontSize="xs" opacity={0.7}>
                        {h === 'near' && 'Immediate focus'}
                        {h === 'medium' && 'Balanced'}
                        {h === 'far' && 'Long-term vision'}
                      </Text>
                    </Button>
                  ))}
                </Box>
                <Text mt={2} fontSize="xs" color="fg.muted">
                  Biases the time distribution of generated consequences.
                </Text>
              </Box>

              {/* File upload + context */}
              <Box>
                <Flex align="center" gap={2} mb={2}>
                  <Box as={FileText} w={4} h={4} color="fg.muted" />
                  <Text fontSize="sm" fontWeight="semibold" color="fg">Additional Context</Text>
                </Flex>

                <input ref={fileInputRef} type="file" accept=".pdf,.txt,.md" onChange={handleFileSelect} hidden />

                {uploadedFile ? (
                  <Flex align="center" gap={2} p={3} bg="bg.hover" rounded="lg" borderWidth="1px" borderColor="border.muted" mb={2}>
                    <Box as={FileText} w={4} h={4} color="fg.muted" />
                    <Text fontSize="sm" color="fg" flex={1} truncate>{uploadedFile.name}</Text>
                    {isProcessingFile ? (
                      <Box as={Loader2} w={4} h={4} color="brand" animation="spin" />
                    ) : (
                      <Box
                        as="button"
                        type="button"
                        onClick={clearFile}
                        p={1}
                        rounded="md"
                        _hover={{ bg: 'bg.active' }}
                      >
                        <X style={{ width: 14, height: 14 }} />
                      </Box>
                    )}
                  </Flex>
                ) : (
                  <Button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    w="full"
                    py={2.5}
                    px={4}
                    borderWidth="2px"
                    borderStyle="dashed"
                    borderColor="border.muted"
                    rounded="lg"
                    color="fg.muted"
                    _hover={{ borderColor: 'fg.muted', color: 'fg.secondary' }}
                    transition="colors"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    gap={2}
                    variant="outline"
                    bg="transparent"
                    mb={2}
                    fontSize="sm"
                  >
                    <Box as={Upload} w={4} h={4} />
                    Upload PDF, TXT, or Markdown
                  </Button>
                )}

                {fileError && <Text mb={2} fontSize="xs" color="fg.error">{fileError}</Text>}

                <Box position="relative">
                  <Textarea
                    value={sourceText}
                    onChange={(e) => setSourceText(e.target.value)}
                    placeholder="Paste article text, research findings, or context..."
                    rows={3}
                    w="full"
                    px={4}
                    py={3}
                    rounded="lg"
                    borderColor="border.muted"
                    _focus={{ borderColor: 'border.focus', ring: '2px', ringColor: 'brand/20' }}
                    outline="none"
                    resize="none"
                    fontSize="sm"
                  />
                  {sourceText && (
                    <Box position="absolute" bottom={2} right={2} fontSize="xs" color="fg.muted">
                      {sourceText.length.toLocaleString()} chars
                    </Box>
                  )}
                </Box>
              </Box>

              {/* Web Research Toggle */}
              <Box>
                <Flex align="center" justify="space-between" mb={2}>
                  <Flex align="center" gap={2}>
                    <Box as={Search} w={4} h={4} color="fg.muted" />
                    <Text fontSize="sm" fontWeight="semibold" color="fg">Web Research</Text>
                  </Flex>
                  <Box
                    as="button"
                    type="button"
                    onClick={() => setEnableWebResearch(!enableWebResearch)}
                    position="relative"
                    w={10}
                    h={5}
                    rounded="full"
                    transition="colors"
                    bg={enableWebResearch ? 'brand' : 'bg.active'}
                    cursor="pointer"
                  >
                    <Box
                      position="absolute"
                      top="2px"
                      w={4}
                      h={4}
                      bg="bg.canvas"
                      rounded="full"
                      transition="transform"
                      left={enableWebResearch ? '22px' : '2px'}
                    />
                  </Box>
                </Flex>
                <Text fontSize="xs" color="fg.muted" mb={2}>
                  Searches news and papers to enrich your analysis with real-world context.
                </Text>

                {enableWebResearch && (
                  <Button
                    type="button"
                    onClick={handleManualResearch}
                    disabled={!title.trim() || isResearching}
                    w="full"
                    py={2}
                    px={3}
                    bg="bg.active"
                    _hover={{ bg: 'bg.active' }}
                    color="fg"
                    rounded="lg"
                    fontSize="sm"
                    fontWeight="medium"
                    _disabled={{ opacity: 0.5 }}
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    gap={2}
                  >
                    {isResearching ? (
                      <><Box as={Loader2} w={4} h={4} animation="spin" /> Scanning...</>
                    ) : (
                      <><Box as={Search} w={4} h={4} /> Preview Research</>
                    )}
                  </Button>
                )}

                {researchResults && researchResults.results.length > 0 && (
                  <Box mt={3} p={3} bg="green.50" borderWidth="1px" borderColor="green.200" rounded="lg">
                    <Flex align="center" gap={2} color="green.800" fontWeight="medium" fontSize="sm" mb={2}>
                      <Box as={BookOpen} w={4} h={4} />
                      Found {researchResults.results.length} sources
                    </Flex>
                    <Flex direction="column" gap={1.5} maxH={32} overflowY="auto">
                      {researchResults.results.slice(0, 5).map((result, idx) => (
                        <Box key={idx} fontSize="xs">
                          <Flex align="center" gap={1} color="fg.secondary">
                            {result.source === 'news' && <Box as={Newspaper} w={3} h={3} color="fg.link" />}
                            {result.source === 'academic' && <Box as={BookOpen} w={3} h={3} color="purple.500" />}
                            <Text fontWeight="medium" truncate>{result.title}</Text>
                          </Flex>
                        </Box>
                      ))}
                    </Flex>
                    {researchResults.keyInsights.length > 0 && (
                      <Box mt={2} pt={2} borderTopWidth="1px" borderColor="green.200">
                        <Text fontSize="xs" color="green.700">{researchResults.keyInsights[0]}</Text>
                      </Box>
                    )}
                  </Box>
                )}
              </Box>

              {/* Done button */}
              <Button
                type="button"
                onClick={() => setDrawerOpen(false)}
                w="full"
                py={3}
                bg="brand"
                color="brand.contrast"
                rounded="xl"
                fontWeight="semibold"
                fontSize="sm"
                _hover={{ bg: 'brand.hover' }}
                mt={2}
              >
                Done
              </Button>
            </Flex>
          </Box>
        </Box>
      )}

      {/* ── Generation Config Modal ── */}
      <GenerationConfigModal
        isOpen={configModalOpen}
        onClose={() => setConfigModalOpen(false)}
        config={generationConfig}
        onChange={setGenerationConfig}
        verbosity={verbosity}
      />
    </Flex>
  );
}
