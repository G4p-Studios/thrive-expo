
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  useColorScheme,
} from 'react-native';
import {
  useAudioRecorder,
  useAudioRecorderState,
  useAudioPlayer,
  useAudioPlayerStatus,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';

interface AudioRecorderProps {
  visible: boolean;
  onClose: () => void;
  onRecordingComplete: (uri: string) => void;
}

export default function AudioRecorder({ visible, onClose, onRecordingComplete }: AudioRecorderProps) {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? colors.dark : colors.light;

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const player = useAudioPlayer(null);
  const playerStatus = useAudioPlayerStatus(player);

  const [recordedUri, setRecordedUri] = useState<string | null>(null);

  const isRecording = recorderState.isRecording;
  const isPlaying = playerStatus.playing;
  const displayElapsed = isRecording || recordedUri
    ? Math.floor(recorderState.durationMillis / 1000)
    : 0;

  useEffect(() => {
    if (!visible) {
      cleanup();
    }
  }, [visible]);

  const cleanup = useCallback(() => {
    if (recorder.isRecording) {
      recorder.stop().catch(() => {});
    }
    player.pause();
    setRecordedUri(null);
  }, [recorder, player]);

  const startRecording = async () => {
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) return;

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  const stopRecording = async () => {
    try {
      await recorder.stop();
      const uri = recorder.uri;

      if (uri) {
        setRecordedUri(uri);
        await setAudioModeAsync({
          allowsRecording: false,
        });
        player.replace(uri);
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
    }
  };

  const togglePreview = async () => {
    if (!recordedUri) return;

    if (isPlaying) {
      player.pause();
    } else {
      await player.seekTo(0);
      player.play();
    }
  };

  const handleConfirm = () => {
    if (recordedUri) {
      onRecordingComplete(recordedUri);
      cleanup();
    }
  };

  const handleClose = () => {
    cleanup();
    onClose();
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: theme.card }]}>
          <Text style={[styles.title, { color: theme.text }]}>Record Audio</Text>

          <Text style={[styles.timer, { color: theme.text }]}>
            {formatTime(displayElapsed)}
          </Text>

          {!recordedUri ? (
            <TouchableOpacity
              onPress={isRecording ? stopRecording : startRecording}
              style={[styles.recordButton, isRecording && styles.recordButtonActive]}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={isRecording ? 'Stop recording' : 'Start recording'}
            >
              <IconSymbol
                ios_icon_name={isRecording ? 'stop.fill' : 'mic.fill'}
                android_material_icon_name={isRecording ? 'stop' : 'mic'}
                size={32}
                color="#FFFFFF"
              />
            </TouchableOpacity>
          ) : (
            <View style={styles.previewControls}>
              <TouchableOpacity
                onPress={togglePreview}
                style={[styles.previewButton, { backgroundColor: theme.primary }]}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={isPlaying ? 'Pause preview' : 'Play preview'}
              >
                <IconSymbol
                  ios_icon_name={isPlaying ? 'pause.fill' : 'play.fill'}
                  android_material_icon_name={isPlaying ? 'pause' : 'play-arrow'}
                  size={28}
                  color="#FFFFFF"
                />
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.actions}>
            <TouchableOpacity
              onPress={handleClose}
              style={[styles.actionButton, { borderColor: theme.border }]}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={[styles.actionText, { color: theme.text }]}>Cancel</Text>
            </TouchableOpacity>
            {recordedUri && (
              <TouchableOpacity
                onPress={handleConfirm}
                style={[styles.actionButton, styles.confirmButton, { backgroundColor: theme.primary }]}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Use recording"
              >
                <Text style={[styles.actionText, { color: '#FFFFFF' }]}>Use Recording</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '85%',
    maxWidth: 360,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 20,
  },
  timer: {
    fontSize: 48,
    fontWeight: '300',
    fontVariant: ['tabular-nums'],
    marginBottom: 24,
  },
  recordButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#ff3b30',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  recordButtonActive: {
    backgroundColor: '#ff6b60',
  },
  previewControls: {
    marginBottom: 24,
  },
  previewButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  confirmButton: {
    borderWidth: 0,
  },
  actionText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
