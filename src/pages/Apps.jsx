import React from 'react';
import { Link } from 'react-router-dom';
import { Braces, Code2, Download, PlugZap, TerminalSquare } from 'lucide-react';
import CodeBlock from '../components/CodeBlock';
import {
  CossCardFrame,
  CossIconTile,
  CossPage,
  CossPageHeader,
  CossSection,
} from '../components/public/CossLayout';
import { INVALID_WEBSITE_API_BASE_URL, PUBLIC_API_BASE_URL } from '../constants/api';
import { usePublicApiBaseUrl } from '../context/SiteContext';

const apps = [
  {
    title: 'OpenAI SDKs',
    desc: 'Use the official JavaScript and Python SDKs with a custom base URL.',
    icon: Code2,
    action: '/docs/quickstart',
  },
  {
    title: 'Cursor and IDE tools',
    desc: 'Configure the OpenAI-compatible API key, base URL, and model id in supported editor clients.',
    icon: TerminalSquare,
    action: '/tokens',
  },
  {
    title: 'OpenAI-compatible apps',
    desc: 'Any client that lets you set base URL and model id can target the same API surface.',
    icon: PlugZap,
    action: '/models',
  },
  {
    title: 'Config exports',
    desc: 'Signed-in users can generate ready-to-import client snippets from the API Keys page.',
    icon: Download,
    action: '/tokens',
  },
];

export default function Apps() {
  const baseUrl = usePublicApiBaseUrl() || PUBLIC_API_BASE_URL;
  const config = `API Key: sk-your-api-key
Base URL: ${baseUrl}
Model: choose from /models`;

  return (
    <CossPage>
      <CossPageHeader
        eyebrow="Integrations"
        icon={PlugZap}
        title="Apps and SDKs"
        description="Connect SDKs and clients that support OpenAI-compatible chat completions. Use your API key, the platform base URL, and any listed model id."
      />

      <CossSection className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="grid gap-5 md:grid-cols-2">
          {apps.map(({ title, desc, icon: Icon, action }) => (
            <Link key={title} to={action} className="coss-card-frame group p-5 transition hover:border-slate-300 hover:bg-slate-50/60">
              <CossIconTile icon={Icon} className="group-hover:border-slate-300" />
              <h2 className="mt-4 text-lg font-semibold text-slate-950">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{desc}</p>
            </Link>
          ))}
        </div>

        <aside className="space-y-5">
          <CossCardFrame className="p-5">
            <div className="flex items-center gap-2">
              <CossIconTile icon={Braces} />
              <h2 className="font-semibold text-slate-950">Universal settings</h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              These values work for clients that expose OpenAI-compatible configuration fields. Use the API base URL; {INVALID_WEBSITE_API_BASE_URL} alone is invalid for API calls.
            </p>
          </CossCardFrame>
          <CodeBlock title="Client values" language="text" code={config} />
          <CossCardFrame className="p-5">
            <h2 className="font-semibold text-slate-950">Next steps</h2>
            <div className="mt-4 flex flex-col gap-2">
              <Link to="/tokens" className="coss-button-primary">
                Create API key
              </Link>
              <Link to="/docs/quickstart" className="coss-button-secondary">
                Read quickstart
              </Link>
            </div>
          </CossCardFrame>
        </aside>
      </CossSection>
    </CossPage>
  );
}
