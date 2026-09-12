import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '@/components/ui';
import { colors, fonts } from '@/lib/theme';
import { igTime } from '@/lib/time';
import type { Reaction } from '@/lib/types';
import { ReactionRow } from './ReactionRow';

export function IgPost({
  name,
  avatarUri,
  location,
  createdAt,
  nowMs,
  caption,
  liked,
  likedBy,
  eventId,
  reactions,
  me,
  onLike,
  extra,
  children,
}: {
  name: string;
  avatarUri?: string | null;
  location?: string | null;
  createdAt: string;
  nowMs: number;
  caption: React.ReactNode;
  liked: boolean;
  likedBy: string | null;
  eventId: string;
  reactions: Reaction[];
  me: string;
  onLike: () => void;
  extra?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const [picker, setPicker] = useState(false);
  const [captionOpen, setCaptionOpen] = useState(false);

  const onShare = () => {
    const text = typeof caption === 'string' ? caption : `${name} on Present`;
    Share.share({ message: `${name}${location ? ` · ${location}` : ''}\n${text}` }).catch(() => {});
  };

  return (
    <View style={styles.post}>
      <View style={styles.header}>
        <Avatar name={name} uri={avatarUri} size={32} />
        <View style={styles.headerText}>
          <Text style={styles.username} numberOfLines={1}>
            {name}
          </Text>
          {location ? (
            <Text style={styles.location} numberOfLines={1}>
              {location}
            </Text>
          ) : null}
        </View>
        <Ionicons name="ellipsis-horizontal" size={20} color={colors.text} />
      </View>

      {children}

      <View style={styles.actions}>
        <View style={styles.actionsLeft}>
          <Pressable onPress={onLike} hitSlop={8} style={({ pressed }) => pressed && { opacity: 0.55 }}>
            <Ionicons name={liked ? 'heart' : 'heart-outline'} size={26} color={liked ? colors.like : colors.text} />
          </Pressable>
          <Pressable onPress={() => setPicker((v) => !v)} hitSlop={8} style={({ pressed }) => pressed && { opacity: 0.55 }}>
            <Ionicons name="chatbubble-outline" size={24} color={colors.text} />
          </Pressable>
          <Pressable onPress={onShare} hitSlop={8} style={({ pressed }) => pressed && { opacity: 0.55 }}>
            <Ionicons name="paper-plane-outline" size={24} color={colors.text} />
          </Pressable>
        </View>
        <Ionicons name="bookmark-outline" size={24} color={colors.text} />
      </View>

      {likedBy ? <Text style={styles.likes}>{likedBy}</Text> : null}

      <Pressable onPress={() => setCaptionOpen(true)} disabled={captionOpen}>
        <Text style={styles.caption} numberOfLines={captionOpen ? undefined : 2}>
          <Text style={styles.username}>{name} </Text>
          {caption}
        </Text>
      </Pressable>

      {picker ? <ReactionRow eventId={eventId} reactions={reactions} me={me} startExpanded /> : null}

      <Text style={styles.time}>{igTime(createdAt, nowMs)}</Text>
      {extra}
    </View>
  );
}

export function likedByLine(others: string[], meLiked: boolean): string | null {
  if (meLiked && others.length === 0) return 'Liked by you';
  if (meLiked && others.length === 1) return `Liked by you and ${others[0]}`;
  if (meLiked && others.length > 1) return `Liked by you and ${others.length} others`;
  if (others.length === 1) return `Liked by ${others[0]}`;
  if (others.length === 2) return `Liked by ${others[0]} and ${others[1]}`;
  if (others.length > 2) return `Liked by ${others[0]} and ${others.length - 1} others`;
  return null;
}

const styles = StyleSheet.create({
  post: { backgroundColor: colors.bg, paddingBottom: 10 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  headerText: { flex: 1, minWidth: 0 },
  username: { color: colors.text, fontSize: 13, fontFamily: fonts.bold },
  location: { color: colors.text, fontSize: 12, fontFamily: fonts.regular, marginTop: 1 },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
  },
  actionsLeft: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  likes: {
    color: colors.text,
    fontSize: 14,
    fontFamily: fonts.bold,
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  caption: {
    color: colors.text,
    fontSize: 14,
    fontFamily: fonts.regular,
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  time: {
    color: colors.igMuted,
    fontSize: 10,
    fontFamily: fonts.regular,
    paddingHorizontal: 12,
    marginTop: 6,
  },
});
