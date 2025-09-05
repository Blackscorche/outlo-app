# LoveMap - React Native Mobile App

A location-based dating and social networking mobile application built with React Native and Expo SDK 51.

## Features

- 📍 Real-time location sharing and map view
- 💬 Instant messaging and chat rooms
- 👤 User profiles and authentication
- ❤️ Favorites and connection requests
- 🔔 Push notifications
- 📸 Photo uploads and gallery
- 🎤 Voice messages
- 🗺️ Location-based user discovery

## Tech Stack

- **Framework**: React Native with Expo SDK 51
- **Navigation**: React Navigation
- **Backend**: Supabase (Authentication, Database, Realtime)
- **Maps**: React Native Maps
- **State Management**: React Hooks
- **Storage**: Expo SecureStore
- **Styling**: React Native StyleSheet

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Expo CLI
- iOS Simulator (Mac only) or Android Emulator
- Expo Go app on your physical device (optional)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd LoveMap
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
# or
expo start
```

## Running the App

### On iOS Simulator (Mac only)
```bash
npm run ios
```

### On Android Emulator
```bash
npm run android
```

### On Physical Device
1. Install the Expo Go app from App Store or Google Play
2. Scan the QR code from the terminal or Expo DevTools

## Project Structure

```
├── App.tsx                 # Main app entry point
├── src/
│   ├── navigation/        # Navigation configuration
│   ├── screens/           # Screen components
│   ├── hooks/             # Custom React hooks
│   ├── integrations/      # External service integrations
│   ├── styles/            # Theme and common styles
│   ├── types/             # TypeScript type definitions
│   └── utils/             # Utility functions
├── assets/                # Images and static assets
├── supabase/             # Supabase migrations and functions
└── app.json              # Expo configuration
```

## Configuration

### Environment Variables
The app uses Supabase for backend services. The configuration is in `src/integrations/supabase/client.ts`.

### Permissions
The app requires the following permissions:
- Location (always and when in use)
- Camera
- Photo Library
- Microphone
- Push Notifications

## Building for Production

### iOS
```bash
expo build:ios
```

### Android
```bash
expo build:android
```

For more detailed build instructions, refer to the [Expo documentation](https://docs.expo.dev/build/introduction/).

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.