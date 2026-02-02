# Thrive

A fully accessible Mastodon client built with React Native and Expo. No backend required - connects directly to any Mastodon instance.

## Features

### Mastodon Integration
- **Connect to any instance**: Enter your instance URL and authenticate via OAuth
- **Home Timeline**: View posts from accounts you follow with pull-to-refresh
- **Explore**: Browse public timelines and search for accounts, posts, and hashtags
- **Notifications**: View mentions, boosts, favorites, and follows
- **Bookmarks**: Save posts for later
- **Lists**: Organize accounts into custom lists

### Post Interactions
- Create new posts (up to 500 characters)
- Reply to posts
- Boost (reblog) posts
- Favorite (like) posts
- Bookmark posts
- View media attachments

### Account Management
- View your profile and stats
- Disconnect and switch accounts
- Follow/unfollow accounts from search

### Accessibility
- Full VoiceOver (iOS) and TalkBack (Android) support
- Semantic labels and hints on all interactive elements
- Screen reader friendly navigation

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Expo Go app (for testing on device) or iOS/Android simulator

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/thrive.git
cd thrive

# Install dependencies
npm install

# Start the development server
npx expo start
```

### Running the App

- **iOS Simulator**: Press `i` in the terminal
- **Android Emulator**: Press `a` in the terminal
- **Physical Device**: Scan the QR code with Expo Go
- **Web**: Press `w` in the terminal

## Connecting Your Mastodon Account

1. Open the app
2. Enter your Mastodon instance URL (e.g., `mastodon.social`, `hachyderm.io`)
3. Tap "Connect"
4. Log in with your Mastodon credentials in the browser
5. Authorize the app
6. You'll be redirected back to the app automatically

The app uses standard OAuth 2.0 - no access tokens to copy or API keys to manage.

## Architecture

### Direct API Access
Thrive connects directly to Mastodon instances - no intermediary backend required. All authentication tokens are stored locally on your device.

### Key Directories
```
thrive/
├── app/                 # Expo Router screens
│   ├── (tabs)/          # Tab navigation (Home, Explore, Notifications, Profile)
│   └── ...              # Other screens (Bookmarks, Lists, Settings)
├── lib/mastodon/        # Mastodon API client
│   ├── oauth.ts         # OAuth flow
│   ├── client.ts        # HTTP client
│   ├── storage.ts       # Secure token storage
│   └── endpoints/       # API endpoint functions
├── components/          # Reusable UI components
└── types/               # TypeScript definitions
```

### Storage
- **iOS/Android**: Credentials stored in SecureStore (encrypted)
- **Web**: Credentials stored in localStorage

## Platform Support

- iOS (native)
- Android (native)
- Web (responsive)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details.

---

Made with care for the Mastodon community.
