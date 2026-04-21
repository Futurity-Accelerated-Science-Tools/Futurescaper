import React, { useState, useRef } from 'react';
import { FutureInput, Horizon, HORIZON_LABELS, Consequence, Solution } from '../types';
import { Sparkles, FileText, Clock, ArrowRight, Upload, X, Loader2, Link, Globe, Zap, Users, Search, BookOpen, Newspaper, FolderOpen, Hammer } from 'lucide-react';
import { extractTextFromFile, truncateForContext } from '../api/documentParser';
import { fetchUrlContent } from '../api/claude';
import { conductWebResearch, formatResearchForPrompt, ResearchSummary } from '../api/webResearch';

interface ImportedData {
  input: FutureInput;
  consequences: Consequence[];
  solutions: Solution[];
}

interface InputFormProps {
  onSubmit: (input: FutureInput) => void;
  onImport?: (data: ImportedData) => void;
  onManualMode?: (input: FutureInput) => void;
}

export function InputForm({ onSubmit, onImport, onManualMode }: InputFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [horizon, setHorizon] = useState<Horizon>('medium');
  const [perspective, setPerspective] = useState('');
  const [sourceText, setSourceText] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [isProcessingUrl, setIsProcessingUrl] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [inputMode, setInputMode] = useState<'idea' | 'url'>('idea');
  const [enableWebResearch, setEnableWebResearch] = useState(true);
  const [isResearching, setIsResearching] = useState(false);
  const [researchResults, setResearchResults] = useState<ResearchSummary | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  // Handle JSON import
  const handleImportClick = () => {
    importInputRef.current?.click();
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError(null);

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // Validate the imported data has required fields
      if (!data.input || !data.consequences) {
        throw new Error('Invalid file format. Missing required fields.');
      }

      if (!data.input.title || !data.input.horizon) {
        throw new Error('Invalid input data. Missing title or horizon.');
      }

      if (!Array.isArray(data.consequences)) {
        throw new Error('Invalid consequences data. Expected an array.');
      }

      // Call the onImport handler
      if (onImport) {
        onImport({
          input: data.input,
          consequences: data.consequences,
          solutions: data.solutions || [],
        });
      }
    } catch (err) {
      console.error('Import error:', err);
      setImportError(err instanceof Error ? err.message : 'Failed to import file');
    }

    // Reset the input
    e.target.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      let finalSourceText = sourceText;

      // Conduct web research if enabled
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
        sourceUrl: sourceUrl || undefined
      });
    }
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

  const exampleIdeas = [
    {
      title: 'Autonomous Vehicles Become Mainstream',
      description: 'Self-driving cars become the primary mode of transportation across all socioeconomic levels, with fully autonomous vehicles handling commutes, deliveries, and public transit.',
    },
    {
      title: 'Universal Basic Income Implemented',
      description: 'A nationwide universal basic income program provides every adult citizen with a monthly stipend, fundamentally changing work incentives and social safety nets.',
    },
    {
      title: 'Remote Work Becomes the Default',
      description: 'Most knowledge workers permanently shift to remote work, with offices becoming optional collaboration spaces rather than daily workplaces.',
    },
    {
      title: 'Lab-Grown Meat Replaces Farming',
      description: 'Cultured meat becomes cheaper than traditional farming, leading to a dramatic shift away from animal agriculture toward lab-grown protein production.',
    },
  ];

  const fillExample = (example: { title: string; description: string }) => {
    setTitle(example.title);
    setDescription(example.description);
    setInputMode('idea');
  };

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
      // Try to extract title from URL if not set
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
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6 md:p-12">
      <div className="max-w-3xl mx-auto">
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-seed flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900">Futurescape</h1>
          </div>
          <p className="text-slate-600 text-lg">
            Comprehensive consequence mapping across Social, Technological, Economic, Environmental, and Political dimensions.
          </p>
          <p className="text-slate-500 text-sm mt-2">
            Generates 5 orders of consequences + macro/micro solutions • Includes probability & time horizon analysis
          </p>

          {/* Import Previous Analysis Button */}
          {onImport && (
            <div className="mt-4">
              <input
                type="file"
                ref={importInputRef}
                onChange={handleImportFile}
                accept=".json"
                className="hidden"
              />
              <button
                type="button"
                onClick={handleImportClick}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
              >
                <FolderOpen className="w-4 h-4" />
                Load Previous Analysis (JSON)
              </button>
              {importError && (
                <p className="text-red-500 text-sm mt-2">{importError}</p>
              )}
            </div>
          )}
        </div>

        {/* Input Mode Toggle */}
        <div className="flex gap-2 mb-6">
          <button
            type="button"
            onClick={() => setInputMode('idea')}
            className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all flex items-center justify-center gap-2 ${
              inputMode === 'idea'
                ? 'border-seed bg-seed/5 text-seed'
                : 'border-slate-200 text-slate-600 hover:border-slate-300'
            }`}
          >
            <Zap className="w-4 h-4" />
            Describe an Idea
          </button>
          <button
            type="button"
            onClick={() => setInputMode('url')}
            className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all flex items-center justify-center gap-2 ${
              inputMode === 'url'
                ? 'border-seed bg-seed/5 text-seed'
                : 'border-slate-200 text-slate-600 hover:border-slate-300'
            }`}
          >
            <Globe className="w-4 h-4" />
            Analyze from URL
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {inputMode === 'url' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                <Link className="w-4 h-4 inline mr-2" />
                News Article or Source URL
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  placeholder="https://example.com/article..."
                  className="flex-1 px-4 py-3 rounded-lg border border-slate-300 focus:border-seed focus:ring-2 focus:ring-seed/20 outline-none"
                />
                <button
                  type="button"
                  onClick={handleUrlFetch}
                  disabled={!sourceUrl.trim() || isProcessingUrl}
                  className="px-4 py-3 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 disabled:opacity-50 flex items-center gap-2"
                >
                  {isProcessingUrl ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ArrowRight className="w-4 h-4" />
                  )}
                  Fetch
                </button>
              </div>
              {urlError && (
                <p className="mt-2 text-sm text-amber-600">{urlError}</p>
              )}
              <p className="mt-2 text-xs text-slate-500">
                Note: Some sites block direct fetching. If fetch fails, paste the article text below.
              </p>
            </div>
          )}

          {/* Example scenarios - quick fill */}
          {inputMode === 'idea' && (
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <p className="text-sm text-slate-600 mb-2 font-medium">Try an example scenario:</p>
              <div className="flex flex-wrap gap-2">
                {exampleIdeas.map((example, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => fillExample(example)}
                    className="px-3 py-1.5 text-sm bg-white hover:bg-seed hover:text-white border border-slate-200 rounded-full text-slate-700 transition-colors"
                  >
                    {example.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              {inputMode === 'url' ? 'Title for this analysis' : 'What scenario or event are you analyzing?'}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={inputMode === 'url'
                ? "e.g., Analysis: Future of Transportation"
                : "e.g., Autonomous Vehicles Become Mainstream Across Society"}
              className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-seed focus:ring-2 focus:ring-seed/20 outline-none text-lg"
              required
            />
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Describe the scenario in detail <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optionally add more details about the event, decision, or change. Include key actors, context, and what specifically is happening..."
              rows={3}
              className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-seed focus:ring-2 focus:ring-seed/20 outline-none resize-none"
            />
            <p className="mt-2 text-xs text-slate-500">
              More detail = better analysis. But you can skip this if the title is self-explanatory.
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              <Users className="w-4 h-4 inline mr-2" />
              Whose perspective? (Important!)
            </label>
            <input
              type="text"
              value={perspective}
              onChange={(e) => setPerspective(e.target.value)}
              placeholder="e.g., Urban commuters, Auto industry workers, Insurance companies, City planners..."
              className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-seed focus:ring-2 focus:ring-seed/20 outline-none"
            />
            <p className="mt-2 text-xs text-slate-500">
              Consequences are evaluated as positive/negative from this perspective. What's good for one actor may be bad for another.
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {['General Public', 'Business Owners', 'Workers/Employees', 'Government', 'Investors', 'Environment'].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPerspective(p)}
                  className={`px-2 py-1 text-xs rounded-full transition-colors ${
                    perspective === p
                      ? 'bg-seed text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <label className="block text-sm font-semibold text-slate-700 mb-3">
              <Clock className="w-4 h-4 inline mr-2" />
              Analysis Depth (Time Horizon)
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(Object.keys(HORIZON_LABELS) as Horizon[]).map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setHorizon(h)}
                  className={`py-3 px-4 rounded-lg border-2 transition-all ${
                    horizon === h
                      ? 'border-seed bg-seed/5 text-seed'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <div className="font-semibold">{HORIZON_LABELS[h]}</div>
                  <div className="text-xs opacity-70">
                    {h === 'near' && 'Focus on immediate'}
                    {h === 'medium' && 'Balanced analysis'}
                    {h === 'far' && 'Long-term vision'}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              <FileText className="w-4 h-4 inline mr-2" />
              Additional Context (optional)
            </label>

            {/* File upload section */}
            <div className="mb-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,.md"
                onChange={handleFileSelect}
                className="hidden"
              />

              {uploadedFile ? (
                <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <FileText className="w-4 h-4 text-slate-500" />
                  <span className="text-sm text-slate-700 flex-1 truncate">{uploadedFile.name}</span>
                  {isProcessingFile ? (
                    <Loader2 className="w-4 h-4 text-seed animate-spin" />
                  ) : (
                    <button
                      type="button"
                      onClick={clearFile}
                      className="p-1 hover:bg-slate-200 rounded"
                    >
                      <X className="w-4 h-4 text-slate-500" />
                    </button>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-3 px-4 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 hover:border-slate-400 hover:text-slate-600 transition-colors flex items-center justify-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  <span>Upload PDF, TXT, or Markdown file</span>
                </button>
              )}

              {fileError && (
                <p className="mt-2 text-sm text-red-600">{fileError}</p>
              )}
            </div>

            <div className="relative">
              <textarea
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                placeholder="Paste article text, research findings, or other relevant context here..."
                rows={4}
                className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-seed focus:ring-2 focus:ring-seed/20 outline-none resize-none text-sm"
              />
              {sourceText && (
                <div className="absolute bottom-2 right-2 text-xs text-slate-400">
                  {sourceText.length.toLocaleString()} characters
                </div>
              )}
            </div>
          </div>

          {/* Web Research Toggle */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-3">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Search className="w-4 h-4" />
                Auto-scan Web for Latest Context
              </label>
              <button
                type="button"
                onClick={() => setEnableWebResearch(!enableWebResearch)}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  enableWebResearch ? 'bg-seed' : 'bg-slate-300'
                }`}
              >
                <div
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    enableWebResearch ? 'left-7' : 'left-1'
                  }`}
                />
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Searches recent news articles and academic papers to enrich your analysis with real-world context.
            </p>

            {enableWebResearch && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleManualResearch}
                  disabled={!title.trim() || isResearching}
                  className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isResearching ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Scanning...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      Preview Research
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Research Results Preview */}
            {researchResults && researchResults.results.length > 0 && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 text-green-800 font-medium text-sm mb-2">
                  <BookOpen className="w-4 h-4" />
                  Found {researchResults.results.length} sources
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {researchResults.results.slice(0, 5).map((result, idx) => (
                    <div key={idx} className="text-xs">
                      <div className="flex items-center gap-1 text-slate-600">
                        {result.source === 'news' && <Newspaper className="w-3 h-3 text-blue-500" />}
                        {result.source === 'academic' && <BookOpen className="w-3 h-3 text-purple-500" />}
                        <span className="font-medium truncate">{result.title}</span>
                      </div>
                    </div>
                  ))}
                </div>
                {researchResults.keyInsights.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-green-200">
                    <p className="text-xs text-green-700">
                      {researchResults.keyInsights[0]}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <button
              type="submit"
              disabled={!title.trim() || isResearching}
              className="w-full py-4 px-6 bg-seed text-white rounded-xl font-semibold text-lg hover:bg-seed-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isResearching ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Scanning Web Sources...
                </>
              ) : (
                <>
                  Generate Comprehensive Futurescape
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>

            {onManualMode && (
              <button
                type="button"
                disabled={!title.trim()}
                onClick={() => onManualMode({
                  title,
                  description: description.trim() || title,
                  horizon,
                  perspective: perspective.trim() || undefined,
                  sourceText,
                  sourceUrl: sourceUrl || undefined,
                })}
                className="w-full py-3 px-6 bg-white border-2 border-slate-300 text-slate-700 rounded-xl font-semibold text-base hover:border-slate-400 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Hammer className="w-5 h-5" />
                Manual Mode — Build Map by Hand
              </button>
            )}
          </div>

          <div className="text-center text-sm text-slate-500">
            {enableWebResearch
              ? '⏱️ Includes web research • Full analysis takes 2-4 minutes'
              : '⏱️ Full analysis takes 2-3 minutes • Generates 60-80 consequences + solutions'
            }
          </div>
        </form>

      </div>
    </div>
  );
}
