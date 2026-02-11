
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useColorScheme } from 'react-native';
import { Video, ResizeMode, Audio, AVPlaybackStatus } from 'expo-av';
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
  const videoRef = useRef<Video>(null);

  return (
    <Video
      ref={videoRef}
      source={{ uri: attachment.url }}
      posterSource={attachment.previewUrl ? { uri: attachment.previewUrl } : undefined}
      usePoster={!!attachment.previewUrl}
      resizeMode={ResizeMode.CONTAIN}
      useNativeControls
      isLooping={attachment.type === 'gifv'}
      shouldPlay={false}
      style={styles.video}
    />
  );
}

function AudioPlayer({ attachment, theme }: { attachment: MastodonMediaAttachment; theme: any }) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  const onPlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;
    setIsPlaying(status.isPlaying);
    setPosition(status.positionMillis);
    setDuration(status.durationMillis || 0);
    if (status.didJustFinish) {
      setIsPlaying(false);
    }
  }, []);

  const togglePlayback = useCallback(async () => {
    if (!soundRef.current) {
      const { sound } = await Audio.Sound.createAsync(
        { uri: attachment.url },
        { shouldPlay: true },
        onPlaybackStatusUpdate
      );
      soundRef.current = sound;
      setIsPlaying(true);
      return;
    }

    if (isPlaying) {
      await soundRef.current.pauseAsync();
    } else {
      await soundRef.current.playAsync();
    }
  }, [isPlaying, attachment.url, onPlaybackStatusUpdate]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? position / duration : 0;

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
          {formatTime(position)} / {formatTime(duration)}
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
