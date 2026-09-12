// /friends/share — a QR code and a link that adds you.
import { QRCodeSVG } from 'qrcode.react';
import { IoCopyOutline, IoScanOutline, IoShareOutline } from 'react-icons/io5';
import { useNavigate } from 'react-router';
import { Header, Main, Screen } from '@/app/AppShell';
import { useMe } from '@/lib/appState';
import { shareUrlFor } from '@/lib/config';
import { Button, Mark, Txt, useToast } from '@/ui';
import { BackButton } from './_Stub';

export default function FriendsShare() {
  const me = useMe();
  const toast = useToast();
  const navigate = useNavigate();
  const url = me ? shareUrlFor(me.username) : '';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast('Link copied');
    } catch {
      toast(url);
    }
  };
  const share = async () => {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'Add me on Present', text: `Add me on Present: ${url}`, url });
        return;
      } catch {
        // cancelled or unsupported: fall through to copy
      }
    }
    await copy();
  };

  return (
    <Screen>
      <Header title="Share" left={<BackButton />} />
      <Main>
        <div className="flex flex-col items-center text-center mt-6">
          <div className="bg-bg p-4 rounded-lg ring-1 ring-border">{url ? <QRCodeSVG value={url} size={220} level="M" includeMargin={false} imageSettings={{ src: '', height: 0, width: 0, excavate: false }} /> : null}</div>
          <div className="flex items-center gap-2 mt-5">
            <Mark size={24} />
            <Txt variant="headline">@{me?.username}</Txt>
          </div>
          <Txt variant="footnote" tone="secondary" className="mt-1 selectable break-all max-w-[300px]">
            {url}
          </Txt>
          <Txt variant="subhead" tone="secondary" className="mt-4 max-w-[300px]">
            Anyone who opens this sends you a friend request.
          </Txt>
        </div>
        <div className="flex flex-col gap-2 mt-8">
          <Button title="Share link" size="lg" icon={IoShareOutline} onClick={share} />
          <Button title="Copy link" variant="secondary" size="lg" icon={IoCopyOutline} onClick={copy} />
          <Button title="Scan a friend's code" variant="tertiary" size="lg" icon={IoScanOutline} onClick={() => navigate('/friends/scan')} />
        </div>
      </Main>
    </Screen>
  );
}
