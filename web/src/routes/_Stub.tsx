// Shared scaffolding for screens that are not built yet: a header with a back button, the screen's
// name, and a readout of the data its hook will provide. Replaced screen by screen in stages 2 to 5.
import type { ReactNode } from 'react';
import { IoChevronBack } from 'react-icons/io5';
import { useNavigate } from 'react-router';
import { Header, Main, Screen } from '@/app/AppShell';
import { Badge, IconButton, Txt } from '@/ui';

export function BackButton() {
  const navigate = useNavigate();
  return <IconButton icon={IoChevronBack} label="Back" tone="plain" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))} />;
}

export function Stub({ title, hook, children, tabs }: { title: string; hook?: string; children?: ReactNode; tabs?: boolean }) {
  return (
    <Screen tabs={tabs}>
      <Header title={title} left={tabs ? undefined : <BackButton />} />
      <Main>
        <div className="flex items-center gap-2 mt-2">
          <Badge label="Not built yet" tone="warning" />
          {hook ? (
            <Txt variant="footnote" tone="tertiary">
              hook: {hook}
            </Txt>
          ) : null}
        </div>
        <div className="mt-4 flex flex-col gap-3">{children}</div>
      </Main>
    </Screen>
  );
}

/** Small monospace readout for fixture data. */
export function Readout({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="bg-surface rounded-md p-3 selectable">
      <Txt variant="label" tone="tertiary" className="mb-1">
        {label}
      </Txt>
      <pre className="text-footnote text-text-secondary whitespace-pre-wrap break-words font-mono">{JSON.stringify(value, null, 1)}</pre>
    </div>
  );
}
