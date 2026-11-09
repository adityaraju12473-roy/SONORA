export {};

declare global {
  interface Window {
    SonoraNative?: {
      isNativeAndroid: () => boolean;
      getDeviceInfo: () => string;
      triggerHaptic: (style?: 'click' | 'heavy' | 'double') => void;
      showNativeToast: (message: string) => void;
    };
  }
}
