import { useState } from 'react';
import { FutureInput, Consequence, Solution } from './types';
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

  const handleSubmit = (data: FutureInput) => {
    setManualMode(false);
    setInput(data);
    setImportedData(null);
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
    />
  );
}

export default App;
