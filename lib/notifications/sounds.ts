import { createAudioPlayer, setAudioModeAsync, type AudioSource } from 'expo-audio';

/**
 * Sounds the operating system plays for notifications.
 *
 * These are **filenames only**, and each must also be listed in the
 * `expo-notifications` plugin config in app.json and compiled in by a build.
 * A name here that is not in app.json will not fall back — it will just be
 * silent — so `undefined` means "use the system default", which is the safe
 * state until real files are added.
 *
 * See assets/sounds/README.md.
 */
export const SOUNDS: {
  mention: string | undefined;
  directMessage: string | undefined;
  social: string | undefined;
  update: string | undefined;
} = {
  mention: 'new_mention.wav',
  directMessage: 'new_dm.wav',
  // The general-purpose one covers boosts, likes, follows, polls and edits.
  social: 'new_notification.wav',
  update: 'new_notification.wav',
};

/**
 * Sounds Thrive plays itself, while you are looking at it.
 *
 * Unlike notification sounds these are ordinary bundled assets, so they can be
 * any format `expo-audio` handles and do not need the config plugin. Add the
 * file to assets/sounds and `require` it here.
 */
export const IN_APP_SOUNDS: Record<string, AudioSource | undefined> = {
  // e.g. sent: require('../../assets/sounds/sent.wav'),
  sent: undefined,
  liked: undefined,
  error: undefined,
};

export type InAppSound = keyof typeof IN_APP_SOUNDS;

let audioModeReady = false;

/**
 * Play a short interface sound.
 *
 * Deliberately forgiving: an unregistered or missing sound is a no-op rather
 * than an error, so the app stays usable before any sound files are added, and
 * a failed sound never interrupts the action that triggered it.
 */
export async function playInAppSound(name: InAppSound): Promise<void> {
  const source = IN_APP_SOUNDS[name];
  if (!source) return;

  try {
    if (!audioModeReady) {
      // Mixes with other audio and respects the silent switch, so Thrive does
      // not duck someone's music to play a click.
      await setAudioModeAsync({
        playsInSilentMode: false,
        shouldPlayInBackground: false,
        interruptionMode: 'mixWithOthers',
      });
      audioModeReady = true;
    }

    const player = createAudioPlayer(source);
    player.play();

    // Release once it has had time to finish; these are all short.
    setTimeout(() => {
      try {
        player.remove();
      } catch {
        // Already released.
      }
    }, 5000);
  } catch (error) {
    console.warn('[Notifications] Could not play in-app sound:', error);
  }
}
