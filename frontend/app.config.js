const IS_DEV = process.env.APP_VARIANT === "development";

const getAppId = () => {
  if (IS_DEV) {
    return "com.parables.app.dev";
  }
  return "com.parables.app";
};

export default {
  expo: {
    name: IS_DEV ? "Parables (Dev)" : "Parables",
    slug: "parables",
    version: "1.0.4",
    orientation: "default",
    icon: "./assets/images/icon.png",
    scheme: "parables",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    splash: {
      image: "./assets/images/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },
    assetBundlePatterns: ["assets/**/*"],
    ios: {
      supportsTablet: true,
      bundleIdentifier: getAppId(),
      runtimeVersion: "1.0.4",
      infoPlist: {
        UIAppFonts: [
          "SpaceMono-Regular.ttf",
          "Literata-Regular.ttf",
          "Literata-Medium.ttf",
          "Inter-Regular.ttf",
          "Inter-Medium.ttf",
          "Inter-SemiBold.ttf",
          "Inter-Bold.ttf",
        ],
        ITSAppUsesNonExemptEncryption: false,
        NSFaceIDUsageDescription: "Use Face ID for quick, secure login",
        NSCalendarsUsageDescription:
          "Allow Parables to add reading reminders to your calendar",
        NSMicrophoneUsageDescription: "Allow Parables to record audio notes",
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#ffffff",
      },
      edgeToEdgeEnabled: true,
      package: getAppId(),
      intentFilters: [
        {
          action: "VIEW",
          data: {
            scheme: "parables",
            host: "*",
          },
          category: ["BROWSABLE", "DEFAULT"],
        },
      ],
      runtimeVersion: "1.0.4",
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/images/favicon.png",
    },
    plugins: [
      "expo-router",
      "expo-sqlite",
      "expo-web-browser",
      "react-native-iap",
      [
        "expo-build-properties",
        {
          android: {
            kotlinVersion: "2.1.20",
          },
        },
      ],
      [
        "expo-updates",
        {
          checkOnLaunch: "ALWAYS",
          launchWaitMs: 0,
        },
      ],
      [
        "@react-native-google-signin/google-signin",
        {
          iosUrlScheme:
            "com.googleusercontent.apps.1082884751116-3inocdviem12rlllhut06s5g83899og4",
        },
      ],
      [
        "expo-notifications",
        {
          icon: "./assets/images/icon.png",
          color: "#ffffff",
        },
      ],
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission:
            "Allow Parables to use your location for nearby Bible study groups.",
        },
      ],
      [
        "expo-camera",
        {
          cameraPermission: "Allow Parables to access your camera.",
        },
      ],
      [
        "expo-media-library",
        {
          photosPermission:
            "Allow Parables to save verse images to your gallery.",
          savePhotosPermission:
            "Allow Parables to save verse images to your gallery.",
        },
      ],
      "expo-local-authentication",
      [
        "expo-av",
        {
          microphonePermission:
            "Allow Parables to access your microphone for audio notes.",
        },
      ],
      [
        "react-native-maps",
        {
          googleMapsApiKey: "",
        },
      ],
      "@sentry/react-native/expo",
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      router: {},
      eas: {
        projectId: "b52b6604-e07d-45b0-bf10-1d66a1e471c9",
      },
    },
    updates: {
      url: "https://u.expo.dev/b52b6604-e07d-45b0-bf10-1d66a1e471c9",
      enabled: true,
      checkAutomatically: "ON_LOAD",
      fallbackToCacheTimeout: 0,
    },
  },
};
