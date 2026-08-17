import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

/**
 * Sounds the operating system plays for notifications.
 *
 * These are **filenames only**, and each must also be listed in the
 * `expo-notifications` plugin config in app.json and compiled in by a build.
 * A name here that is not in app.json will not fall back — it will just be
 * silent.
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
 * Sounds Thrive plays itself, while you are using it.
 *
 * Unlike notification sounds these are ordinary bundled assets, so they do not
 * need the config plugin — but a *new file* still needs a build, since it is
 * bundled with the JavaScript.
 */
export const IN_APP_SOUNDS = {
  /** A post that was not there before arrives in the timeline. */
  newPost: require('../../assets/sounds/new_toot.wav'),
  /** Your own post went out. */
  sendPost: require('../../assets/sounds/send_toot.wav'),
  /** Your own reply went out. */
  sendReply: require('../../assets/sounds/send_reply.wav'),
  /** You boosted something. */
  boost: require('../../assets/sounds/send_boost.wav'),
  favourite: require('../../assets/sounds/favorite.wav'),
  unfavourite: require('../../assets/sounds/unfavorite.wav'),
  /** Your vote in a poll was accepted. */
  vote: require('../../assets/sounds/vote.wav'),

  /**
   * Earcons: meant to sound the instant screen-reader focus lands on a post of
   * this kind, so the listener knows what it is without waiting for the label
   * to be read out.
   *
   * Bundled and ready, but nothing triggers them yet. React Native exposes no
   * accessibility-focus event — only `onAccessibilityAction`,
   * `onAccessibilityEscape` and `onAccessibilityTap` — so hooking these up
   * needs a small native module. See assets/sounds/README.md.
   */
  image: require('../../assets/sounds/image.wav'),
  media: require('../../assets/sounds/media.wav'),
  mention: require('../../assets/sounds/mention.wav'),

  /** Also unassigned; its intended trigger is not obvious from the name. */
  poll: require('../../assets/sounds/poll.wav'),
} as const;

export type InAppSound = keyof typeof IN_APP_SOUNDS;

/**
 * Players are kept and rewound rather than recreated.
 *
 * These are short sounds that can fire repeatedly — liking several posts in a
 * row — and building a player each time both allocates needlessly and risks
 * cutting off the previous one mid-play.
 */
const players = new Map<InAppSound, AudioPlayer>();
let audioModeReady = false;

async function ensureAudioMode(): Promise<void> {
  if (audioModeReady) return;

  // Mix with whatever else is playing and honour the silent switch, so Thrive
  // never ducks someone's music to play a tick.
  await setAudioModeAsync({
    playsInSilentMode: false,
    shouldPlayInBackground: false,
    interruptionMode: 'mixWithOthers',
  });
  audioModeReady = true;
}

/**
 * Play a short interface sound.
 *
 * Deliberately forgiving: a failure here is never worth interrupting the action
 * that triggered it, so problems are logged and swallowed.
 */
export async function playInAppSound(name: InAppSound): Promise<void> {
  const source = IN_APP_SOUNDS[name];
  if (!source) return;

  try {
    await ensureAudioMode();

    let player = players.get(name);
    if (!player) {
      player = createAudioPlayer(source);
      players.set(name, player);
    } else {
      // Rewind, so a rapid second trigger restarts rather than doing nothing.
      await player.seekTo(0);
    }

    player.play();
  } catch (error) {
    console.warn(`[Sounds] Could not play "${name}":`, error);
  }
}

/** Release every cached player. For teardown; playing again recreates them. */
export function releaseInAppSounds(): void {
  for (const player of players.values()) {
    try {
      player.remove();
    } catch {
      // Already gone.
    }
  }
  players.clear();
}
