
import React, { useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useColorScheme } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { colors } from '@/styles/commonStyles';
import { MastodonMediaAttachment } from '@/types/mastodon';
import { IconSymbol } from '@/components/IconSymbol';

interface MediaPlayerProps {
  attachment: MastodonMediaAttachment;
}

export default function MediaPlayer({ attachment }: MediaPlayerProps) {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? colors.dark : colors.light;

  if (attachment.type === 'video' || attachment.type === 'gifv') {
    return <VideoPlayer attachment={attachment} theme={theme} />;
  }

  if (attachment.type === 'audio') {
    return <AudioPlayer attachment={attachment} theme={theme} />;
  }

  return null;
}

function VideoPlayer({ attachment, theme }: { attachment: MastodonMediaAttachment; theme: any }) {
  const player = useVideoPlayer(attachment.url, (player) => {
    player.loop = attachment.type === 'gifv';
  });

  return (
    <VideoView
      player={player}
      style={styles.video}
      contentFit="contain"
      nativeControls
    />
  );
}

function AudioPlayer({ attachment, theme }: { attachment: MastodonMediaAttachment; theme: any }) {
  const player = useAudioPlayer(attachment.url);
  const status = useAudioPlayerStatus(player);

  const isPlaying = status.playing;
  const currentTime = status.currentTime;
  const duration = status.duration;

  const togglePlayback = useCallback(() => {
    if (isPlaying) {
      player.pause();
    } else {
      player.play();
    }
  }, [isPlaying, player]);

  const formatTime = (seconds: number) => {
    const totalSeconds = Math.floor(seconds);
    const minutes = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? currentTime / duration : 0;

  return (
    <View style={[styles.audioContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <TouchableOpacity
        onPress={togglePlayback}
        style={[styles.playButton, { backgroundColor: theme.primary }]}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? 'Pause audio' : 'Play audio'}
      >
        <IconSymbol
          ios_icon_name={isPlaying ? 'pause.fill' : 'play.fill'}
          android_material_icon_name={isPlaying ? 'pause' : 'play-arrow'}
          size={24}
          color="#FFFFFF"
        />
      </TouchableOpacity>
      <View style={styles.audioInfo}>
        <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
          <View style={[styles.progressFill, { backgroundColor: theme.primary, width: `${progress * 100}%` }]} />
        </View>
        <Text style={[styles.timeText, { color: theme.textSecondary }]}>
          {formatTime(currentTime)} / {formatTime(duration)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  video: {
    width: '100%',
    height: 200,
    borderRadius: 8,
  },
  audioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    width: '100%',
    gap: 12,
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  audioInfo: {
    flex: 1,
    gap: 4,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  timeText: {
    fontSize: 12,
  },
});
