import { useState, useEffect } from 'react';
import { Key, Eye, EyeOff, CheckCircle2, AlertCircle, RefreshCw, X, ChevronDown, ExternalLink, Zap, DollarSign, Sparkles } from 'lucide-react';
import { setApiKey, hasApiKey } from '../api/claude';
import {
  Provider,
  PROVIDERS,
  getProvider,
  setProvider,
  getProviderConfig,
  validateApiKeyFormat,
  loadSavedConfig,
} from '../api/providers';

interface ApiKeyInputProps {
  onKeySet: () => void;
  hasError?: boolean;
}

export function ApiKeyInput({ onKeySet, hasError = false }: ApiKeyInputProps) {
  const [key, setKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isSet, setIsSet] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<Provider>('deepseek');
  const [showProviderDropdown, setShowProviderDropdown] = useState(false);

  useEffect(() => {
    // Load saved configuration
    loadSavedConfig();
    const currentProvider = getProvider();
    setSelectedProvider(currentProvider);

    if (hasApiKey()) {
      setIsSet(true);
      onKeySet();
    }
  }, [onKeySet]);

  // If there's an external error, show editing mode
  useEffect(() => {
    if (hasError && isSet) {
      setError('API key appears to be invalid. Please enter a valid key.');
    }
  }, [hasError, isSet]);

  const handleProviderChange = (provider: Provider) => {
    setSelectedProvider(provider);
    setProvider(provider);
    setShowProviderDropdown(false);
    setError(null);
    // Clear existing key when switching providers
    if (isSet) {
      setIsSet(false);
      setKey('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!key.trim()) {
      setError('Please enter an API key');
      return;
    }

    const config = PROVIDERS[selectedProvider];
    if (!validateApiKeyFormat(key, selectedProvider)) {
      setError(`Invalid API key format. It should start with "${config.keyPrefix}"`);
      return;
    }

    // Set provider and API key
    setProvider(selectedProvider);
    setApiKey(key);
    setIsSet(true);
    setIsEditing(false);
    onKeySet();
  };

  const handleClear = () => {
    setApiKey('');
    setKey('');
    setIsSet(false);
    setIsEditing(false);
    setError(null);
  };

  const handleEdit = () => {
    setIsEditing(true);
    setKey('');
  };

  const currentConfig = PROVIDERS[selectedProvider];

  // Provider badges/icons
  const getProviderBadge = (provider: Provider) => {
    switch (provider) {
      case 'deepseek':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium"><DollarSign className="w-3 h-3" />Best Value</span>;
      case 'groq':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium"><Zap className="w-3 h-3" />Free Tier</span>;
      case 'gemini':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-cyan-100 text-cyan-700 rounded-full text-xs font-medium"><DollarSign className="w-3 h-3" />Cheap</span>;
      case 'openai':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">Popular</span>;
      case 'claude':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium"><Sparkles className="w-3 h-3" />Highest Quality</span>;
      default:
        return null;
    }
  };

  if (isSet && !isEditing && !hasError) {
    const providerConfig = getProviderConfig();
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <span className="text-green-800 font-medium">
              {providerConfig.name} API key configured
            </span>
            <span className="text-green-600 text-sm">({providerConfig.costPer1MTokens})</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleEdit}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Change
            </button>
            <button
              onClick={handleClear}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Clear
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show error state if API key was set but has error
  if (isSet && hasError && !isEditing) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4">
        <div className="flex items-start gap-3 mb-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-900">API Key Error</h3>
            <p className="text-sm text-red-700 mt-1">
              The saved API key doesn't appear to be working. Please enter a valid API key.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleEdit}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
          >
            Enter New API Key
          </button>
          <button
            onClick={handleClear}
            className="px-4 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors"
          >
            Clear Key
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
      <div className="flex items-start gap-3 mb-4">
        <Key className="w-5 h-5 text-slate-600 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="font-semibold text-slate-900">AI Provider Setup</h3>
          <p className="text-sm text-slate-600 mt-1">
            Choose your AI provider and enter your API key. Keys are stored locally and never sent anywhere except to the provider's API.
          </p>
        </div>
      </div>

      {/* Provider Selection */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Select AI Provider
        </label>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowProviderDropdown(!showProviderDropdown)}
            className="w-full px-4 py-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-left flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <span className="font-medium text-slate-900">{currentConfig.name}</span>
              {getProviderBadge(selectedProvider)}
            </div>
            <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${showProviderDropdown ? 'rotate-180' : ''}`} />
          </button>

          {showProviderDropdown && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
              {(Object.keys(PROVIDERS) as Provider[]).map((provider) => {
                const config = PROVIDERS[provider];
                return (
                  <button
                    key={provider}
                    type="button"
                    onClick={() => handleProviderChange(provider)}
                    className={`w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center justify-between border-b border-slate-100 last:border-b-0 ${
                      provider === selectedProvider ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">{config.name}</span>
                        {getProviderBadge(provider)}
                      </div>
                      <p className="text-sm text-slate-500 mt-0.5">{config.description}</p>
                    </div>
                    <span className="text-sm font-mono text-slate-600 whitespace-nowrap ml-4">{config.costPer1MTokens}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* API Key Input */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            {currentConfig.name} API Key
          </label>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder={currentConfig.keyPlaceholder}
              className="w-full px-4 py-2 pr-10 rounded-lg border border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-sm font-mono"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Save API Key
          </button>
          {isEditing && (
            <button
              type="button"
              onClick={() => {
                setIsEditing(false);
                setKey('');
                setError(null);
              }}
              className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-300 transition-colors"
            >
              Cancel
            </button>
          )}
          <a
            href={currentConfig.signupUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
          >
            Get an API key <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </form>

      {/* Provider comparison info */}
      <div className="mt-4 pt-4 border-t border-slate-200">
        <p className="text-xs text-slate-500">
          <strong>💡 Tip:</strong> DeepSeek offers the best value at ~$0.14/1M tokens (95% cheaper than Claude).
          Groq has a free tier with very fast inference. OpenRouter gives you access to many models.
        </p>
      </div>
    </div>
  );
}
