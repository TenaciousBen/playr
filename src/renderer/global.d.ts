import type { AudioplayerApi } from "@/src/shared/preload/audioplayerApi";

export {};

declare global {
  interface Window {
    audioplayer: AudioplayerApi;
  }
}


