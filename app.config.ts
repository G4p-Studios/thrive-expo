import { ExpoConfig, ConfigContext } from "expo/config";

const IS_DEV = process.env.APP_VARIANT === "development";
const IS_PREVIEW = process.env.APP_VARIANT === "preview";

const getUniqueIdentifier = () => {
  if (IS_DEV) return "com.galaxia.thrive.dev";
  if (IS_PREVIEW) return "com.galaxia.thrive.preview";
  return "com.galaxia.thrive";
};

const getAppName = () => {
  if (IS_DEV) return "Thrive (Dev)";
  if (IS_PREVIEW) return "Thrive (Preview)";
  return "Thrive";
};

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: getAppName(),
  slug: "Thrive",
  ios: {
    ...config.ios,
    bundleIdentifier: getUniqueIdentifier(),
  },
  android: {
    ...config.android,
    package: getUniqueIdentifier(),
  },
});
