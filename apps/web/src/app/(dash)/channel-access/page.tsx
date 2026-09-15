import { ChannelAccessPanel } from '@/components/channel-access-panel';

export default function ChannelAccessPage() {
  return (
    <div className="max-w-3xl mx-auto px-5 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900">Channels &amp; Connections</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Connect your YouTube channel and social platforms, or watch public accounts without signing in.
        </p>
      </div>
      <ChannelAccessPanel />
    </div>
  );
}
