import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  Bot,
  Check,
  CheckCircle2,
  Clock3,
  Code2,
  Edit3,
  ExternalLink,
  FileJson,
  History,
  Image as ImageIcon,
  KeyRound,
  Loader2,
  MessageSquareText,
  Mic,
  PlayCircle,
  Plus,
  Search,
  Send,
  Settings2,
  SlidersHorizontal,
  Trash2,
  UserRound,
  Video,
  X,
} from 'lucide-react';
import CodeBlock from '../components/CodeBlock';
import CopyButton from '../components/CopyButton';
import ModelPrice from '../components/ModelPrice';
import { createToken, getTokens } from '../api';
import {
  ConsoleBadge,
  ConsoleField,
  ConsoleFrame,
  ConsolePage,
} from '../components/ConsoleSurface';
import {
  getPublicModelCatalog,
  readPublicModelCatalog,
  SUBROUTER_API_BASE_URL,
} from '../utils/publicCatalog';
import { INVALID_WEBSITE_API_BASE_URL } from '../constants/api';
import {
  getModelCategory,
  getModelDisplayName,
  getModelId,
  getModelRoute,
  getPreferredMode,
  getSupportedModes,
} from '../utils/modelMeta';
import { useAuth } from '../context/AuthContext';
import { usePublicApiBaseUrl } from '../context/SiteContext';

const modeDefinitions = [
  { key: 'chat', label: 'Chat/Text', icon: MessageSquareText, endpoint: 'chat/completions' },
  { key: 'image', label: 'Image', icon: ImageIcon, endpoint: 'images/generations' },
  { key: 'video', label: 'Video', icon: Video, endpoint: 'videos/generations' },
  { key: 'audio', label: 'Audio', icon: Mic, endpoint: 'audio/speech' },
];

const defaultPrompts = {
  chat: 'Write a concise product launch checklist for an AI API.',
  image: 'A polished dashboard for an AI model marketplace, clean lighting, realistic UI, high detail.',
  video: 'A 6 second product demo shot showing a developer selecting an AI model and sending a request.',
  audio: 'Welcome to SubRouter. Choose a model, copy the request, and run it with your API key.',
};

const CONVERSATION_STORAGE_KEY = 'sassai.playground.conversations.v1';

const quickPromptChips = [
  'Summarize this API idea in 5 bullets.',
  'Draft a production readiness checklist.',
  'Compare two model options for a chat app.',
  'Write a concise integration test plan.',
];

export default function Playground() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const cachedCatalog = useMemo(() => readPublicModelCatalog(), []);
  const initialConversationState = useMemo(() => {
    const queryModel = searchParams.get('model') || '';
    const queryMode = searchParams.get('mode') || '';
    const storedConversations = readStoredConversations();
    if (storedConversations.length > 0) {
      const [storedActive, ...rest] = storedConversations;
      const initialActive = normalizeConversation({
        ...storedActive,
        modelId: queryModel || storedActive.modelId,
        mode: queryMode || storedActive.mode,
      });
      return {
        conversations: [initialActive, ...rest],
        activeConversationId: initialActive.id,
        modeTouched: Boolean(queryMode || storedActive.mode),
      };
    }

    const initialConversation = createConversation({
      modelId: queryModel,
      mode: queryMode || 'chat',
    });
    return {
      conversations: [initialConversation],
      activeConversationId: initialConversation.id,
      modeTouched: Boolean(queryMode),
    };
  }, []);
  const [models, setModels] = useState(() => cachedCatalog?.models || []);
  const [loading, setLoading] = useState(() => !cachedCatalog);
  const [conversations, setConversations] = useState(() => initialConversationState.conversations);
  const [activeConversationId, setActiveConversationId] = useState(() => initialConversationState.activeConversationId);
  const [historyQuery, setHistoryQuery] = useState('');
  const [renamingId, setRenamingId] = useState('');
  const [renameValue, setRenameValue] = useState('');
  const [modelSearch, setModelSearch] = useState('');
  const [composerText, setComposerText] = useState('');
  const [selectedId, setSelectedId] = useState(() => initialConversationState.conversations[0]?.modelId || searchParams.get('model') || '');
  const [activeMode, setActiveMode] = useState(() => initialConversationState.conversations[0]?.mode || searchParams.get('mode') || 'chat');
  const [modeTouched, setModeTouched] = useState(initialConversationState.modeTouched);
  const initialSettings = initialConversationState.conversations[0]?.settings || createDefaultSettings();
  const [temperature, setTemperature] = useState(initialSettings.temperature);
  const [maxTokens, setMaxTokens] = useState(initialSettings.maxTokens);
  const [imageSize, setImageSize] = useState(initialSettings.imageSize);
  const [imageCount, setImageCount] = useState(initialSettings.imageCount);
  const [videoAspect, setVideoAspect] = useState(initialSettings.videoAspect);
  const [videoDuration, setVideoDuration] = useState(initialSettings.videoDuration);
  const [voice, setVoice] = useState(initialSettings.voice);
  const [audioFormat, setAudioFormat] = useState(initialSettings.audioFormat);
  const [codeTab, setCodeTab] = useState('curl');
  const [apiKey, setApiKey] = useState('');
  const [savedKeys, setSavedKeys] = useState([]);
  const [selectedKeyId, setSelectedKeyId] = useState('manual');
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [runState, setRunState] = useState(() => createIdleRunState());
  const activeConversationRef = useRef(activeConversationId);
  const baseUrl = usePublicApiBaseUrl() || SUBROUTER_API_BASE_URL;

  useEffect(() => {
    let cancelled = false;
    if (!cachedCatalog) setLoading(true);

    getPublicModelCatalog()
      .then((catalog) => {
        if (cancelled) return;
        const list = catalog.models;
        setModels(list);
        setSelectedId((current) => current || (list[0] ? getModelId(list[0]) : ''));
      })
      .catch(() => {
        if (!cancelled) setModels([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [cachedCatalog]);

  useEffect(() => {
    saveStoredConversations(conversations);
  }, [conversations]);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setSavedKeys([]);
      setSelectedKeyId('manual');
      setLoadingKeys(false);
      return () => {
        cancelled = true;
      };
    }

    setLoadingKeys(true);
    getTokens()
      .then((res) => {
        if (cancelled) return;
        const keys = normalizeTokenKeys(res.data?.success ? res.data.data : []);
        setSavedKeys(keys);
        const preferred = keys.find((key) => key.status === 1) || keys[0];
        if (preferred) {
          setApiKey((current) => {
            if (current.trim()) return current;
            setSelectedKeyId(String(preferred.id));
            return preferred.value;
          });
        }
      })
      .catch(() => {
        if (!cancelled) setSavedKeys([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingKeys(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeConversationId) || conversations[0],
    [activeConversationId, conversations],
  );

  useEffect(() => {
    if (!activeConversation?.id && conversations[0]?.id) {
      setActiveConversationId(conversations[0].id);
    }
  }, [activeConversation?.id, conversations]);

  useEffect(() => {
    if (!activeConversation || activeConversationRef.current === activeConversation.id) return;
    activeConversationRef.current = activeConversation.id;
    setSelectedId(activeConversation.modelId || selectedId);
    setActiveMode(activeConversation.mode || 'chat');
    setModeTouched(true);
    setComposerText('');
    applySettingsToState(activeConversation.settings || createDefaultSettings(), {
      setTemperature,
      setMaxTokens,
      setImageSize,
      setImageCount,
      setVideoAspect,
      setVideoDuration,
      setVoice,
      setAudioFormat,
    });
    setRunState((current) => {
      revokeRunObjectUrl(current);
      return createIdleRunState();
    });
  }, [activeConversation?.id]);

  const settingsSnapshot = useMemo(() => createDefaultSettings({
    temperature,
    maxTokens,
    imageSize,
    imageCount,
    videoAspect,
    videoDuration,
    voice,
    audioFormat,
  }), [audioFormat, imageCount, imageSize, maxTokens, temperature, videoAspect, videoDuration, voice]);

  useEffect(() => {
    if (!activeConversationId) return;
    setConversations((current) => current.map((conversation) => {
      if (conversation.id !== activeConversationId) return conversation;
      const next = {
        ...conversation,
        modelId: selectedId || conversation.modelId,
        mode: activeMode || conversation.mode || 'chat',
        settings: settingsSnapshot,
      };
      if (
        next.modelId === conversation.modelId
        && next.mode === conversation.mode
        && JSON.stringify(next.settings) === JSON.stringify(conversation.settings)
      ) {
        return conversation;
      }
      return normalizeConversation(next) || conversation;
    }));
  }, [activeConversationId, activeMode, selectedId, settingsSnapshot]);

  const selectedModel = useMemo(
    () => models.find((model) => getModelId(model) === selectedId) || models[0],
    [models, selectedId],
  );
  const modelId = selectedModel ? getModelId(selectedModel) : selectedId || 'gpt-4o-mini';
  const supportedModes = useMemo(() => (selectedModel ? getSupportedModes(selectedModel) : ['chat']), [selectedModel]);
  const filteredModels = useMemo(() => {
    const query = modelSearch.trim().toLowerCase();
    const list = query
      ? models.filter((model) => {
        const haystack = [
          getModelDisplayName(model),
          getModelId(model),
          getModelCategory(model),
          getSupportedModes(model).join(' '),
        ].join(' ').toLowerCase();
        return haystack.includes(query);
      })
      : models;
    return list.slice(0, 80);
  }, [modelSearch, models]);

  const filteredConversations = useMemo(() => {
    const query = historyQuery.trim().toLowerCase();
    if (!query) return conversations;
    return conversations.filter((conversation) => {
      const preview = getConversationPreview(conversation);
      return [
        conversation.title,
        preview,
        conversation.modelId,
        conversation.mode,
      ].join(' ').toLowerCase().includes(query);
    });
  }, [conversations, historyQuery]);

  useEffect(() => {
    if (!selectedModel || modeTouched) return;
    setActiveMode(getPreferredMode(selectedModel));
  }, [selectedModel, modeTouched]);

  useEffect(() => {
    if (!selectedModel || supportedModes.includes(activeMode)) return;
    setActiveMode(getPreferredMode(selectedModel));
    setModeTouched(false);
  }, [activeMode, selectedModel, supportedModes]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (selectedId) next.set('model', selectedId);
    if (activeMode) next.set('mode', activeMode);
    setSearchParams(next, { replace: true });
  }, [selectedId, activeMode, setSearchParams]);

  const requestMessages = useMemo(
    () => (activeMode === 'chat' ? buildChatRequestMessages(activeConversation?.messages || [], composerText) : undefined),
    [activeConversation?.messages, activeMode, composerText],
  );
  const request = useMemo(() => buildRequest({
    mode: activeMode,
    baseUrl,
    modelId,
    prompt: composerText,
    messages: requestMessages,
    temperature,
    maxTokens,
    imageSize,
    imageCount,
    videoAspect,
    videoDuration,
    voice,
    audioFormat,
  }), [activeMode, audioFormat, baseUrl, composerText, imageCount, imageSize, maxTokens, modelId, requestMessages, temperature, videoAspect, videoDuration, voice]);

  const activeDefinition = modeDefinitions.find((mode) => mode.key === activeMode) || modeDefinitions[0];
  const isRunning = runState.status === 'running';
  const sendAvailable = Boolean(composerText.trim() && !isRunning);

  useEffect(() => () => {
    if (runState.result?.objectUrl) {
      URL.revokeObjectURL(runState.result.objectUrl);
    }
  }, [runState.result?.objectUrl]);

  const selectMode = (mode) => {
    setActiveMode(mode);
    setModeTouched(true);
  };

  const selectModel = (value) => {
    const nextModel = models.find((model) => getModelId(model) === value);
    const nextMode = nextModel ? getPreferredMode(nextModel) : activeMode;
    setSelectedId(value);
    setActiveMode(nextMode);
    setModeTouched(false);
    setRunState((current) => {
      revokeRunObjectUrl(current);
      return createIdleRunState();
    });
  };

  const selectSavedKey = (value) => {
    setSelectedKeyId(value);
    if (value === 'manual') {
      setApiKey('');
      return;
    }
    const selectedKey = savedKeys.find((key) => String(key.id) === value);
    if (selectedKey) setApiKey(selectedKey.value);
  };

  const ensureApiKeyForRun = async () => {
    const currentKey = normalizeApiKey(apiKey);
    if (currentKey) return currentKey;

    if (!user) {
      throw new Error('Paste a SubRouter API key in the inspector, or sign in and create an API key before running this request.');
    }

    setLoadingKeys(true);
    try {
      const res = await createToken({ name: 'Playground' });
      if (!res.data?.success) {
        throw new Error(res.data?.message || 'Could not create a Playground API key.');
      }

      const created = res.data?.data || {};
      const createdKey = normalizeApiKey(created.key || created.token || created.api_key || created.value);
      if (!createdKey) {
        throw new Error('A Playground API key was created, but the key value was not returned. Open API Keys and copy a key into the inspector.');
      }

      const normalized = normalizeTokenKeys([{
        ...created,
        id: created.id || createdKey,
        name: created.name || 'Playground',
        key: createdKey,
        status: 1,
      }])[0];
      if (normalized) {
        setSavedKeys((current) => [
          normalized,
          ...current.filter((key) => normalizeApiKey(key.value) !== createdKey),
        ]);
        setSelectedKeyId(String(normalized.id));
      } else {
        setSelectedKeyId('manual');
      }
      setApiKey(createdKey);
      return createdKey;
    } finally {
      setLoadingKeys(false);
    }
  };

  const startNewConversation = () => {
    const conversation = createConversation({
      modelId,
      mode: activeMode,
      settings: settingsSnapshot,
    });
    setConversations((current) => [conversation, ...current]);
    setActiveConversationId(conversation.id);
    setComposerText('');
    setRunState((current) => {
      revokeRunObjectUrl(current);
      return createIdleRunState();
    });
  };

  const selectConversation = (conversation) => {
    if (!conversation?.id) return;
    setActiveConversationId(conversation.id);
    setSelectedId(conversation.modelId || selectedId);
    setActiveMode(conversation.mode || 'chat');
    setModeTouched(true);
    setComposerText('');
    applySettingsToState(conversation.settings || createDefaultSettings(), {
      setTemperature,
      setMaxTokens,
      setImageSize,
      setImageCount,
      setVideoAspect,
      setVideoDuration,
      setVoice,
      setAudioFormat,
    });
    setRunState((current) => {
      revokeRunObjectUrl(current);
      return createIdleRunState();
    });
  };

  const deleteConversation = (conversationId) => {
    const remaining = conversations.filter((conversation) => conversation.id !== conversationId);
    if (remaining.length === 0) {
      const replacement = createConversation({
        modelId,
        mode: activeMode,
        settings: settingsSnapshot,
      });
      setConversations([replacement]);
      setActiveConversationId(replacement.id);
      return;
    }
    setConversations(remaining);
    if (conversationId === activeConversationId) {
      selectConversation(remaining[0]);
    }
  };

  const beginRename = (conversation) => {
    setRenamingId(conversation.id);
    setRenameValue(conversation.title || '');
  };

  const saveRename = () => {
    const title = renameValue.trim();
    if (!renamingId || !title) {
      setRenamingId('');
      setRenameValue('');
      return;
    }
    setConversations((current) => current.map((conversation) => (
      conversation.id === renamingId
        ? { ...conversation, title: title.slice(0, 80), updatedAt: new Date().toISOString() }
        : conversation
    )));
    setRenamingId('');
    setRenameValue('');
  };

  const appendMessagesToConversation = (conversationId, messages, extra = {}) => {
    const now = new Date().toISOString();
    setConversations((current) => current.map((conversation) => {
      if (conversation.id !== conversationId) return conversation;
      const nextMessages = [...conversation.messages, ...messages];
      const firstUserMessage = messages.find((message) => message.role === 'user')
        || nextMessages.find((message) => message.role === 'user');
      return {
        ...conversation,
        ...extra,
        title: conversation.title === 'New chat' && firstUserMessage
          ? generateConversationTitle(firstUserMessage.content)
          : conversation.title,
        modelId,
        mode: activeMode,
        settings: settingsSnapshot,
        updatedAt: now,
        messages: nextMessages,
      };
    }));
  };

  const handleSend = async () => {
    const text = composerText.trim();
    if (!text || isRunning || !activeConversation) return;

    const conversationId = activeConversation.id;
    const userMessage = createMessage('user', text, { modelId, mode: activeMode });
    const messagesForRequest = [...activeConversation.messages, userMessage];
    setComposerText('');
    appendMessagesToConversation(conversationId, [userMessage]);

    setRunState({ status: 'running', result: null, error: null });

    let runApiKey = '';
    try {
      runApiKey = await ensureApiKeyForRun();
    } catch (error) {
      const guidanceMessage = createMessage('error', error.message || 'Add a SubRouter API key in the inspector to run this request. The message was saved, but no model call was made.', {
        modelId,
        mode: activeMode,
      });
      appendMessagesToConversation(conversationId, [guidanceMessage]);
      setRunState({
        status: 'error',
        result: null,
        error: { message: guidanceMessage.content, status: null },
      });
      return;
    }

    const startedAt = performance.now();
    try {
      const requestForRun = buildRequest({
        mode: activeMode,
        baseUrl,
        modelId,
        prompt: text,
        messages: activeMode === 'chat' ? buildChatRequestMessages(messagesForRequest, '') : undefined,
        temperature,
        maxTokens,
        imageSize,
        imageCount,
        videoAspect,
        videoDuration,
        voice,
        audioFormat,
      });
      const result = await executePlaygroundRequest({
        request: requestForRun,
        apiKey: runApiKey,
        mode: activeMode,
        apiPath: activeDefinition.endpoint,
      });
      const resultWithTiming = {
        ...result,
        elapsedMs: Math.round(performance.now() - startedAt),
      };
      const assistantMessage = createMessage('assistant', summarizeRunResult(activeMode, resultWithTiming), {
        modelId,
        mode: activeMode,
        attachments: createResultAttachments(activeMode, resultWithTiming),
      });
      appendMessagesToConversation(conversationId, [assistantMessage]);
      setRunState((current) => {
        revokeRunObjectUrl(current);
        return {
          status: 'success',
          result: resultWithTiming,
          error: null,
        };
      });
    } catch (error) {
      const errorMessage = createMessage('error', error.message || 'Request failed', {
        modelId,
        mode: activeMode,
      });
      appendMessagesToConversation(conversationId, [errorMessage]);
      setRunState((current) => {
        revokeRunObjectUrl(current);
        return {
          status: 'error',
          result: error.result || null,
          error: {
            message: error.message || 'Request failed',
            status: error.status || null,
          },
        };
      });
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500/30 border-t-brand-500" />
      </div>
    );
  }

  return (
    <ConsolePage className="overflow-x-hidden xl:max-w-[1500px]">
      <section className="grid min-w-0 gap-4 lg:gap-5 xl:grid-cols-[300px_minmax(0,1fr)_390px]">
        <HistoryPanel
          conversations={filteredConversations}
          totalCount={conversations.length}
          activeConversationId={activeConversation?.id}
          historyQuery={historyQuery}
          onHistoryQueryChange={setHistoryQuery}
          onNewConversation={startNewConversation}
          onSelectConversation={selectConversation}
          onDeleteConversation={deleteConversation}
          renamingId={renamingId}
          renameValue={renameValue}
          onBeginRename={beginRename}
          onRenameValueChange={setRenameValue}
          onSaveRename={saveRename}
          onCancelRename={() => {
            setRenamingId('');
            setRenameValue('');
          }}
        />

        <ConsoleFrame className="flex min-h-[680px] max-h-[calc(100vh-2rem)] flex-col overflow-hidden">
          <div className="border-b border-page-divider bg-page-surface/40 px-4 py-3 sm:px-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <h1 className="break-words text-lg font-semibold text-page sm:text-xl">
                    {activeConversation?.title || 'New chat'}
                  </h1>
                  <ConsoleBadge tone="slate" className="max-w-full">
                    <span className="truncate">{getModelDisplayName(selectedModel) || modelId}</span>
                  </ConsoleBadge>
                  <ConsoleBadge tone="cyan">{activeDefinition.label}</ConsoleBadge>
                </div>
                <p className="mt-1 break-all font-mono text-xs text-page-muted">{request.endpoint}</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <CopyButton text={request.curl} label="Copy cURL" className="min-h-10" />
                <Link to="/tokens" className="btn-secondary inline-flex min-h-10 items-center justify-center gap-2 px-3 py-2 text-sm">
                  <KeyRound size={15} />
                  API keys
                </Link>
              </div>
            </div>
          </div>

          <ChatTranscript
            conversation={activeConversation}
            isRunning={isRunning}
            modelName={getModelDisplayName(selectedModel) || modelId}
            mode={activeMode}
            onUsePrompt={setComposerText}
          />

          <div className="border-t border-page-divider bg-white p-3 sm:p-4">
            <div className="mb-3 flex min-w-0 gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
              {quickPromptChips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setComposerText(chip)}
                  className="inline-flex min-h-9 shrink-0 items-center rounded-full border border-page-divider bg-page-surface/50 px-3 py-1.5 text-xs font-semibold text-page-secondary transition-colors hover:bg-page-surface-hover hover:text-page"
                >
                  {chip}
                </button>
              ))}
            </div>
            <div className="rounded-xl border border-page-divider bg-page-surface/40 p-2">
              <textarea
                value={composerText}
                onChange={(event) => setComposerText(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                    event.preventDefault();
                    handleSend();
                  }
                }}
                className="min-h-[104px] w-full resize-y rounded-lg border-0 bg-transparent px-3 py-2 text-sm leading-6 text-page outline-none placeholder:text-page-muted"
                placeholder={activeMode === 'audio' ? 'Enter text to synthesize' : 'Message the selected model'}
              />
              <div className="flex flex-col gap-3 border-t border-page-divider pt-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 px-1 text-xs leading-5 text-page-muted">
                  {apiKey.trim()
                    ? 'The selected key is used only for this browser request.'
                    : user
                      ? 'Send will create a Playground API key automatically if none is selected.'
                      : 'Paste an API key in the inspector or sign in before running a model call.'}
                </div>
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!sendAvailable || loadingKeys}
                  className="btn-primary inline-flex min-h-11 w-full items-center justify-center gap-2 px-4 py-2 disabled:opacity-50 sm:w-auto"
                >
                  {isRunning || loadingKeys ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  {isRunning ? 'Running' : loadingKeys ? 'Preparing key' : 'Send'}
                </button>
              </div>
            </div>
          </div>
        </ConsoleFrame>

        <InspectorPanel
          activeDefinition={activeDefinition}
          activeMode={activeMode}
          apiKey={apiKey}
          audioFormat={audioFormat}
          baseUrl={baseUrl}
          codeTab={codeTab}
          filteredModels={filteredModels}
          imageCount={imageCount}
          imageSize={imageSize}
          loadingKeys={loadingKeys}
          maxTokens={maxTokens}
          modelId={modelId}
          modelSearch={modelSearch}
          models={models}
          request={request}
          runState={runState}
          savedKeys={savedKeys}
          selectedKeyId={selectedKeyId}
          selectedModel={selectedModel}
          setApiKey={setApiKey}
          setAudioFormat={setAudioFormat}
          setCodeTab={setCodeTab}
          setImageCount={setImageCount}
          setImageSize={setImageSize}
          setMaxTokens={setMaxTokens}
          setModelSearch={setModelSearch}
          setSelectedId={selectModel}
          setSelectedKeyId={setSelectedKeyId}
          setTemperature={setTemperature}
          setVideoAspect={setVideoAspect}
          setVideoDuration={setVideoDuration}
          setVoice={setVoice}
          supportedModes={supportedModes}
          temperature={temperature}
          videoAspect={videoAspect}
          videoDuration={videoDuration}
          voice={voice}
          onModeChange={selectMode}
          onRunDraft={handleSend}
          runDisabled={!sendAvailable}
          onSelectSavedKey={selectSavedKey}
        />
      </section>
    </ConsolePage>
  );
}

function HistoryPanel({
  conversations,
  totalCount,
  activeConversationId,
  historyQuery,
  onHistoryQueryChange,
  onNewConversation,
  onSelectConversation,
  onDeleteConversation,
  renamingId,
  renameValue,
  onBeginRename,
  onRenameValueChange,
  onSaveRename,
  onCancelRename,
}) {
  return (
    <ConsoleFrame className="min-h-[360px] xl:sticky xl:top-4 xl:h-[calc(100vh-2rem)]">
      <div className="border-b border-page-divider bg-page-surface/40 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <History size={17} className="text-page-muted" />
            <h2 className="font-semibold text-page">History</h2>
            <span className="rounded-full border border-page-divider bg-white px-2 py-0.5 text-xs font-semibold text-page-muted">
              {totalCount}
            </span>
          </div>
          <button
            type="button"
            onClick={onNewConversation}
            className="btn-primary inline-flex min-h-10 shrink-0 items-center justify-center gap-2 px-3 py-2 text-sm"
          >
            <Plus size={15} />
            New
          </button>
        </div>
        <div className="relative mt-3">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-page-muted" />
          <input
            value={historyQuery}
            onChange={(event) => onHistoryQueryChange(event.target.value)}
            className="input h-10 pl-9 text-sm"
            placeholder="Search conversations"
          />
        </div>
      </div>

      <div className="max-h-[520px] overflow-y-auto p-2 xl:max-h-none xl:h-[calc(100%-106px)]">
        {conversations.length === 0 ? (
          <div className="rounded-xl border border-dashed border-page-divider bg-page-surface/40 p-4 text-sm leading-6 text-page-secondary">
            No conversations match this search.
          </div>
        ) : (
          <div className="space-y-2">
            {conversations.map((conversation) => {
              const active = conversation.id === activeConversationId;
              const preview = getConversationPreview(conversation);
              const updated = formatConversationTime(conversation.updatedAt);
              return (
                <div
                  key={conversation.id}
                  className={`group rounded-xl border p-2 transition-colors ${
                    active
                      ? 'border-slate-950 bg-slate-950 text-white'
                      : 'border-page-divider bg-white hover:bg-page-surface-hover'
                  }`}
                >
                  {renamingId === conversation.id ? (
                    <div className="space-y-2">
                      <input
                        value={renameValue}
                        onChange={(event) => onRenameValueChange(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') onSaveRename();
                          if (event.key === 'Escape') onCancelRename();
                        }}
                        className="input h-10 text-sm"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={onSaveRename}
                          className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-slate-950 px-2 py-1.5 text-xs font-semibold text-white"
                        >
                          <Check size={13} />
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={onCancelRename}
                          className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-page-divider bg-white px-2 py-1.5 text-xs font-semibold text-page-secondary"
                        >
                          <X size={13} />
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => onSelectConversation(conversation)}
                        className="block w-full min-w-0 text-left"
                      >
                        <div className="flex min-w-0 items-start justify-between gap-2">
                          <p className={`line-clamp-1 min-w-0 text-sm font-semibold ${active ? 'text-white' : 'text-page'}`}>
                            {conversation.title}
                          </p>
                          <span className={`shrink-0 text-[11px] ${active ? 'text-slate-300' : 'text-page-muted'}`}>
                            {updated}
                          </span>
                        </div>
                        <p className={`mt-1 line-clamp-2 text-xs leading-5 ${active ? 'text-slate-300' : 'text-page-secondary'}`}>
                          {preview || 'No messages yet'}
                        </p>
                        <div className="mt-2 flex min-w-0 flex-wrap gap-1.5">
                          <span className={`max-w-full truncate rounded-full px-2 py-0.5 text-[11px] font-semibold ${active ? 'bg-white/10 text-slate-200' : 'bg-page-surface text-page-muted'}`}>
                            {conversation.modelId || 'No model'}
                          </span>
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${active ? 'bg-white/10 text-slate-200' : 'bg-page-surface text-page-muted'}`}>
                            {conversation.mode || 'chat'}
                          </span>
                        </div>
                      </button>
                      <div className="mt-2 flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => onBeginRename(conversation)}
                          className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${
                            active
                              ? 'border-white/10 text-slate-200 hover:bg-white/10'
                              : 'border-page-divider text-page-muted hover:bg-page-surface-hover hover:text-page'
                          }`}
                          aria-label="Rename conversation"
                          title="Rename"
                        >
                          <Edit3 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteConversation(conversation.id)}
                          className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${
                            active
                              ? 'border-white/10 text-slate-200 hover:bg-white/10'
                              : 'border-page-divider text-page-muted hover:bg-page-surface-hover hover:text-page-danger'
                          }`}
                          aria-label="Delete conversation"
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ConsoleFrame>
  );
}

function ChatTranscript({ conversation, isRunning, modelName, mode, onUsePrompt }) {
  const messages = conversation?.messages || [];

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-white p-3 sm:p-5">
      {messages.length === 0 ? (
        <div className="flex min-h-[420px] items-center justify-center">
          <div className="max-w-xl text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-page-divider bg-page-surface text-page-muted">
              <MessageSquareText size={21} />
            </div>
            <h2 className="mt-4 text-xl font-semibold text-page">Start a Playground conversation</h2>
            <p className="mt-2 text-sm leading-6 text-page-secondary">
              Send a prompt to save the thread, preview the API request, and run it when an API key is selected.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {quickPromptChips.slice(0, 3).map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => onUsePrompt(chip)}
                  className="rounded-full border border-page-divider bg-page-surface/50 px-3 py-2 text-xs font-semibold text-page-secondary hover:bg-page-surface-hover hover:text-page"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              modelName={message.modelId || modelName}
              mode={message.mode || mode}
            />
          ))}
          {isRunning && (
            <div className="flex min-w-0 gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-page-divider bg-page-surface text-page-secondary">
                <Loader2 size={17} className="animate-spin" />
              </div>
              <div className="min-w-0 rounded-xl border border-page-divider bg-page-surface/50 p-3 text-sm text-page-secondary">
                Running request...
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MessageBubble({ message, modelName, mode }) {
  const role = message.role || 'assistant';
  const isUser = role === 'user';
  const isError = role === 'error';
  const isSystem = role === 'system';
  const Icon = isUser ? UserRound : isError ? AlertCircle : isSystem ? Settings2 : Bot;
  const bubbleClass = isUser
    ? 'bg-slate-950 text-white'
    : isError
      ? 'border border-rose-500/20 bg-rose-50 text-rose-800'
      : isSystem
        ? 'border border-amber-500/20 bg-amber-50 text-amber-900'
        : 'border border-page-divider bg-page-surface/50 text-page';
  const metaClass = isUser ? 'text-slate-300' : isError ? 'text-rose-500' : 'text-page-muted';
  const attachments = Array.isArray(message.attachments) ? message.attachments : [];

  return (
    <div className={`flex min-w-0 gap-3 ${isUser ? 'justify-end' : ''}`}>
      {!isUser && (
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${isError ? 'bg-rose-100 text-rose-600' : 'border border-page-divider bg-white text-page-secondary'}`}>
          <Icon size={17} />
        </div>
      )}
      <div className={`min-w-0 max-w-[min(100%,760px)] rounded-xl p-3 text-sm leading-6 sm:p-4 ${bubbleClass}`}>
        <div className={`mb-2 flex min-w-0 flex-wrap items-center justify-between gap-2 text-xs ${metaClass}`}>
          <span className="font-semibold">
            {isUser ? 'You' : isError ? 'Request error' : isSystem ? 'System' : modelName}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock3 size={12} />
            {formatConversationTime(message.createdAt)}
            {mode && <span className="ml-1 rounded-full bg-black/5 px-1.5 py-0.5">{mode}</span>}
          </span>
        </div>
        <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{message.content}</p>
        {attachments.length > 0 && (
          <MediaAttachmentGrid attachments={attachments} mode={message.mode || mode} />
        )}
        <div className="mt-3 flex justify-end">
          <CopyButton
            text={message.content}
            iconOnly
            className={isUser ? 'border-white/10 bg-white/10 text-white hover:bg-white/15 hover:text-white' : 'min-h-8 px-2 py-1'}
          />
        </div>
      </div>
      {isUser && (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white">
          <UserRound size={17} />
        </div>
      )}
    </div>
  );
}

function InspectorPanel({
  activeDefinition,
  activeMode,
  apiKey,
  audioFormat,
  baseUrl,
  codeTab,
  filteredModels,
  imageCount,
  imageSize,
  loadingKeys,
  maxTokens,
  modelId,
  modelSearch,
  models,
  request,
  runState,
  savedKeys,
  selectedKeyId,
  selectedModel,
  setApiKey,
  setAudioFormat,
  setCodeTab,
  setImageCount,
  setImageSize,
  setMaxTokens,
  setModelSearch,
  setSelectedId,
  setSelectedKeyId,
  setTemperature,
  setVideoAspect,
  setVideoDuration,
  setVoice,
  supportedModes,
  temperature,
  videoAspect,
  videoDuration,
  voice,
  onModeChange,
  onRunDraft,
  runDisabled,
  onSelectSavedKey,
}) {
  const ActiveModeIcon = activeDefinition.icon;

  return (
    <aside className="min-w-0 space-y-4 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto">
      <ConsoleFrame className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-semibold text-page">Inspector</h2>
            <p className="mt-1 text-xs leading-5 text-page-secondary">{models.length.toLocaleString()} catalog models loaded</p>
          </div>
          <Link to="/docs/quickstart" className="btn-secondary inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 px-3 py-1.5 text-xs">
            <Code2 size={14} />
            Docs
          </Link>
        </div>

        <div className="mt-4 space-y-4">
          <ConsoleField label="Search models">
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-page-muted" />
              <input
                value={modelSearch}
                onChange={(event) => setModelSearch(event.target.value)}
                className="input h-10 pl-9 text-sm"
                placeholder="Model name or id"
              />
            </div>
          </ConsoleField>

          <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-page-divider bg-page-surface/30 p-2">
            {filteredModels.map((model) => {
              const id = getModelId(model);
              const active = id === modelId;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSelectedId(id)}
                  className={`block w-full rounded-lg border p-2 text-left transition-colors ${
                    active
                      ? 'border-slate-950 bg-slate-950 text-white'
                      : 'border-page-divider bg-white text-page hover:bg-page-surface-hover'
                  }`}
                >
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <span className="line-clamp-1 min-w-0 text-sm font-semibold">{getModelDisplayName(model)}</span>
                    <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${active ? 'bg-white/10 text-slate-200' : 'bg-page-surface text-page-muted'}`}>
                      {getModelCategory(model)}
                    </span>
                  </div>
                  <p className={`mt-1 break-all font-mono text-[11px] ${active ? 'text-slate-300' : 'text-page-muted'}`}>{id}</p>
                </button>
              );
            })}
            {filteredModels.length === 0 && (
              <div className="rounded-lg border border-dashed border-page-divider bg-white p-3 text-sm text-page-secondary">
                No models found.
              </div>
            )}
          </div>

          {selectedModel && (
            <div className="rounded-xl border border-page-divider bg-white p-3">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="break-words text-sm font-semibold text-page [overflow-wrap:anywhere]">{getModelDisplayName(selectedModel)}</h3>
                  <p className="mt-1 break-all font-mono text-[11px] text-page-muted">{modelId}</p>
                </div>
                <CopyButton text={modelId} label="Copy id" iconOnly className="shrink-0" />
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <ConsoleBadge tone="slate">{getModelCategory(selectedModel)}</ConsoleBadge>
                {supportedModes.map((supportedMode) => (
                  <ConsoleBadge key={supportedMode} tone="slate">{supportedMode}</ConsoleBadge>
                ))}
              </div>
              <div className="mt-3">
                <ModelPrice model={selectedModel} />
              </div>
              <Link to={getModelRoute(selectedModel)} className="btn-secondary mt-3 flex min-h-9 items-center justify-center px-3 py-2 text-sm">
                Details
              </Link>
            </div>
          )}
        </div>
      </ConsoleFrame>

      {(runState.status === 'success' || runState.status === 'error') && (
        <ConsoleFrame className="p-4">
          <div className="flex items-center gap-2">
            {runState.status === 'success' ? (
              <CheckCircle2 size={17} className="text-emerald-600" />
            ) : (
              <AlertCircle size={17} className="text-page-danger" />
            )}
            <h2 className="font-semibold text-page">Run result</h2>
          </div>
          {runState.status === 'success' ? (
            <RunResult mode={activeMode} result={runState.result} />
          ) : (
            <div className="mt-3">
              <RunError error={runState.error} result={runState.result} />
            </div>
          )}
        </ConsoleFrame>
      )}

      <ConsoleFrame className="p-4">
        <div className="flex min-w-0 items-center gap-2">
          <ActiveModeIcon size={17} className="text-page-muted" />
          <h2 className="font-semibold text-page">Mode</h2>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {modeDefinitions.map((mode) => {
            const Icon = mode.icon;
            const active = activeMode === mode.key;
            const supported = mode.key === 'chat' || supportedModes.includes(mode.key);
            return (
              <button
                key={mode.key}
                type="button"
                onClick={() => onModeChange(mode.key)}
                className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-2 py-2 text-sm font-semibold transition-colors ${
                  active
                    ? 'border-slate-950 bg-slate-950 text-white'
                    : 'border-page-divider bg-white text-page-secondary hover:bg-page-surface-hover hover:text-page'
                }`}
              >
                <Icon size={16} />
                <span>{mode.label.replace('/Text', '')}</span>
                {!supported && <span className={active ? 'text-slate-300' : 'text-page-muted'}>*</span>}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-xs leading-5 text-page-muted">{getModeDescription(activeMode)}</p>
      </ConsoleFrame>

      <ConsoleFrame className="p-4">
        <div className="flex min-w-0 items-center gap-2">
          <KeyRound size={17} className="text-page-muted" />
          <h2 className="font-semibold text-page">API key</h2>
        </div>
        <div className="mt-4 space-y-3">
          {savedKeys.length > 0 && (
            <SelectControl
              label="Saved key"
              value={selectedKeyId}
              onChange={onSelectSavedKey}
              options={[
                { value: 'manual', label: 'Manual / pasted key' },
                ...savedKeys.map((key) => ({
                  value: String(key.id),
                  label: `${key.name || 'API key'} - ${maskApiKey(key.value)}${key.status === 1 ? '' : ' - disabled'}`,
                })),
              ]}
            />
          )}
          <ConsoleField label="Bearer token">
            <input
              type="password"
              value={apiKey}
              onChange={(event) => {
                setSelectedKeyId('manual');
                setApiKey(event.target.value);
              }}
              className="input h-11 font-mono"
              placeholder={loadingKeys ? 'Loading keys...' : 'sk-...'}
              autoComplete="off"
              spellCheck={false}
            />
          </ConsoleField>
          <div className="rounded-xl border border-page-divider bg-page-surface/50 p-3 text-xs leading-5 text-page-secondary">
            Browser runs use this key for the current request only. Signed-in users get a Playground key automatically if this field is empty.
          </div>
        </div>
      </ConsoleFrame>

      <ConsoleFrame className="p-4">
        <div className="flex min-w-0 items-center gap-2">
          <Settings2 size={17} className="text-page-muted" />
          <h2 className="font-semibold text-page">Settings</h2>
        </div>
        <div className="mt-5 space-y-5">
          {activeMode === 'chat' && (
            <>
              <Control label="Temperature" value={temperature}>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={temperature}
                  onChange={(event) => setTemperature(Number(event.target.value))}
                  className="w-full accent-slate-950"
                />
              </Control>
              <Control label="Max tokens" value={maxTokens}>
                <input
                  type="number"
                  min="1"
                  max="32000"
                  value={maxTokens}
                  onChange={(event) => setMaxTokens(Number(event.target.value))}
                  className="input h-11"
                />
              </Control>
            </>
          )}
          {activeMode === 'image' && (
            <>
              <SelectControl label="Size" value={imageSize} onChange={setImageSize} options={['1024x1024', '1024x1792', '1792x1024']} />
              <Control label="Images" value={imageCount}>
                <input
                  type="number"
                  min="1"
                  max="4"
                  value={imageCount}
                  onChange={(event) => setImageCount(Number(event.target.value))}
                  className="input h-11"
                />
              </Control>
            </>
          )}
          {activeMode === 'video' && (
            <>
              <SelectControl label="Aspect ratio" value={videoAspect} onChange={setVideoAspect} options={['16:9', '9:16', '1:1']} />
              <Control label="Duration seconds" value={videoDuration}>
                <input
                  type="number"
                  min="3"
                  max="30"
                  value={videoDuration}
                  onChange={(event) => setVideoDuration(Number(event.target.value))}
                  className="input h-11"
                />
              </Control>
            </>
          )}
          {activeMode === 'audio' && (
            <>
              <SelectControl label="Voice" value={voice} onChange={setVoice} options={['alloy', 'verse', 'nova', 'shimmer']} />
              <SelectControl label="Format" value={audioFormat} onChange={setAudioFormat} options={['mp3', 'wav', 'opus']} />
            </>
          )}
          <div className="rounded-xl border border-page-divider bg-page-surface/50 p-3 text-xs leading-5 text-page-secondary">
            <SlidersHorizontal size={14} className="mr-1 inline-block align-[-2px]" />
            Settings are saved with the active conversation session and included in request previews.
          </div>
        </div>
      </ConsoleFrame>

      <ConsoleFrame className="p-4">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-semibold text-page">API Preview</h2>
            <p className="mt-1 break-all font-mono text-xs text-page-muted">{request.endpoint}</p>
          </div>
          <button
            type="button"
            onClick={onRunDraft}
            disabled={runDisabled}
            className="btn-primary inline-flex min-h-10 shrink-0 items-center justify-center gap-2 px-3 py-2 text-sm disabled:opacity-50"
          >
            {runState.status === 'running' ? <Loader2 size={15} className="animate-spin" /> : <PlayCircle size={15} />}
            Run
          </button>
        </div>
        <p className="mt-3 text-xs leading-5 text-amber-700">
          Use {baseUrl}; {INVALID_WEBSITE_API_BASE_URL} alone is invalid for API calls.
        </p>
        <div className="mt-4 flex min-w-0 flex-wrap gap-2">
          {['curl', 'javascript', 'python'].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setCodeTab(tab)}
              className={`min-h-9 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                codeTab === tab
                  ? 'bg-slate-950 text-white'
                  : 'border border-page-divider bg-white text-page-secondary hover:bg-page-surface-hover'
              }`}
            >
              {tab === 'curl' ? 'cURL' : tab === 'javascript' ? 'JavaScript' : 'Python'}
            </button>
          ))}
        </div>
        <div className="mt-3 min-w-0">
          <CodeBlock
            title={`${activeDefinition.label} request`}
            language={codeTab}
            code={request[codeTab]}
          />
        </div>
      </ConsoleFrame>

      <ConsoleFrame className="p-4">
        <div className="flex items-center gap-2">
          <FileJson size={17} className="text-page-muted" />
          <h2 className="font-semibold text-page">JSON body</h2>
        </div>
        <pre className="mt-4 max-h-[260px] max-w-full overflow-x-auto overflow-y-auto whitespace-pre-wrap break-words rounded-xl bg-slate-950 p-3 text-[11px] leading-5 text-slate-100 [overflow-wrap:anywhere]">
          <code className="break-words">{JSON.stringify(request.body, null, 2)}</code>
        </pre>
      </ConsoleFrame>
    </aside>
  );
}

function MediaAttachmentGrid({ attachments, mode }) {
  const media = attachments
    .filter((item) => item?.src)
    .map((item) => ({
      ...item,
      type: item.type || mediaTypeForMode(mode),
    }));
  if (media.length === 0) return null;

  const mediaMode = mode || media[0]?.type;

  if (mediaMode === 'image') {
    return (
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {media.map((item, index) => (
          <a key={`${item.src}-${index}`} href={item.src} target="_blank" rel="noreferrer" className="group block overflow-hidden rounded-xl border border-page-divider bg-white">
            <img src={item.src} alt={`Generated result ${index + 1}`} className="aspect-square w-full object-cover transition-transform group-hover:scale-[1.01]" />
          </a>
        ))}
      </div>
    );
  }

  if (mediaMode === 'video') {
    return (
      <div className="mt-3 space-y-3">
        {media.map((item, index) => (
          <div key={`${item.src}-${index}`} className="overflow-hidden rounded-xl border border-page-divider bg-black">
            <video src={item.src} controls className="max-h-[420px] w-full bg-black" />
          </div>
        ))}
      </div>
    );
  }

  if (mediaMode === 'audio') {
    return (
      <div className="mt-3 space-y-3">
        {media.map((item, index) => (
          <audio key={`${item.src}-${index}`} src={item.src} controls className="w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {media.map((item, index) => (
        <a
          key={`${item.src}-${index}`}
          href={item.src}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-page-divider bg-white px-2.5 py-1.5 text-xs font-semibold text-page-secondary hover:bg-page-surface-hover hover:text-page"
        >
          <ExternalLink size={13} />
          Open result {media.length > 1 ? index + 1 : ''}
        </a>
      ))}
    </div>
  );
}

function ChatRunBubble({ endpoint, runState }) {
  const baseClass = 'min-w-0 max-w-full rounded-xl border border-page-divider bg-white p-3 text-sm leading-6 text-page-secondary sm:max-w-3xl sm:p-4';

  return (
    <div className="flex min-w-0 gap-3">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-page-divider bg-page-surface text-page-secondary">
        {runState.status === 'running' ? <Loader2 size={17} className="animate-spin" /> : <Bot size={17} />}
      </div>
      <div className={baseClass}>
        {runState.status === 'running' && (
          <div className="flex items-center gap-2">
            <Loader2 size={15} className="animate-spin" />
            Running chat completion...
          </div>
        )}
        {runState.status === 'error' && <RunError error={runState.error} result={runState.result} />}
        {runState.status === 'success' && <RunResult mode="chat" result={runState.result} />}
        {runState.status === 'idle' && (
          <span>
            The chat request is composed for <span className="break-all font-mono text-page">{endpoint}</span>. Run it to see the assistant response.
          </span>
        )}
      </div>
    </div>
  );
}

function RunResult({ mode, result }) {
  if (!result) return null;
  const media = extractMediaItems(result.payload, mode, result);
  const chatText = mode === 'chat' ? extractChatText(result.payload, result.text) : '';

  return (
    <div className="mt-3 min-w-0 space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-page-muted">
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 font-semibold text-emerald-600">
          <CheckCircle2 size={13} />
          {result.status}
        </span>
        {Number.isFinite(result.elapsedMs) && <span>{result.elapsedMs} ms</span>}
        {result.contentType && <span className="break-all font-mono">{result.contentType}</span>}
      </div>

      {mode === 'chat' && chatText && (
        <p className="whitespace-pre-wrap break-words text-sm leading-6 text-page [overflow-wrap:anywhere]">{chatText}</p>
      )}

      {mode === 'image' && media.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {media.map((item, index) => (
            <a key={`${item.src}-${index}`} href={item.src} target="_blank" rel="noreferrer" className="group block overflow-hidden rounded-xl border border-page-divider bg-page-surface">
              <img src={item.src} alt={`Generated result ${index + 1}`} className="aspect-square w-full object-cover transition-transform group-hover:scale-[1.01]" />
            </a>
          ))}
        </div>
      )}

      {mode === 'video' && media.length > 0 && (
        <div className="space-y-3">
          {media.map((item, index) => (
            <div key={`${item.src}-${index}`} className="overflow-hidden rounded-xl border border-page-divider bg-slate-950">
              <video src={item.src} controls className="max-h-[420px] w-full bg-black" />
            </div>
          ))}
        </div>
      )}

      {mode === 'audio' && media.length > 0 && (
        <div className="space-y-3">
          {media.map((item, index) => (
            <audio key={`${item.src}-${index}`} src={item.src} controls className="w-full" />
          ))}
        </div>
      )}

      {media.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {media.map((item, index) => (
            <a
              key={`open-${item.src}-${index}`}
              href={item.src}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-page-divider px-2.5 py-1.5 text-xs font-semibold text-page-secondary hover:bg-page-surface-hover hover:text-page"
            >
              <ExternalLink size={13} />
              Open result {media.length > 1 ? index + 1 : ''}
            </a>
          ))}
        </div>
      )}

      {(!chatText && media.length === 0) && <JsonPreview payload={result.payload ?? result.text ?? { status: result.status }} />}
      {mode !== 'chat' && media.length === 0 && result.payload && <JsonPreview payload={result.payload} />}
    </div>
  );
}

function RunError({ error, result }) {
  return (
    <div className="min-w-0 space-y-3">
      <div className="flex items-start gap-2 text-page-danger">
        <AlertCircle size={16} className="mt-0.5 shrink-0" />
        <div className="min-w-0">
          <p className="font-semibold">Request failed{error?.status ? ` (${error.status})` : ''}</p>
          <p className="mt-1 break-words text-sm leading-6 [overflow-wrap:anywhere]">{error?.message || 'Request failed'}</p>
        </div>
      </div>
      {result?.payload && <JsonPreview payload={result.payload} />}
    </div>
  );
}

function JsonPreview({ payload }) {
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
  return (
    <pre className="max-h-[280px] max-w-full overflow-auto whitespace-pre-wrap break-words rounded-xl bg-slate-950 p-3 text-[11px] leading-5 text-slate-100 [overflow-wrap:anywhere]">
      <code>{text}</code>
    </pre>
  );
}

function Control({ label, value, children }) {
  return (
    <label className="block">
      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-page-label">{label}</span>
        <span className="font-mono text-page-muted">{value}</span>
      </div>
      {children}
    </label>
  );
}

function SelectControl({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-page-label">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="input h-11"
      >
        {options.map((option) => {
          const optionValue = typeof option === 'object' ? option.value : option;
          const optionLabel = typeof option === 'object' ? option.label : option;
          return <option key={optionValue} value={optionValue}>{optionLabel}</option>;
        })}
      </select>
    </label>
  );
}

function createDefaultSettings(overrides = {}) {
  return {
    temperature: 0.7,
    maxTokens: 1024,
    imageSize: '1024x1024',
    imageCount: 1,
    videoAspect: '16:9',
    videoDuration: 6,
    voice: 'alloy',
    audioFormat: 'mp3',
    ...overrides,
  };
}

function applySettingsToState(settings, setters) {
  const next = createDefaultSettings(settings);
  setters.setTemperature(Number(next.temperature));
  setters.setMaxTokens(Number(next.maxTokens));
  setters.setImageSize(next.imageSize);
  setters.setImageCount(Number(next.imageCount));
  setters.setVideoAspect(next.videoAspect);
  setters.setVideoDuration(Number(next.videoDuration));
  setters.setVoice(next.voice);
  setters.setAudioFormat(next.audioFormat);
}

function readStoredConversations() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CONVERSATION_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed : parsed?.conversations;
    if (!Array.isArray(list)) return [];
    return list
      .map(normalizeConversation)
      .filter(Boolean)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  } catch {
    try {
      window.localStorage.removeItem(CONVERSATION_STORAGE_KEY);
    } catch {
      // Ignore storage failures; the Playground can still run without saved history.
    }
    return [];
  }
}

function saveStoredConversations(conversations) {
  if (typeof window === 'undefined') return;
  try {
    const normalized = conversations
      .map(normalizeConversation)
      .filter(Boolean)
      .slice(0, 100);
    window.localStorage.setItem(CONVERSATION_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // Storage can be full or disabled. Chat still works for the current session.
  }
}

function createConversation({ modelId = '', mode = 'chat', settings, messages = [], title = 'New chat' } = {}) {
  const now = new Date().toISOString();
  return {
    id: createStableId('conv'),
    title,
    modelId,
    mode,
    createdAt: now,
    updatedAt: now,
    messages,
    settings: createDefaultSettings(settings),
  };
}

function normalizeConversation(value) {
  if (!value || typeof value !== 'object') return null;
  const now = new Date().toISOString();
  const id = String(value.id || createStableId('conv'));
  const messages = Array.isArray(value.messages)
    ? value.messages.map(normalizeMessage).filter(Boolean)
    : [];
  return {
    id,
    title: String(value.title || 'New chat').slice(0, 80),
    modelId: String(value.modelId || value.model || ''),
    mode: modeDefinitions.some((mode) => mode.key === value.mode) ? value.mode : 'chat',
    createdAt: isValidIsoDate(value.createdAt) ? value.createdAt : now,
    updatedAt: isValidIsoDate(value.updatedAt) ? value.updatedAt : now,
    messages,
    settings: createDefaultSettings(value.settings || {}),
  };
}

function createMessage(role, content, meta = {}) {
  const attachments = Array.isArray(meta.attachments)
    ? meta.attachments.map((item) => normalizeAttachment(item, meta.mode, { allowBlob: true })).filter(Boolean)
    : [];
  return {
    id: createStableId('msg'),
    role,
    content: String(content || ''),
    createdAt: new Date().toISOString(),
    modelId: meta.modelId || '',
    mode: meta.mode || 'chat',
    attachments,
  };
}

function normalizeMessage(value) {
  if (!value || typeof value !== 'object') return null;
  const content = typeof value.content === 'string' ? value.content : '';
  const mode = modeDefinitions.some((item) => item.key === value.mode) ? value.mode : 'chat';
  const attachments = Array.isArray(value.attachments)
    ? value.attachments.map((item) => normalizeAttachment(item, mode)).filter(Boolean)
    : [];
  if (!content.trim() && attachments.length === 0) return null;
  const role = ['user', 'assistant', 'system', 'error'].includes(value.role) ? value.role : 'assistant';
  return {
    id: String(value.id || createStableId('msg')),
    role,
    content,
    createdAt: isValidIsoDate(value.createdAt) ? value.createdAt : new Date().toISOString(),
    modelId: String(value.modelId || ''),
    mode,
    attachments,
  };
}

function normalizeAttachment(value, fallbackMode = 'file', options = {}) {
  if (!value || typeof value !== 'object') return null;
  const src = String(value.src || value.url || '').trim();
  const validSrc = options.allowBlob ? looksLikeMediaUrl(src) : looksLikePersistentMediaUrl(src);
  if (!src || !validSrc) return null;
  const type = ['image', 'video', 'audio', 'file'].includes(value.type)
    ? value.type
    : mediaTypeForMode(fallbackMode);
  return {
    src,
    type,
    contentType: String(value.contentType || value.mime_type || ''),
  };
}

function createStableId(prefix) {
  const random = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
}

function isValidIsoDate(value) {
  return typeof value === 'string' && Number.isFinite(new Date(value).getTime());
}

function getConversationPreview(conversation) {
  const lastMessage = [...(conversation.messages || [])].reverse().find((message) => message.content);
  return lastMessage ? truncateText(lastMessage.content, 120) : '';
}

function generateConversationTitle(content) {
  return truncateText(String(content || '').replace(/\s+/g, ' ').trim(), 56) || 'New chat';
}

function truncateText(value, limit) {
  const text = String(value || '').trim();
  if (text.length <= limit) return text;
  return `${text.slice(0, Math.max(0, limit - 3)).trim()}...`;
}

function formatConversationTime(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function buildChatRequestMessages(messages, draftText) {
  const requestMessages = (messages || [])
    .filter((message) => ['user', 'assistant', 'system'].includes(message.role))
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));
  const text = String(draftText || '').trim();
  if (text) requestMessages.push({ role: 'user', content: text });
  return requestMessages.length > 0 ? requestMessages : [{ role: 'user', content: defaultPrompts.chat }];
}

function summarizeRunResult(mode, result) {
  if (mode === 'chat') {
    return extractChatText(result.payload, result.text) || 'The request completed, but the response did not include assistant text.';
  }

  const media = extractMediaItems(result.payload, mode, result);
  if (media.length > 0) {
    return `${modeLabel(mode)} request completed with ${media.length} result${media.length === 1 ? '' : 's'}.`;
  }

  const errorText = extractErrorMessage(result.payload, result.text);
  if (errorText) return errorText;
  if (result.payload) return `${modeLabel(mode)} request completed. Result JSON is available in the API preview run state.`;
  return result.text || `${modeLabel(mode)} request completed.`;
}

function createResultAttachments(mode, result) {
  return extractMediaItems(result?.payload, mode, result)
    .map((item) => normalizeAttachment(item, mode, { allowBlob: true }))
    .filter(Boolean);
}

function createIdleRunState() {
  return { status: 'idle', result: null, error: null };
}

function revokeRunObjectUrl(runState) {
  const objectUrl = runState?.result?.objectUrl;
  if (objectUrl) URL.revokeObjectURL(objectUrl);
}

function normalizeTokenKeys(tokens) {
  if (!Array.isArray(tokens)) return [];
  return tokens
    .map((token) => {
      const rawKey = token?.key || token?.token || token?.api_key || token?.value || '';
      const value = normalizeApiKey(rawKey);
      if (!value) return null;
      return {
        id: token?.id ?? value,
        name: token?.name || token?.token_name || token?.label || 'API key',
        value,
        status: Number(token?.status ?? token?.enabled ?? 1),
      };
    })
    .filter(Boolean);
}

function normalizeApiKey(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.startsWith('sk-') ? text : `sk-${text}`;
}

function maskApiKey(value) {
  const text = normalizeApiKey(value);
  if (text.length <= 12) return text ? 'sk-...' : '';
  return `${text.slice(0, 7)}...${text.slice(-4)}`;
}

async function executePlaygroundRequest({ request, apiKey, mode, apiPath }) {
  const response = await fetch('/api/site/saas/playground-proxy', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${normalizeApiKey(apiKey)}`,
    },
    body: JSON.stringify({
      path: apiPath || '',
      body: request.body,
    }),
  });

  const contentType = response.headers.get('content-type') || '';
  const result = await readPlaygroundResponse(response, contentType, mode);

  if (!response.ok) {
    const error = new Error(extractErrorMessage(result.payload, result.text) || `Request failed with HTTP ${response.status}`);
    error.status = response.status;
    error.result = result;
    throw error;
  }

  return result;
}

async function readPlaygroundResponse(response, contentType, mode) {
  const base = {
    status: response.status,
    contentType,
    payload: null,
    text: '',
    objectUrl: '',
  };

  if (contentType.includes('application/json')) {
    const payload = await response.json();
    return { ...base, payload };
  }

  if (isBinaryMediaContentType(contentType, mode)) {
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    return {
      ...base,
      payload: null,
      objectUrl,
      mediaItems: [{ src: objectUrl, type: mediaTypeForMode(mode), contentType }],
    };
  }

  const text = await response.text();
  const parsed = tryParseJson(text);
  return {
    ...base,
    payload: parsed || null,
    text,
  };
}

function isBinaryMediaContentType(contentType, mode) {
  if (mode === 'audio') return contentType.startsWith('audio/');
  if (mode === 'image') return contentType.startsWith('image/');
  if (mode === 'video') return contentType.startsWith('video/');
  return false;
}

function mediaTypeForMode(mode) {
  if (mode === 'image') return 'image';
  if (mode === 'video') return 'video';
  if (mode === 'audio') return 'audio';
  return 'file';
}

function tryParseJson(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractErrorMessage(payload, text) {
  if (payload?.error?.message) return payload.error.message;
  if (typeof payload?.error === 'string') return payload.error;
  if (payload?.message) return payload.message;
  if (payload?.msg) return payload.msg;
  if (typeof text === 'string' && text.trim()) return text.trim().slice(0, 500);
  return '';
}

function extractChatText(payload, fallbackText = '') {
  const choice = Array.isArray(payload?.choices) ? payload.choices[0] : null;
  const content = choice?.message?.content ?? choice?.delta?.content ?? choice?.text;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        return part?.text || part?.content || '';
      })
      .filter(Boolean)
      .join('\n');
  }
  if (typeof content === 'string') return content;
  if (typeof payload?.output_text === 'string') return payload.output_text;
  if (typeof payload?.text === 'string') return payload.text;
  return fallbackText || '';
}

function extractMediaItems(payload, mode, result = {}) {
  const direct = Array.isArray(result.mediaItems) ? result.mediaItems : [];
  if (direct.length > 0) return direct;

  const items = [];
  collectMediaUrls(payload, items, mode);
  return dedupeMediaItems(items.map((item) => ({
    src: typeof item === 'string' ? item : item.src,
    type: typeof item === 'string' ? mediaTypeForMode(mode) : item.type || mediaTypeForMode(mode),
    contentType: typeof item === 'string' ? '' : item.contentType || '',
  })));
}

function collectMediaUrls(value, items, mode) {
  if (!value) return;
  if (typeof value === 'string') {
    if (looksLikeMediaUrl(value)) {
      items.push({ src: value, type: inferMediaTypeFromUrl(value, mode) });
      return;
    }
    const parsedList = parseMaybeJsonMediaList(value, mode);
    if (parsedList.length > 0) items.push(...parsedList);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectMediaUrls(item, items, mode));
    return;
  }
  if (typeof value !== 'object') return;

  const urlKeys = [
    'url',
    'image_url',
    'image_urls',
    'video_url',
    'video_urls',
    'audio_url',
    'audio_urls',
    'output_url',
    'output_urls',
    'file_url',
    'file_urls',
    'media_url',
    'media_urls',
    'signed_url',
    'signed_urls',
    'result_url',
    'result_urls',
    'resultUrl',
    'resultUrls',
    'download_url',
    'download_urls',
    'downloadUrl',
    'downloadUrls',
    'asset_url',
    'asset_urls',
    'assetUrl',
    'assetUrls',
    'uri',
    'uris',
  ];
  urlKeys.forEach((key) => {
    if (typeof value[key] === 'string') {
      if (looksLikeMediaUrl(value[key])) {
        items.push({ src: value[key], type: inferMediaTypeFromKey(key, value[key], mode) });
        return;
      }
      const parsedList = parseMaybeJsonMediaList(value[key], inferModeFromKey(key, mode));
      if (parsedList.length > 0) items.push(...parsedList);
    }
  });

  if (value.image_url && typeof value.image_url === 'object') {
    collectMediaUrls(value.image_url, items, 'image');
  }
  if (value.video_url && typeof value.video_url === 'object') {
    collectMediaUrls(value.video_url, items, 'video');
  }
  if (value.audio_url && typeof value.audio_url === 'object') {
    collectMediaUrls(value.audio_url, items, 'audio');
  }

  if (typeof value.b64_json === 'string') {
    items.push({
      src: `data:${mode === 'audio' ? 'audio/mpeg' : mode === 'video' ? 'video/mp4' : 'image/png'};base64,${value.b64_json}`,
      type: mediaTypeForMode(mode),
    });
  }
  if (typeof value.base64 === 'string' && value.mime_type) {
    items.push({
      src: `data:${value.mime_type};base64,${value.base64}`,
      type: mediaTypeForContentType(value.mime_type, mode),
      contentType: value.mime_type,
    });
  }
  if (typeof value.base64 === 'string' && value.mimeType) {
    items.push({
      src: `data:${value.mimeType};base64,${value.base64}`,
      type: mediaTypeForContentType(value.mimeType, mode),
      contentType: value.mimeType,
    });
  }

  Object.keys(value).forEach((key) => {
    if (urlKeys.includes(key) || key === 'b64_json' || key === 'base64' || key === 'mime_type' || key === 'mimeType') return;
    collectMediaUrls(value[key], items, mode);
  });
}

function looksLikeMediaUrl(value) {
  const text = String(value || '').trim();
  return /^(https?:|blob:|data:image\/|data:video\/|data:audio\/)/i.test(text);
}

function looksLikePersistentMediaUrl(value) {
  const text = String(value || '').trim();
  return /^(https?:|data:image\/|data:video\/|data:audio\/)/i.test(text);
}

function parseMaybeJsonMediaList(value, mode) {
  const text = String(value || '').trim();
  if (!text || !/^[\[{]/.test(text)) return [];
  const parsed = tryParseJson(text);
  if (!parsed) return [];
  const items = [];
  collectMediaUrls(parsed, items, mode);
  return items;
}

function dedupeMediaItems(items) {
  const seen = new Set();
  return items.filter((item) => {
    const src = String(item?.src || '').trim();
    if (!src || seen.has(src)) return false;
    seen.add(src);
    return true;
  });
}

function inferMediaTypeFromKey(key, src, fallbackMode) {
  return mediaTypeForMode(inferModeFromKey(key, fallbackMode)) === 'file'
    ? inferMediaTypeFromUrl(src, fallbackMode)
    : mediaTypeForMode(inferModeFromKey(key, fallbackMode));
}

function inferModeFromKey(key, fallbackMode) {
  const loweredKey = String(key || '').toLowerCase();
  if (loweredKey.includes('image')) return 'image';
  if (loweredKey.includes('video')) return 'video';
  if (loweredKey.includes('audio')) return 'audio';
  return fallbackMode;
}

function inferMediaTypeFromUrl(src, fallbackMode) {
  const text = String(src || '').toLowerCase();
  if (text.startsWith('data:image/')) return 'image';
  if (text.startsWith('data:video/')) return 'video';
  if (text.startsWith('data:audio/')) return 'audio';
  if (/\.(png|jpe?g|webp|gif|avif|bmp)(\?|#|$)/.test(text)) return 'image';
  if (/\.(mp4|webm|mov|m4v|avi|mkv)(\?|#|$)/.test(text)) return 'video';
  if (/\.(mp3|wav|ogg|opus|m4a|aac)(\?|#|$)/.test(text)) return 'audio';
  return mediaTypeForMode(fallbackMode);
}

function mediaTypeForContentType(contentType, fallbackMode) {
  const text = String(contentType || '').toLowerCase();
  if (text.startsWith('image/')) return 'image';
  if (text.startsWith('video/')) return 'video';
  if (text.startsWith('audio/')) return 'audio';
  return mediaTypeForMode(fallbackMode);
}

function buildRequest({
  mode,
  baseUrl,
  modelId,
  prompt,
  messages,
  temperature,
  maxTokens,
  imageSize,
  imageCount,
  videoAspect,
  videoDuration,
  voice,
  audioFormat,
}) {
  const definition = modeDefinitions.find((item) => item.key === mode) || modeDefinitions[0];
  const endpoint = `${baseUrl}/${definition.endpoint}`;
  const body = buildBody({
    mode,
    modelId,
    prompt,
    messages,
    temperature,
    maxTokens,
    imageSize,
    imageCount,
    videoAspect,
    videoDuration,
    voice,
    audioFormat,
  });
  const json = JSON.stringify(body, null, 2);

  return {
    endpoint,
    body,
    curl: `curl -X POST ${endpoint} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $SUBROUTER_API_KEY" \\
  -d '${shellQuoteJson(json)}'`,
    javascript: `const response = await fetch("${endpoint}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": \`Bearer \${process.env.SUBROUTER_API_KEY}\`
  },
  body: JSON.stringify(${json})
});

const data = await response.json();
console.log(data);`,
    python: `import os
import requests

response = requests.post(
    "${endpoint}",
    headers={
        "Content-Type": "application/json",
        "Authorization": f"Bearer {os.environ['SUBROUTER_API_KEY']}",
    },
    json=${toPythonLiteral(body)}
)

print(response.json())`,
  };
}

function buildBody({
  mode,
  modelId,
  prompt,
  messages,
  temperature,
  maxTokens,
  imageSize,
  imageCount,
  videoAspect,
  videoDuration,
  voice,
  audioFormat,
}) {
  if (mode === 'image') {
    return {
      model: modelId,
      prompt,
      size: imageSize,
      n: Number(imageCount),
      response_format: 'url',
    };
  }
  if (mode === 'video') {
    return {
      model: modelId,
      prompt,
      aspect_ratio: videoAspect,
      duration: Number(videoDuration),
    };
  }
  if (mode === 'audio') {
    return {
      model: modelId,
      input: prompt,
      voice,
      response_format: audioFormat,
    };
  }
  return {
    model: modelId,
    temperature: Number(temperature),
    max_tokens: Number(maxTokens),
    messages: Array.isArray(messages) && messages.length > 0
      ? messages
      : [{ role: 'user', content: prompt }],
  };
}

function shellQuoteJson(json) {
  return json.replace(/'/g, "'\"'\"'");
}

function toPythonLiteral(value) {
  return JSON.stringify(value, null, 4)
    .replace(/\btrue\b/g, 'True')
    .replace(/\bfalse\b/g, 'False')
    .replace(/\bnull\b/g, 'None');
}

function getModeDescription(mode) {
  if (mode === 'image') return 'Image models use a prompt, output size, and image count in the request body.';
  if (mode === 'video') return 'Video models use a prompt plus duration and aspect ratio when the selected model supports those fields.';
  if (mode === 'audio') return 'Audio mode builds a text-to-speech request body for compatible speech models.';
  return 'Chat/Text mode builds an OpenAI-compatible chat completions request.';
}

function modeLabel(mode) {
  return modeDefinitions.find((item) => item.key === mode)?.label || 'Request';
}
