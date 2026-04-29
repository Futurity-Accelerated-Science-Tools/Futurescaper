import { useState, useEffect } from 'react';
import { Key, Eye, EyeOff, CheckCircle2, AlertCircle, RefreshCw, X, ChevronDown, ExternalLink, Zap, DollarSign, Sparkles } from 'lucide-react';
import { Box, Flex, Text, Button, Input } from '@chakra-ui/react';
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
        return (
          <Flex as="span" display="inline-flex" alignItems="center" gap="1" px="2" py="0.5" bg="bg.hover" color="fg" rounded="full" fontSize="xs" fontWeight="medium">
            <DollarSign size={12} />Best Value
          </Flex>
        );
      case 'groq':
        return (
          <Flex as="span" display="inline-flex" alignItems="center" gap="1" px="2" py="0.5" bg="bg.hover" color="fg" rounded="full" fontSize="xs" fontWeight="medium">
            <Zap size={12} />Free Tier
          </Flex>
        );
      case 'gemini':
        return (
          <Flex as="span" display="inline-flex" alignItems="center" gap="1" px="2" py="0.5" bg="bg.hover" color="fg" rounded="full" fontSize="xs" fontWeight="medium">
            <DollarSign size={12} />Cheap
          </Flex>
        );
      case 'openai':
        return (
          <Flex as="span" display="inline-flex" alignItems="center" gap="1" px="2" py="0.5" bg="bg.hover" color="fg" rounded="full" fontSize="xs" fontWeight="medium">
            Popular
          </Flex>
        );
      case 'claude':
        return (
          <Flex as="span" display="inline-flex" alignItems="center" gap="1" px="2" py="0.5" bg="bg.hover" color="fg" rounded="full" fontSize="xs" fontWeight="medium">
            <Sparkles size={12} />Highest Quality
          </Flex>
        );
      default:
        return null;
    }
  };

  if (isSet && !isEditing && !hasError) {
    const providerConfig = getProviderConfig();
    return (
      <Box bg="success/8" borderWidth="1px" borderColor="success/20" rounded="xl" p="4">
        <Flex alignItems="center" justifyContent="space-between">
          <Flex alignItems="center" gap="2">
            <CheckCircle2 size={20} style={{ color: 'var(--chakra-colors-fg-success, #16a34a)' }} />
            <Text color="fg.success" fontWeight="medium">
              {providerConfig.name} API key configured
            </Text>
            <Text color="fg.success" fontSize="sm">({providerConfig.costPer1MTokens})</Text>
          </Flex>
          <Flex alignItems="center" gap="2">
            <Button
              onClick={handleEdit}
              size="sm"
              bg="success/8"
              color="fg.success"
              rounded="lg"
              fontSize="sm"
              fontWeight="medium"
              _hover={{ bg: 'success/20' }}
            >
              <RefreshCw size={14} />
              Change
            </Button>
            <Button
              onClick={handleClear}
              size="sm"
              bg="error/8"
              color="fg.error"
              rounded="lg"
              fontSize="sm"
              fontWeight="medium"
              _hover={{ bg: 'error/20' }}
            >
              <X size={14} />
              Clear
            </Button>
          </Flex>
        </Flex>
      </Box>
    );
  }

  // Show error state if API key was set but has error
  if (isSet && hasError && !isEditing) {
    return (
      <Box bg="error/8" borderWidth="1px" borderColor="error/20" rounded="xl" p="4">
        <Flex alignItems="flex-start" gap="3" mb="3">
          <Box flexShrink={0} mt="0.5">
            <AlertCircle size={20} style={{ color: 'var(--chakra-colors-fg-error, #dc2626)' }} />
          </Box>
          <Box>
            <Text fontWeight="semibold" color="fg.error">API Key Error</Text>
            <Text fontSize="sm" color="fg.error" mt="1">
              The saved API key doesn't appear to be working. Please enter a valid API key.
            </Text>
          </Box>
        </Flex>
        <Flex alignItems="center" gap="2">
          <Button
            onClick={handleEdit}
            bg="error"
            color="white"
            rounded="lg"
            fontSize="sm"
            fontWeight="medium"
            px="4"
            py="2"
            _hover={{ bg: 'error' }}
          >
            Enter New API Key
          </Button>
          <Button
            onClick={handleClear}
            bg="error/8"
            color="fg.error"
            rounded="lg"
            fontSize="sm"
            fontWeight="medium"
            px="4"
            py="2"
            _hover={{ bg: 'error/20' }}
          >
            Clear Key
          </Button>
        </Flex>
      </Box>
    );
  }

  return (
    <Box bg="bg.hover" borderWidth="1px" borderColor="border.muted" rounded="xl" p="4">
      <Flex alignItems="flex-start" gap="3" mb="4">
        <Box flexShrink={0} mt="0.5">
          <Key size={20} style={{ color: 'var(--chakra-colors-fg-secondary, #475569)' }} />
        </Box>
        <Box>
          <Text fontWeight="semibold" color="fg">AI Provider Setup</Text>
          <Text fontSize="sm" color="fg.secondary" mt="1">
            Choose your AI provider and enter your API key. Keys are stored locally and never sent anywhere except to the provider's API.
          </Text>
        </Box>
      </Flex>

      {/* Provider Selection */}
      <Box mb="4">
        <Text as="label" display="block" fontSize="sm" fontWeight="medium" color="fg" mb="2">
          Select AI Provider
        </Text>
        <Box position="relative">
          <Flex
            as="button"
            type="button"
            onClick={() => setShowProviderDropdown(!showProviderDropdown)}
            w="full"
            px="4"
            py="3"
            rounded="lg"
            borderWidth="1px"
            borderColor="border.muted"
            bg="bg.canvas"
            _hover={{ bg: 'bg.hover' }}
            _focus={{ borderColor: 'border.focus', ring: '2px', ringColor: 'brand/20' }}
            outline="none"
            textAlign="left"
            alignItems="center"
            justifyContent="space-between"
            cursor="pointer"
          >
            <Flex alignItems="center" gap="3">
              <Text fontWeight="medium" color="fg">{currentConfig.name}</Text>
              {getProviderBadge(selectedProvider)}
            </Flex>
            <Box
              transition="transform 0.2s"
              transform={showProviderDropdown ? 'rotate(180deg)' : undefined}
            >
              <ChevronDown size={20} style={{ color: 'var(--chakra-colors-fg-muted, #94a3b8)' }} />
            </Box>
          </Flex>

          {showProviderDropdown && (
            <Box
              position="absolute"
              zIndex={10}
              w="full"
              mt="1"
              bg="bg.canvas"
              borderWidth="1px"
              borderColor="border.muted"
              rounded="lg"
              shadow="lg"
              overflow="hidden"
            >
              {(Object.keys(PROVIDERS) as Provider[]).map((provider) => {
                const config = PROVIDERS[provider];
                return (
                  <Flex
                    as="button"
                    key={provider}
                    type="button"
                    onClick={() => handleProviderChange(provider)}
                    w="full"
                    px="4"
                    py="3"
                    textAlign="left"
                    _hover={{ bg: 'bg.hover' }}
                    alignItems="center"
                    justifyContent="space-between"
                    borderBottomWidth="1px"
                    borderColor="border.muted"
                    _last={{ borderBottomWidth: '0' }}
                    bg={provider === selectedProvider ? 'brand/8' : undefined}
                    cursor="pointer"
                  >
                    <Box>
                      <Flex alignItems="center" gap="2">
                        <Text fontWeight="medium" color="fg">{config.name}</Text>
                        {getProviderBadge(provider)}
                      </Flex>
                      <Text fontSize="sm" color="fg.secondary" mt="0.5">{config.description}</Text>
                    </Box>
                    <Text fontSize="sm" fontFamily="mono" color="fg.secondary" whiteSpace="nowrap" ml="4">{config.costPer1MTokens}</Text>
                  </Flex>
                );
              })}
            </Box>
          )}
        </Box>
      </Box>

      {/* API Key Input */}
      <Box as="form" onSubmit={handleSubmit}>
        <Box mb="3">
          <Text as="label" display="block" fontSize="sm" fontWeight="medium" color="fg" mb="2">
            {currentConfig.name} API Key
          </Text>
          <Box position="relative">
            <Input
              type={showKey ? 'text' : 'password'}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder={currentConfig.keyPlaceholder}
              w="full"
              px="4"
              py="2"
              pr="10"
              rounded="lg"
              borderWidth="1px"
              borderColor="border.muted"
              bg="bg.canvas"
              _focus={{ borderColor: 'border.focus', ring: '2px', ringColor: 'brand/20' }}
              outline="none"
              fontSize="sm"
              fontFamily="mono"
            />
            <Box
              as="button"
              type="button"
              onClick={() => setShowKey(!showKey)}
              position="absolute"
              right="3"
              top="50%"
              transform="translateY(-50%)"
              color="fg.muted"
              _hover={{ color: 'fg.secondary' }}
              cursor="pointer"
            >
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </Box>
          </Box>
        </Box>

        {error && (
          <Flex alignItems="center" gap="2" fontSize="sm" color="fg.error" mb="3">
            <AlertCircle size={16} />
            {error}
          </Flex>
        )}

        <Flex alignItems="center" gap="3">
          <Button
            type="submit"
            bg="brand"
            color="brand.contrast"
            rounded="lg"
            fontSize="sm"
            fontWeight="medium"
            px="4"
            py="2"
            _hover={{ bg: 'brand.hover' }}
          >
            Save API Key
          </Button>
          {isEditing && (
            <Button
              type="button"
              onClick={() => {
                setIsEditing(false);
                setKey('');
                setError(null);
              }}
              bg="bg.active"
              color="fg"
              rounded="lg"
              fontSize="sm"
              fontWeight="medium"
              px="4"
              py="2"
              _hover={{ bg: 'bg.hover' }}
            >
              Cancel
            </Button>
          )}
          <Box
            as="a"
            href={currentConfig.signupUrl}
            target="_blank"
            rel="noopener noreferrer"
            display="flex"
            alignItems="center"
            gap="1"
            fontSize="sm"
            color="fg.link"
            _hover={{ color: 'brand.hover' }}
          >
            Get an API key <ExternalLink size={14} />
          </Box>
        </Flex>
      </Box>

      {/* Provider comparison info */}
      <Box mt="4" pt="4" borderTopWidth="1px" borderColor="border.muted">
        <Text fontSize="xs" color="fg.secondary">
          <strong>Tip:</strong> DeepSeek offers the best value at ~$0.14/1M tokens (95% cheaper than Claude).
          Groq has a free tier with very fast inference. OpenRouter gives you access to many models.
        </Text>
      </Box>
    </Box>
  );
}
