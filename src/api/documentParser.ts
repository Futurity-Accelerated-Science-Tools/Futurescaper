// Document parsing utilities for extracting text from uploaded files

// Extract text from a File object
export async function extractTextFromFile(file: File): Promise<string> {
  const fileType = file.type;
  const fileName = file.name.toLowerCase();

  // Plain text files
  if (fileType === 'text/plain' || fileName.endsWith('.txt') || fileName.endsWith('.md')) {
    return await file.text();
  }

  // PDF files - use pdf.js
  if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
    return await extractTextFromPDF(file);
  }

  // For other file types, try to read as text
  try {
    return await file.text();
  } catch {
    throw new Error(`Unsupported file type: ${fileType || fileName}`);
  }
}

// Extract text from PDF using pdf.js
async function extractTextFromPDF(file: File): Promise<string> {
  // Dynamically load pdf.js
  const pdfjsLib = await loadPdfJs();

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ');
    fullText += pageText + '\n\n';
  }

  return fullText.trim();
}

// Lazy load pdf.js from CDN
let pdfJsPromise: Promise<any> | null = null;

function loadPdfJs(): Promise<any> {
  if (pdfJsPromise) return pdfJsPromise;

  pdfJsPromise = new Promise((resolve, reject) => {
    // Check if already loaded
    if ((window as any).pdfjsLib) {
      resolve((window as any).pdfjsLib);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
      const pdfjsLib = (window as any).pdfjsLib;
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      resolve(pdfjsLib);
    };
    script.onerror = () => reject(new Error('Failed to load PDF.js'));
    document.head.appendChild(script);
  });

  return pdfJsPromise;
}

// Extract text from a URL (fetches and parses)
export async function extractTextFromURL(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/pdf')) {
      const blob = await response.blob();
      const file = new File([blob], 'document.pdf', { type: 'application/pdf' });
      return await extractTextFromPDF(file);
    }

    if (contentType.includes('text/html')) {
      const html = await response.text();
      return extractTextFromHTML(html);
    }

    // Default to plain text
    return await response.text();
  } catch (error) {
    throw new Error(`Failed to fetch URL: ${(error as Error).message}`);
  }
}

// Extract readable text from HTML
function extractTextFromHTML(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Remove script, style, and other non-content elements
  const elementsToRemove = doc.querySelectorAll('script, style, nav, header, footer, aside, .ads, .comments');
  elementsToRemove.forEach(el => el.remove());

  // Try to find main content
  const mainContent =
    doc.querySelector('article') ||
    doc.querySelector('main') ||
    doc.querySelector('.content') ||
    doc.querySelector('.post') ||
    doc.body;

  // Get text content
  let text = mainContent?.textContent || '';

  // Clean up whitespace
  text = text
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n\n')
    .trim();

  return text;
}

// Truncate text to a reasonable length for API context
export function truncateForContext(text: string, maxLength: number = 4000): string {
  if (text.length <= maxLength) return text;

  // Try to truncate at a sentence boundary
  const truncated = text.slice(0, maxLength);
  const lastSentenceEnd = Math.max(
    truncated.lastIndexOf('.'),
    truncated.lastIndexOf('!'),
    truncated.lastIndexOf('?')
  );

  if (lastSentenceEnd > maxLength * 0.8) {
    return truncated.slice(0, lastSentenceEnd + 1) + '\n\n[Content truncated...]';
  }

  return truncated + '...\n\n[Content truncated...]';
}
