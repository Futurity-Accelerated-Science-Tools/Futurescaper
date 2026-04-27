/**
 * persistence.ts — API client for saving/loading futurescapes to the Futurity backend.
 *
 * The Futurity backend (FastAPI) is separate from the Futurescaper's own
 * small Node backend (backend.ts). This module talks to the Futurity backend's
 * futurescape persistence endpoints.
 */

import type { FutureInput, Consequence, Solution, ReportData } from '../types';

// ── Backend URL ──────────────────────────────────────────────────
// When running standalone, uses VITE_FUTURITY_API_URL.
// When imported from the FAST app, falls back to VITE_API_URL.
// Last resort: the dev API.
const FUTURITY_API = import.meta.env.VITE_FUTURITY_API_URL
  || import.meta.env.VITE_API_URL
  || 'https://api-dev.futurity.science';

// ── Types ────────────────────────────────────────────────────────

/** The full data payload saved to S3 as data.json */
export interface FuturescapeDataPayload {
  version: 1;
  savedAt: string;
  input: FutureInput;
  consequences: Consequence[];
  solutions: Solution[];
  report: ReportData | null;
  mapLayout: {
    nodes: Array<{ id: string; position: { x: number; y: number } }>;
    viewport: { x: number; y: number; zoom: number };
  };
}

/** Metadata returned by the listing/detail endpoints (MongoDB document) */
export interface FuturescapeMetadata {
  uniqueID: string;
  slug: string;
  name: string;
  description: string;
  horizon: string;
  thumbnail_url_light: string;
  thumbnail_url_dark: string;
  node_count: number;
  category_distribution: Record<string, number>;
  lab_ids: string[];
  metadata: {
    status: string;
    created_by: string;
    tags: string[];
    created_at: string;
    updated_at: string;
  };
}

/** Arguments for saving a futurescape */
export interface SaveFuturescapeArgs {
  name: string;
  description: string;
  data: FuturescapeDataPayload;
  htmlExport?: string;
  thumbnailLight?: Blob;
  thumbnailDark?: Blob;
  tags?: string[];
  labIds?: string[];
  authToken: string;
}

// ── API Functions ────────────────────────────────────────────────

/**
 * Save a new futurescape to the backend.
 * Requires an admin auth token.
 */
export async function saveFuturescape(args: SaveFuturescapeArgs): Promise<FuturescapeMetadata> {
  const formData = new FormData();

  formData.append('name', args.name);
  formData.append('description', args.description);
  formData.append('data', JSON.stringify(args.data));
  formData.append('tags', (args.tags || []).join(','));
  formData.append('lab_ids', (args.labIds || []).join(','));

  if (args.htmlExport) {
    const htmlBlob = new Blob([args.htmlExport], { type: 'text/html' });
    formData.append('html_export', htmlBlob, 'export.html');
  }

  if (args.thumbnailLight) {
    formData.append('thumbnail_light', args.thumbnailLight, 'thumbnail-light.png');
  }

  if (args.thumbnailDark) {
    formData.append('thumbnail_dark', args.thumbnailDark, 'thumbnail-dark.png');
  }

  const response = await fetch(`${FUTURITY_API}/management/futurescapes/`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${args.authToken}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(errorData.detail || `Save failed: ${response.status}`);
  }

  return response.json();
}

/**
 * List all published futurescapes.
 */
export async function listFuturescapes(tag?: string): Promise<FuturescapeMetadata[]> {
  const params = new URLSearchParams();
  if (tag) params.set('tag', tag);

  const url = `${FUTURITY_API}/api/public/futurescapes/${params.toString() ? '?' + params : ''}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to list futurescapes: ${response.status}`);
  }

  return response.json();
}

/**
 * List published futurescapes for a specific lab.
 */
export async function listFuturescapesForLab(labId: string): Promise<FuturescapeMetadata[]> {
  const response = await fetch(`${FUTURITY_API}/api/public/futurescapes/lab/${labId}`);

  if (!response.ok) {
    throw new Error(`Failed to list futurescapes for lab: ${response.status}`);
  }

  return response.json();
}

/**
 * Get a published futurescape's metadata by slug.
 */
export async function getFuturescapeMetadata(slug: string): Promise<FuturescapeMetadata> {
  const response = await fetch(`${FUTURITY_API}/api/public/futurescapes/${slug}`);

  if (!response.ok) {
    throw new Error(`Futurescape not found: ${response.status}`);
  }

  return response.json();
}

/**
 * Load the full data.json for a published futurescape.
 * This is the main entry point for the read-only viewer.
 */
export async function loadFuturescapeData(slug: string): Promise<FuturescapeDataPayload> {
  const response = await fetch(`${FUTURITY_API}/api/public/futurescapes/${slug}/data`);

  if (!response.ok) {
    throw new Error(`Futurescape data not found: ${response.status}`);
  }

  return response.json();
}

/**
 * Get the thumbnail URL for a futurescape (proxied through backend).
 */
export function getThumbnailUrl(slug: string, mode: 'light' | 'dark' = 'light'): string {
  return `${FUTURITY_API}/api/public/futurescapes/${slug}/thumbnail/${mode}`;
}

/**
 * Get the HTML export URL for a futurescape.
 */
export function getHtmlExportUrl(slug: string): string {
  return `${FUTURITY_API}/api/public/futurescapes/${slug}/html`;
}

/**
 * Update a futurescape's metadata (admin only).
 */
export async function updateFuturescape(
  futurescapeId: string,
  updates: { name?: string; description?: string; status?: string; tags?: string[]; lab_ids?: string[] },
  authToken: string,
): Promise<FuturescapeMetadata> {
  const response = await fetch(`${FUTURITY_API}/management/futurescapes/${futurescapeId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(errorData.detail || `Update failed: ${response.status}`);
  }

  return response.json();
}
