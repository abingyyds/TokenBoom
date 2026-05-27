import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowRight, BookOpen, CreditCard, KeyRound, Layers3, RefreshCw, Server, ShieldAlert, TerminalSquare } from 'lucide-react';
import CodeBlock from '../components/CodeBlock';
import CopyButton from '../components/CopyButton';
import {
  CossCard,
  CossCardFrame,
  CossIconTile,
  CossMutedCard,
  CossPage,
  CossPageHeader,
  CossSection,
} from '../components/public/CossLayout';
import {
  getDocsModelCatalog,
  readDocsModelCatalog,
  SUBROUTER_API_BASE_URL,
} from '../utils/publicCatalog';
import {
  buildCurlSnippet,
  buildJsSnippet,
  buildPythonSnippet,
  getModelCategory,
  getModelId,
  getSupportedModes,
} from '../utils/modelMeta';
import { useAuth } from '../context/AuthContext';
import { INVALID_WEBSITE_API_BASE_URL } from '../constants/api';
import { usePublicApiBaseUrl } from '../context/SiteContext';

const navItems = [
  { id: 'api-key', label: 'Get API key' },
  { id: 'base-url', label: 'Base URL' },
  { id: 'selection', label: 'Model selection' },
  { id: 'chat', label: 'Chat completions' },
  { id: 'streaming', label: 'Streaming' },
  { id: 'multimodal', label: 'Multimodal' },
  { id: 'models', label: 'Models' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'errors', label: 'Errors' },
  { id: 'migration', label: 'Migration' },
];

export default function DocsQuickstart() {
  const { user } = useAuth();
  const baseUrl = usePublicApiBaseUrl() || SUBROUTER_API_BASE_URL;
  const cachedCatalog = useMemo(() => readDocsModelCatalog(), []);
  const [models, setModels] = useState(() => cachedCatalog?.models || []);

  useEffect(() => {
    let cancelled = false;

    getDocsModelCatalog()
      .then((catalog) => {
        if (cancelled) return;
        setModels(catalog.models);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  const picked = useMemo(() => pickDocsModels(models), [models]);
  const chatModelId = getModelId(picked.chat || models[0] || { model_name: 'gpt-4o-mini' });
  const visionModelId = getModelId(picked.image || picked.chat || { model_name: 'vision-model-id' });

  const envSnippet = `SUBROUTER_API_KEY=sk-your-api-key
SUBROUTER_BASE_URL=${baseUrl}
SUBROUTER_MODEL=${chatModelId}`;

  const openAiSdkJs = `import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.SUBROUTER_API_KEY,
  baseURL: "${baseUrl}"
});

const completion = await client.chat.completions.create({
  model: "${chatModelId}",
  messages: [{ role: "user", content: "Say hello in one sentence." }]
});

console.log(completion.choices[0].message.content);`;

  const streamingJs = `const stream = await client.chat.completions.create({
  model: "${chatModelId}",
  stream: true,
  messages: [{ role: "user", content: "Write a short launch checklist." }]
});

for await (const part of stream) {
  process.stdout.write(part.choices?.[0]?.delta?.content || "");
}`;

  const multimodalBody = {
    model: visionModelId,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Describe this image in one sentence.' },
          { type: 'image_url', image_url: { url: 'https://example.com/image.png' } },
        ],
      },
    ],
  };

  return (
    <CossPage>
      <CossPageHeader
        eyebrow="Documentation"
        icon={BookOpen}
        title="SubRouter API quickstart"
        description="Use a SubRouter API key with the API base URL, choose a public model id, and send OpenAI-compatible chat completions requests."
        secondary="The quickstart focuses on key creation, base URL, model selection, request shapes, multimodal input, pricing, and migration notes."
        actions={(
          <CossCardFrame className="p-5">
            <div className="flex items-center gap-2">
              <CossIconTile icon={Server} />
              <h2 className="font-semibold text-slate-950">Endpoint</h2>
            </div>
            <div className="mt-4 space-y-3">
              <CopyRow label="Base URL" value={baseUrl} />
              <CopyRow label="Chat" value={`${baseUrl}/chat/completions`} />
              <CopyRow label="Model id" value={chatModelId} />
            </div>
            <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
              {INVALID_WEBSITE_API_BASE_URL} alone is invalid for API calls. Use the API base URL shown above.
            </p>
          </CossCardFrame>
        )}
      >
        <div className="mt-7 grid gap-3 sm:flex sm:flex-row">
          <Link to={user ? '/tokens' : '/register'} className="coss-button-primary px-5 py-3">
            <KeyRound size={16} />
            {user ? 'Open API keys' : 'Create account'}
          </Link>
          <Link to="/models" className="coss-button-secondary px-5 py-3">
            Explore models
            <ArrowRight size={16} />
          </Link>
        </div>
      </CossPageHeader>

      <CossSection>
        <div className="grid min-w-0 gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="min-w-0 space-y-4 lg:sticky lg:top-6 lg:self-start">
            <CossCardFrame className="p-3">
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
                {navItems.map((item) => (
                  <a key={item.id} href={`#${item.id}`} className="shrink-0 rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-950 lg:block lg:w-full">
                    {item.label}
                  </a>
                ))}
              </div>
            </CossCardFrame>
            <CossCardFrame className="p-4">
              <p className="text-sm font-semibold text-slate-950">Current example model</p>
              <p className="mt-2 truncate font-mono text-xs text-slate-500">{chatModelId}</p>
              <div className="mt-3 flex gap-2">
                <Link to={`/playground?model=${encodeURIComponent(chatModelId)}`} className="coss-button-primary min-h-9 min-w-0 flex-1 px-3 py-2 text-xs">
                  Playground
                </Link>
                <CopyButton text={chatModelId} iconOnly className="h-9 w-9 px-0 py-0" />
              </div>
            </CossCardFrame>
          </aside>

          <div className="min-w-0 space-y-6">
            <DocCard id="api-key" icon={KeyRound} title="Get API key">
              <p className="text-sm leading-6 text-slate-600">
                Create an account, open API Keys, and generate a key. Send it as a bearer token on every request to the API base URL.
              </p>
              <CodeBlock title="Environment" language="bash" code={envSnippet} />
            </DocCard>

            <DocCard id="base-url" icon={Server} title="Base URL">
              <p className="text-sm leading-6 text-slate-600">
                Use the API base URL shown here for OpenAI-compatible requests. It must include the API path, such as /v1.
              </p>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
                <code className="font-mono">{INVALID_WEBSITE_API_BASE_URL}</code> alone is invalid for API calls. Clients must use <code className="font-mono">{baseUrl}</code>.
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <CopyRow label="API key" value="sk-your-api-key" />
                <CopyRow label="Base URL" value={baseUrl} />
                <CopyRow label="Chat endpoint" value={`${baseUrl}/chat/completions`} />
              </div>
              <CodeBlock
                title="Endpoint"
                language="bash"
                code={`POST ${baseUrl}/chat/completions
Authorization: Bearer $SUBROUTER_API_KEY
Content-Type: application/json`}
              />
            </DocCard>

            <DocCard id="selection" icon={Layers3} title="Model selection">
              <p className="text-sm leading-6 text-slate-600">
                Pick model ids from the public catalog, then match the request shape to the model category. Public listings are deduped by model family, so users choose a stable model id.
              </p>
              <div className="grid gap-3 md:grid-cols-3">
                <CopyRow label="Chat example" value={chatModelId} />
                <CopyRow label="Vision example" value={visionModelId} />
                <CopyRow label="Catalog size" value={`${models.length || 0} listed`} />
              </div>
            </DocCard>

            <DocCard id="chat" icon={TerminalSquare} title="Requests: chat completions">
              <p className="text-sm leading-6 text-slate-600">
                Chat uses the OpenAI-compatible chat completions shape. Replace the model id with any compatible model from the public catalog.
              </p>
              <div className="grid gap-5">
                <CodeBlock title="cURL" language="bash" code={buildCurlSnippet({ baseUrl, modelId: chatModelId })} />
                <CodeBlock title="JavaScript fetch" language="js" code={buildJsSnippet({ baseUrl, modelId: chatModelId })} />
                <CodeBlock title="OpenAI JavaScript SDK" language="js" code={openAiSdkJs} />
                <CodeBlock title="Python OpenAI SDK" language="python" code={buildPythonSnippet({ baseUrl, modelId: chatModelId })} />
              </div>
            </DocCard>

            <DocCard id="streaming" icon={RefreshCw} title="Streaming responses">
              <p className="text-sm leading-6 text-slate-600">
                Enable streaming for chat completions when your client can consume incremental deltas. The base URL, bearer token, and model id stay the same.
              </p>
              <CodeBlock title="OpenAI JavaScript SDK streaming" language="js" code={streamingJs} />
            </DocCard>

            <DocCard id="multimodal" icon={Layers3} title="Multimodal request patterns">
              <p className="text-sm leading-6 text-slate-600">
                For vision-capable chat models, send message content as an array of typed parts. Keep the same /chat/completions endpoint and choose a model whose catalog entry supports the needed modality.
              </p>
              <CodeBlock title="Vision request" language="bash" code={jsonCurl(`${baseUrl}/chat/completions`, multimodalBody)} />
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                Text-only models should continue to send a string <code className="font-mono text-slate-900">content</code>. Use typed content parts only for models that support image or other multimodal inputs.
              </div>
            </DocCard>

            <DocCard id="models" icon={Layers3} title="Model IDs and catalog">
              <p className="text-sm leading-6 text-slate-600">
                Model IDs are copied from the public catalog and used exactly in API requests. Duplicate catalog entries are shown as one public model family.
              </p>
              <div className="grid gap-3 md:grid-cols-3">
                <LinkCard to="/models" title="Models" text="Filter by chat, image, audio, video, embedding, and rerank." />
                <LinkCard to="/rankings" title="Rankings" text="Review public model rank, category, usage, and official price." />
                <LinkCard to="/playground" title="Playground" text="Build request payloads and copy code samples." />
              </div>
              <CodeBlock
                title="Public catalog page"
                language="text"
                code="/models"
              />
            </DocCard>

            <DocCard id="pricing" icon={CreditCard} title="Pricing and cache pricing">
              <p className="text-sm leading-6 text-slate-600">
                Model cards show official USD input and output values from the public pricing feed. Per-call models show a call price when one is returned.
              </p>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                Always check the selected model details before production rollout because catalog pricing can change.
              </div>
            </DocCard>

            <DocCard id="errors" icon={ShieldAlert} title="Errors and troubleshooting">
              <div className="grid gap-3 md:grid-cols-2">
                <Trouble title="401 Unauthorized" text="Check that Authorization is Bearer sk-your-api-key and the key belongs to this site." />
                <Trouble title="404 model not found" text="Copy the model id from /models or /rankings and send it exactly as listed." />
                <Trouble title="429 rate limited" text="Reduce concurrency or check account limits and package quota." />
                <Trouble title="402 or quota errors" text="Top up, subscribe, or use a model with lower per-token cost." />
                <Trouble title="Unsupported modality" text="Switch to a model whose category includes image, video, or audio." />
                <Trouble title="Temporary failure" text="Retry with backoff, choose another public model, or inspect logs in your dashboard." />
              </div>
            </DocCard>

            <DocCard id="migration" icon={RefreshCw} title="Migrating from OpenAI or OpenRouter">
              <p className="text-sm leading-6 text-slate-600">
                Keep the OpenAI SDK shape for chat. Change the base URL to the API base URL shown here, replace the API key, and use a public catalog model id. Optional headers from other gateways are not required unless your own app depends on them.
              </p>
              <CodeBlock
                title="Before and after"
                language="bash"
                code={`# OpenAI or OpenRouter client
baseURL=https://api.openai.com/v1

# SubRouter client
baseURL=${baseUrl}
apiKey=$SUBROUTER_API_KEY
model=${chatModelId}`}
              />
            </DocCard>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-800">
              <AlertCircle size={17} className="mr-2 inline-block align-[-3px]" />
              Browser pages in this frontend compose requests but do not run generation without an API key. Use the playground to prepare payloads, then run them from your server, terminal, or trusted client.
            </div>
          </div>
        </div>
      </CossSection>
    </CossPage>
  );
}

function CopyRow({ label, value }) {
  return (
    <CossMutedCard className="p-3">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <div className="mt-2 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate font-mono text-xs text-slate-800">{value}</code>
        <CopyButton text={String(value)} iconOnly className="h-8 w-8 px-0 py-0" />
      </div>
    </CossMutedCard>
  );
}

function DocCard({ id, icon: Icon, title, children }) {
  return (
    <CossCardFrame as="section" id={id} className="min-w-0 scroll-mt-8 overflow-hidden p-4 sm:p-6">
      <div className="mb-4 flex min-w-0 items-center gap-2">
        <CossIconTile icon={Icon} />
        <h2 className="min-w-0 break-words text-lg font-semibold text-slate-950 sm:text-xl">{title}</h2>
      </div>
      <div className="min-w-0 space-y-5">{children}</div>
    </CossCardFrame>
  );
}

function LinkCard({ to, title, text }) {
  return (
    <Link to={to} className="block min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-4 hover:bg-white">
      <p className="break-words font-semibold text-slate-950">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
    </Link>
  );
}

function Trouble({ title, text }) {
  return (
    <CossCard className="min-w-0 bg-slate-50 p-4">
      <p className="break-words font-semibold text-slate-950">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
    </CossCard>
  );
}

function pickDocsModels(models) {
  const byMode = { chat: null, image: null, video: null, audio: null };
  for (const model of models) {
    const modes = getSupportedModes(model);
    if (!byMode.chat && (modes.includes('chat') || ['Chat', 'Reasoning', 'Coding'].includes(getModelCategory(model)))) byMode.chat = model;
    if (!byMode.image && modes.includes('image')) byMode.image = model;
    if (!byMode.video && modes.includes('video')) byMode.video = model;
    if (!byMode.audio && modes.includes('audio')) byMode.audio = model;
  }
  return byMode;
}

function jsonCurl(endpoint, body) {
  return `curl -X POST ${endpoint} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $SUBROUTER_API_KEY" \\
  -d '${JSON.stringify(body, null, 2).replace(/'/g, "'\"'\"'")}'`;
}
