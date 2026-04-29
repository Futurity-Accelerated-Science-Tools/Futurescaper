/**
 * SaveToCloudButton — Saves the current futurescape (map + report) to the Futurity backend.
 *
 * Captures:
 *  - ReactFlow node positions + viewport
 *  - Full data payload (input, consequences, solutions, report)
 *  - Map thumbnail in both light and dark mode (via html-to-image)
 *  - HTML export of the report (via buildReportHtmlString)
 *
 * Requires an admin auth token (prompted via a simple input for now).
 */

import { useState, useCallback } from 'react';
import { Box, Button, Text, Flex } from '@chakra-ui/react';
import { Cloud, Check, AlertTriangle, Loader2 } from 'lucide-react';
import { toPng } from 'html-to-image';
import type { ReactFlowInstance } from '@xyflow/react';
import type { FutureInput, Consequence, Solution, ReportData } from '../types';
import { saveFuturescape, type FuturescapeDataPayload } from '../api/persistence';
import { buildReportHtmlString } from './reportHtmlExport';

interface SaveToCloudButtonProps {
  input: FutureInput;
  consequences: Consequence[];
  solutions: Solution[];
  reportData: ReportData | null;
  reactFlowInstance: ReactFlowInstance | null;
  /** Ref to the ReactFlow container DOM element (for thumbnail capture) */
  mapContainerRef: React.RefObject<HTMLElement | null>;
  /** Ref to the report panel DOM element (for HTML export) */
  reportPanelRef?: React.RefObject<HTMLElement | null>;
  /** Callback to toggle color mode — needed for dark thumbnail capture */
  colorMode: 'light' | 'dark';
  toggleColorMode: () => void;
}

type SavePhase = 'idle' | 'capturing-thumbnails' | 'building-html' | 'uploading' | 'done' | 'error';

const PHASE_LABELS: Record<SavePhase, string> = {
  idle: '',
  'capturing-thumbnails': 'Capturing map thumbnails...',
  'building-html': 'Building HTML export...',
  uploading: 'Uploading to cloud...',
  done: 'Saved!',
  error: 'Save failed',
};

export function SaveToCloudButton({
  input,
  consequences,
  solutions,
  reportData,
  reactFlowInstance,
  mapContainerRef,
  reportPanelRef,
  colorMode,
  toggleColorMode,
}: SaveToCloudButtonProps) {
  const [phase, setPhase] = useState<SavePhase>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [authToken, setAuthToken] = useState(() => {
    // Check if there's a token in localStorage (from FAST app auth)
    try {
      return localStorage.getItem('futurity_auth_token') || '';
    } catch {
      return '';
    }
  });

  const captureMapThumbnail = useCallback(async (bgColor: string): Promise<Blob | null> => {
    const container = mapContainerRef.current;
    if (!container) return null;

    // Find the ReactFlow viewport element inside the container
    const viewport = container.querySelector('.react-flow__viewport') as HTMLElement;
    if (!viewport) return null;

    try {
      const dataUrl = await toPng(viewport, {
        backgroundColor: bgColor,
        pixelRatio: 2,
        // Skip web font embedding — html-to-image crashes on certain
        // CSS font rules where the `font` shorthand is undefined.
        skipFonts: true,
        filter: (node) => {
          // Skip UI overlays like minimap, controls, attribution
          const el = node as HTMLElement;
          if (el.classList?.contains('react-flow__minimap')) return false;
          if (el.classList?.contains('react-flow__controls')) return false;
          if (el.classList?.contains('react-flow__attribution')) return false;
          return true;
        },
      });

      // Convert data URL to Blob
      const response = await fetch(dataUrl);
      return response.blob();
    } catch (err) {
      console.warn('Thumbnail capture failed:', err);
      return null;
    }
  }, [mapContainerRef]);

  const handleSave = useCallback(async () => {
    if (!reactFlowInstance) return;

    const token = authToken.trim();
    if (!token) {
      setShowTokenInput(true);
      return;
    }

    setPhase('capturing-thumbnails');
    setErrorMessage('');

    try {
      // ── 1. Capture thumbnails in both modes ──
      const LIGHT_BG = '#FFFFFF';
      const DARK_BG = '#111111';
      const isCurrentlyLight = colorMode === 'light';
      const currentModeBlob = await captureMapThumbnail(isCurrentlyLight ? LIGHT_BG : DARK_BG);

      // Switch to the other mode, capture, switch back
      toggleColorMode();
      // Give React + Chakra a moment to repaint
      await new Promise(r => setTimeout(r, 800));
      const otherModeBlob = await captureMapThumbnail(isCurrentlyLight ? DARK_BG : LIGHT_BG);
      // Switch back
      toggleColorMode();
      await new Promise(r => setTimeout(r, 300));

      const thumbnailLight = isCurrentlyLight ? currentModeBlob : otherModeBlob;
      const thumbnailDark = isCurrentlyLight ? otherModeBlob : currentModeBlob;

      // ── 2. Build HTML export (if report exists and panel is available) ──
      setPhase('building-html');
      let htmlExport: string | undefined;
      if (reportData && reportPanelRef?.current) {
        const html = await buildReportHtmlString(reportPanelRef.current, reportData);
        if (html) htmlExport = html;
      }

      // ── 3. Assemble data payload ──
      const nodes = reactFlowInstance.getNodes();
      const viewport = reactFlowInstance.getViewport();

      const data: FuturescapeDataPayload = {
        version: 1,
        savedAt: new Date().toISOString(),
        input,
        consequences,
        solutions,
        report: reportData,
        mapLayout: {
          nodes: nodes.map(n => ({ id: n.id, position: n.position })),
          viewport: { x: viewport.x, y: viewport.y, zoom: viewport.zoom },
        },
      };

      // ── 4. Upload ──
      setPhase('uploading');
      await saveFuturescape({
        name: input.title,
        description: input.description.slice(0, 500),
        data,
        htmlExport,
        thumbnailLight: thumbnailLight || undefined,
        thumbnailDark: thumbnailDark || undefined,
        tags: ['demo'],
        authToken: token,
      });

      setPhase('done');
      // Reset after a few seconds
      setTimeout(() => setPhase('idle'), 4000);
    } catch (err) {
      console.error('Save to cloud failed:', err);
      setPhase('error');
      setErrorMessage(err instanceof Error ? err.message : 'Unknown error');
    }
  }, [
    reactFlowInstance, authToken, colorMode, toggleColorMode,
    captureMapThumbnail, input, consequences, solutions,
    reportData, reportPanelRef,
  ]);

  const isWorking = phase === 'capturing-thumbnails' || phase === 'building-html' || phase === 'uploading';

  return (
    <Box>
      {/* Auth token input (shown on first click if no token, or when editing) */}
      {showTokenInput && (
        <Box mb={2} p={3} bg="bg.subtle" rounded="lg" borderWidth="1px" borderColor="border">
          <Text fontSize="xs" color="fg.muted" mb={1}>Admin auth token:</Text>
          <Flex gap={2}>
            <input
              type="password"
              placeholder="Paste your auth token..."
              value={authToken}
              onChange={(e) => setAuthToken(e.target.value)}
              style={{
                flex: 1,
                padding: '4px 8px',
                fontSize: '12px',
                borderRadius: '6px',
                border: '1px solid var(--chakra-colors-border)',
                background: 'transparent',
                color: 'inherit',
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && authToken.trim()) {
                  try { localStorage.setItem('futurity_auth_token', authToken.trim()); } catch {}
                  setShowTokenInput(false);
                  handleSave();
                }
              }}
            />
            <Button
              size="xs"
              onClick={() => {
                try { localStorage.setItem('futurity_auth_token', authToken.trim()); } catch {}
                setShowTokenInput(false);
                handleSave();
              }}
              disabled={!authToken.trim()}
            >
              Go
            </Button>
          </Flex>
        </Box>
      )}

      {/* Save button */}
      <Button
        onClick={handleSave}
        size="sm"
        width="100%"
        bg={phase === 'done' ? 'green.500' : phase === 'error' ? 'red.500' : 'bg.hover'}
        color={phase === 'done' || phase === 'error' ? 'white' : 'fg'}
        rounded="lg"
        fontWeight="medium"
        borderWidth="1px"
        borderColor={phase === 'done' ? 'green.400' : phase === 'error' ? 'red.400' : 'border'}
        disabled={isWorking || !consequences.length}
        _hover={{ bg: phase === 'idle' ? 'bg.emphasized' : undefined }}
      >
        <Flex align="center" gap={2}>
          {phase === 'done' ? (
            <Check size={14} />
          ) : phase === 'error' ? (
            <AlertTriangle size={14} />
          ) : isWorking ? (
            <Loader2 size={14} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
          ) : (
            <Cloud size={14} />
          )}
          <Text fontSize="sm">
            {isWorking ? PHASE_LABELS[phase] : phase === 'done' ? 'Saved!' : phase === 'error' ? 'Save failed' : 'Save to Cloud'}
          </Text>
        </Flex>
      </Button>

      {/* Error message + change token link */}
      {phase === 'error' && (
        <Flex direction="column" gap={1} mt={1}>
          {errorMessage && (
            <Text fontSize="xs" color="red.400">
              {errorMessage}
            </Text>
          )}
          <Text
            as="button"
            fontSize="xs"
            color="fg.muted"
            textDecoration="underline"
            cursor="pointer"
            _hover={{ color: 'fg' }}
            onClick={() => {
              setAuthToken('');
              try { localStorage.removeItem('futurity_auth_token'); } catch {}
              setShowTokenInput(true);
              setPhase('idle');
              setErrorMessage('');
            }}
          >
            Change auth token
          </Text>
        </Flex>
      )}
    </Box>
  );
}
