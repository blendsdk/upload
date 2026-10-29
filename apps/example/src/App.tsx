import { useMemo, useState } from 'react';
import { FluentProvider, Text, webLightTheme } from '@fluentui/react-components';
import { FileUpload } from '@blendsdk/fluentui-upload';
import { createUploadManager } from '@blendsdk/upload-client';
import type { UploadItemState } from '@blendsdk/upload-core';
import { createDemoClient, demoPolicy, DemoTransport } from './demo.js';

export function App() {
  const [ready, setReady] = useState<UploadItemState[]>([]);
  const client = useMemo(() => createDemoClient(), []);
  const manager = useMemo(
    () =>
      createUploadManager({
        client,
        purpose: demoPolicy.purpose,
        policy: demoPolicy,
        transport: new DemoTransport(),
        concurrency: 2,
        autoStart: true,
      }),
    [client],
  );

  return (
    <FluentProvider theme={webLightTheme}>
      <main className="page">
        <Text as="h1" size={800} weight="semibold">
          BlendSDK Upload
        </Text>
        <Text size={300}>
          This demo uses a deterministic local transport so it runs without a server. The real
          transport is tus.
        </Text>
        <FileUpload
          manager={manager}
          client={client}
          purpose={demoPolicy.purpose}
          accept={['image/jpeg', 'image/png', 'image/webp']}
          onUploaded={setReady}
        />
        <Text size={200}>{ready.length} file(s) ready to commit.</Text>
      </main>
    </FluentProvider>
  );
}
