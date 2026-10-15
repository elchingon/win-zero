// Sound files are Metro assets: importing one gives its module id, which expo-audio plays.
declare module '*.wav' {
  const asset: number;
  export default asset;
}
