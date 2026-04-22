import { useState, useEffect } from 'react';
import { FutureInput, Consequence, Solution, GenerationConfig, DEFAULT_GENERATION_CONFIG } from './types';
import { InputForm } from './components/InputForm';
import { FuturescapeMap } from './components/FuturescapeMap';
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
  useEffect(() => {
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
