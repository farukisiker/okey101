// Dynamic config on top of app.json (Expo passes app.json's "expo" object in as `config`).
// Nothing in app.json changes. Sign-in additions are opt-in through environment variables, so a build made
// before the Apple App ID capability / Google OAuth clients exist keeps signing and compiling as before.
//   ENABLE_APPLE_SIGNIN=1      -> ios.usesAppleSignIn + expo-apple-authentication plugin
//   GOOGLE_IOS_URL_SCHEME=...  -> @react-native-google-signin/google-signin plugin (reversed iOS client id,
//                                 "com.googleusercontent.apps.<id>"); Android needs no plugin (autolinking).
module.exports = ({ config }) => {
  const next = { ...config, plugins: [...(config.plugins ?? [])] };

  if (process.env.ENABLE_APPLE_SIGNIN === '1') {
    next.ios = { ...config.ios, usesAppleSignIn: true };
    next.plugins.push('expo-apple-authentication');
  }

  const scheme = (process.env.GOOGLE_IOS_URL_SCHEME ?? '').trim();
  if (scheme) {
    next.plugins.push(['@react-native-google-signin/google-signin', { iosUrlScheme: scheme }]);
  }

  return next;
};
