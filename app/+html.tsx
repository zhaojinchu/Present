import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

// Web-only HTML shell around every route. Runs in Node at export time, so no browser APIs here.
// This is what makes the hosted build behave like an app: full-screen standalone mode when
// added to the home screen, no browser chrome, the app's dark colour behind the status bar,
// no rubber-band overscroll, and a phone-sized column on desktop instead of a stretched page.
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover, shrink-to-fit=no"
        />
        <title>Present</title>
        <meta name="application-name" content="Present" />
        <meta name="description" content="Strava for showing up to class." />
        <meta name="theme-color" content="#FFFFFF" />
        <meta name="color-scheme" content="light" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Present" />
        <meta name="format-detection" content="telephone=no" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="icon" href="/favicon.ico" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: css }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const css = `
html, body, #root { height: 100%; }
html { background: #FFFFFF; }
body {
  margin: 0;
  background: #FFFFFF;
  color: #0A0A0B;
  overflow: hidden;
  overscroll-behavior: none;
  -webkit-tap-highlight-color: transparent;
  -webkit-touch-callout: none;
  -webkit-text-size-adjust: 100%;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}
#root { display: flex; flex-direction: column; overflow: hidden; }
/* Desktop and tablets: a phone-width column on black, so it reads as an app rather than a web page. */
@media (min-width: 600px) and (min-height: 600px) {
  body { background: #E9E9ED; }
  #root { max-width: 430px; margin: 0 auto; box-shadow: 0 0 0 1px #E4E4E8; }
}
`;
