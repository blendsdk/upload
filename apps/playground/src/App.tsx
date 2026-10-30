import { useMemo, useState } from 'react';
import {
  Button,
  Divider,
  FluentProvider,
  MessageBar,
  MessageBarBody,
  Text,
  webLightTheme,
} from '@fluentui/react-components';
import { FileUpload } from '@blendsdk/fluentui-upload';
import { createUploadClient, createUploadManager } from '@blendsdk/upload-client';
import { DOCUMENT_ACCEPT, IMAGE_ACCEPT, type UploadItemState } from '@blendsdk/upload-core';

const IMAGE_PURPOSE = 'playground.image';
const DOCUMENT_PURPOSE = 'playground.document';

function FileLinks({ items }: { items: UploadItemState[] }) {
  const files = items.flatMap((item) => item.result?.files ?? []);
  if (files.length === 0) {
    return null;
  }
  return (
    <ul className="file-links">
      {files.map((file) => (
        <li key={file.id}>
          <a href={`/api/uploads/files/${file.id}`} target="_blank" rel="noreferrer">
            {file.name} · {file.role}
          </a>
        </li>
      ))}
    </ul>
  );
}

export function App() {
  const client = useMemo(() => createUploadClient({ baseUrl: '/api/uploads' }), []);
  const imageManager = useMemo(
    () =>
      createUploadManager({
        client,
        purpose: IMAGE_PURPOSE,
        concurrency: 2,
        autoStart: true,
      }),
    [client],
  );
  const documentManager = useMemo(
    () =>
      createUploadManager({
        client,
        purpose: DOCUMENT_PURPOSE,
        concurrency: 2,
        autoStart: true,
      }),
    [client],
  );
  const [imageReady, setImageReady] = useState<UploadItemState[]>([]);
  const [documentReady, setDocumentReady] = useState<UploadItemState[]>([]);
  const [imagesCommitted, setImagesCommitted] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();

  const commitImages = async (): Promise<void> => {
    setCommitting(true);
    setError(undefined);
    try {
      const sessions = await imageManager.commit();
      setImagesCommitted(true);
      setNotice(`Committed ${sessions.length} image session(s).`);
    } catch (commitError) {
      setError(commitError instanceof Error ? commitError.message : 'Commit failed.');
    } finally {
      setCommitting(false);
    }
  };

  return (
    <FluentProvider theme={webLightTheme}>
      <main className="page">
        <header className="header">
          <Text as="h1" size={900} weight="semibold">
            BlendSDK Upload Playground
          </Text>
          <Text size={300}>
            Real WebAFX server, real tus transport and real finalization. The browser talks to
            <code> /api/uploads</code> through the Vite proxy.
          </Text>
        </header>

        {error && (
          <MessageBar intent="error">
            <MessageBarBody>{error}</MessageBarBody>
          </MessageBar>
        )}
        {notice && (
          <MessageBar intent="success">
            <MessageBarBody>{notice}</MessageBarBody>
          </MessageBar>
        )}

        <div className="grid">
          <section className="panel">
            <div className="panel-heading">
              <div>
                <Text as="h2" size={600} weight="semibold">
                  Images
                </Text>
                <Text size={200} block>
                  Deferred commit: uploads become staged and stay unattached until you commit them.
                </Text>
              </div>
              <Button
                appearance="primary"
                disabled={imageReady.length === 0 || imagesCommitted || committing}
                onClick={() => void commitImages()}
              >
                {committing ? 'Committing…' : 'Commit images'}
              </Button>
            </div>
            <FileUpload
              manager={imageManager}
              client={client}
              purpose={IMAGE_PURPOSE}
              accept={[...IMAGE_ACCEPT]}
              onUploaded={(items) => {
                setImageReady(items);
                setImagesCommitted(false);
                setNotice(undefined);
              }}
              onError={(uploadError) => setError(uploadError.message)}
            />
            <FileLinks items={imageReady} />
            <Divider />
            <Text size={200}>
              {imageReady.length} image(s) ready{imagesCommitted ? ' · committed' : ''}.
            </Text>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <Text as="h2" size={600} weight="semibold">
                  Documents
                </Text>
                <Text size={200} block>
                  Immediate commit: the server finalizes and stores the file during upload.
                </Text>
              </div>
            </div>
            <FileUpload
              manager={documentManager}
              client={client}
              purpose={DOCUMENT_PURPOSE}
              accept={[...DOCUMENT_ACCEPT]}
              onUploaded={(items) => {
                setDocumentReady(items);
                setNotice(undefined);
              }}
              onError={(uploadError) => setError(uploadError.message)}
            />
            <FileLinks items={documentReady} />
            <Divider />
            <Text size={200}>{documentReady.length} document(s) ready.</Text>
          </section>
        </div>

        <footer className="footer">
          <Text size={200}>
            Start with <code>pnpm playground</code>. Local filesystem storage is the default; set
            <code> PLAYGROUND_S3=1</code> with S3Mock running to exercise the S3 adapter.
          </Text>
        </footer>
      </main>
    </FluentProvider>
  );
}
