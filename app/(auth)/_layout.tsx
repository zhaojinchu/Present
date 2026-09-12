import { Redirect, Stack } from 'expo-router';
import React from 'react';
import { useSession } from '@/lib/session';
import { colors } from '@/lib/theme';

export default function AuthLayout() {
  const { session, loading } = useSession();
  if (!loading && session) return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />;
}
