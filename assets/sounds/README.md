# Notification and alert sounds

Drop your sound files in this folder. Two different systems use them, and they
have different rules.

## The two kinds of sound

**Notification sounds** are played by the operating system when a notification
appears — including when Thrive is closed. The app does not play these; it only
names the file, and iOS or Android plays it. This means the file has to be
*compiled into the app* by a build, not loaded at runtime.

**In-app alert sounds** are played by Thrive itself while you are using it, for
things like a post sending. These go through `expo-audio` and are ordinary
bundled assets.

## Adding a notification sound

1. Put the file in this folder, e.g. `assets/sounds/mention.wav`.
2. Add its path to the `expo-notifications` plugin in `app.json`:

   ```json
   ["expo-notifications", { "sounds": ["./assets/sounds/mention.wav"] }]
   ```

3. Reference it **by filename only** in code — `mention.wav`, not the path.
   See `lib/notifications/sounds.ts`.
4. Rebuild. A config-plugin change needs a new native build; it will not appear
   in an existing one.

### Format

- **Android: use `.wav`.** MP3 sometimes works and sometimes silently doesn't.
- **iOS** accepts anything `AVAudioPlayer` handles (`.wav`, `.aiff`, `.mp3`),
  but `.wav` keeps both platforms on one file.
- Keep it **under 30 seconds** — iOS refuses to play a longer notification
  sound and silently falls back to the default.

### The Android catch worth knowing about

On Android 8.0 and later, the sound is a property of the *notification channel*,
and a channel's sound is **fixed when the channel is first created**. Changing
`sound` in code afterwards does nothing on a device where the channel already
exists.

`lib/notifications/channels.ts` works around this by putting a version number in
the channel id. If you change a channel's sound, bump `CHANNEL_VERSION` so a new
channel is created. The old one is deleted on the next launch.

## Adding an in-app sound

1. Put the file in this folder.
2. Register it in the `IN_APP_SOUNDS` map in `lib/notifications/sounds.ts`.

These are ordinary bundled assets, so no rebuild is needed beyond the usual
JavaScript reload — but a *new file* does need a build, since it is bundled.

## What is here now

| File | Used for | Length |
| --- | --- | --- |
| `new_mention.wav` | Mentions and public replies | 2.1s |
| `new_dm.wav` | Direct messages | 3.0s |
| `new_notification.wav` | Boosts, likes, follows, polls, edits | 1.2s |

All three are 44.1kHz 16-bit stereo WAV, well inside the iOS 30-second limit,
and listed in the `expo-notifications` plugin in `app.json`.

Which sound plays for what is decided in two places:

- `SOUNDS` in `lib/notifications/sounds.ts` maps a name to a file.
- `lib/notifications/channels.ts` maps a channel to a sound, and
  `channelFor` in `lib/notifications/poller.ts` decides which channel a given
  notification belongs to.

A direct message is a `mention` whose status is `direct` — that visibility check
is the only thing separating the DM sound from the mention sound.

### In-app sounds

| File | Plays when |
| --- | --- |
| `new_toot.wav` | A post that was not there before arrives in the home timeline |
| `send_toot.wav` | Your post goes out |
| `send_reply.wav` | Your reply goes out |
| `send_boost.wav` | You boost something |
| `favorite.wav` / `unfavorite.wav` | You like or unlike |
| `vote.wav` | The server accepts your poll vote |

Registered in `IN_APP_SOUNDS` in `lib/notifications/sounds.ts`. Players are
cached and rewound rather than rebuilt, so liking several posts quickly does not
cut each sound short.

### Earcons

`image.wav`, `media.wav` and `mention.wav` play the instant screen reader focus
lands on a post of that kind, so its nature is known before the label has been
read out. Only one fires per post — a mention wins over media, since it is the
more urgent thing to know.

React Native has no accessibility-focus event of its own, only
`onAccessibilityAction`, `onAccessibilityEscape` and `onAccessibilityTap`. These
therefore go through a local native module in `modules/accessibility-focus`,
which wraps `UIAccessibility.elementFocusedNotification` on iOS and
`TYPE_VIEW_ACCESSIBILITY_FOCUSED` on Android and surfaces them as an
`onAccessibilityFocus` prop.

Changing that module needs a rebuild — native code is not reloaded by Fast
Refresh — and it can only be verified on a device with VoiceOver or TalkBack
actually running.

`poll.wav` is bundled but not yet attached to anything.
