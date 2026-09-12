import Head from 'expo-router/head';

// Web build only. The router resets document.title at runtime, so the <title> in app/+html.tsx
// alone leaves the browser tab blank; this keeps it "Present" on every route.
export function WebHead() {
  return (
    <Head>
      <title>Present</title>
      <meta name="description" content="Strava for showing up to class." />
    </Head>
  );
}
