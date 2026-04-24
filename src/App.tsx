import { useState, useEffect } from 'react';
import { FutureInput, Consequence, Solution, GenerationConfig, DEFAULT_GENERATION_CONFIG } from './types';
import { InputForm } from './components/InputForm';
import { FuturescapeMap } from './components/FuturescapeMap';
import { decodeGraphFromURL } from './shareCodec';
import './index.css';

// Type for imported data
export interface ImportedData {
  input: FutureInput;
  consequences: Consequence[];
  solutions: Solution[];
}

function App() {
  const [input, setInput] = useState<FutureInput | null>(null);
  const [importedData, setImportedData] = useState<ImportedData | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [generationConfig, setGenerationConfig] = useState<GenerationConfig>(DEFAULT_GENERATION_CONFIG);

  // Check for embedded export data on mount (from Download HTML export)
  // Also check for ?d= URL parameter (from Copy Share Link)
  useEffect(() => {
    // 1. Check URL query parameter first (?d= from Copy Share Link)
    const params = new URLSearchParams(window.location.search);
    const urlData = params.get('d');
    if (urlData) {
      const decoded = decodeGraphFromURL(urlData);
      if (decoded) {
        setInput(decoded.input);
        setImportedData(decoded);
        // Clean the URL so it doesn't look messy / re-trigger on refresh
        window.history.replaceState({}, '', window.location.pathname);
        return;
      }
    }

    // 2. Fall back to embedded script tag (from Download HTML export)
    const embeddedScript = document.getElementById('futurescaper-data');
    if (embeddedScript) {
      try {
        const data = JSON.parse(embeddedScript.textContent || '') as ImportedData;
        if (data.input && data.consequences) {
          setInput(data.input);
          setImportedData(data);
        }
      } catch (e) {
        console.warn('Failed to parse embedded Futurescaper data:', e);
      }
    }
  }, []);

  const handleSubmit = (data: FutureInput, config: GenerationConfig) => {
    setManualMode(false);
    setInput(data);
    setImportedData(null);
    setGenerationConfig(config);
  };

  const handleManualMode = (data: FutureInput) => {
    setManualMode(true);
    setInput(data);
    setImportedData(null);
  };

  const handleImport = (data: ImportedData) => {
    setManualMode(false);
    setInput(data.input);
    setImportedData(data);
  };

  const handleBack = () => {
    setInput(null);
    setImportedData(null);
    setManualMode(false);
  };

  if (!input) {
    return <InputForm onSubmit={handleSubmit} onImport={handleImport} onManualMode={handleManualMode} />;
  }

  return (
    <FuturescapeMap
      input={input}
      onBack={handleBack}
      onApiError={() => {}}
      importedData={importedData}
      manualMode={manualMode}
      generationConfig={generationConfig}
    />
  );
}

export default App;
