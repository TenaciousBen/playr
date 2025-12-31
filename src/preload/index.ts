import { contextBridge, ipcRenderer } from "electron";
import { IpcChannels } from "@/src/shared/ipc/channels";
import type { AudioplayerApi } from "@/src/shared/preload/audioplayerApi";

const api: AudioplayerApi = {
  library: {
    list: () => ipcRenderer.invoke(IpcChannels.Library.List),
    search: (query) => ipcRenderer.invoke(IpcChannels.Library.Search, query),
    addFolders: (folderPaths) =>
      ipcRenderer.invoke(IpcChannels.Library.AddFolders, folderPaths)
  },
  playback: {
    getState: () => ipcRenderer.invoke(IpcChannels.Playback.GetState),
    play: () => ipcRenderer.invoke(IpcChannels.Playback.Play),
    pause: () => ipcRenderer.invoke(IpcChannels.Playback.Pause)
  }
};

contextBridge.exposeInMainWorld("audioplayer", api);

declare global {
  interface Window {
    audioplayer: AudioplayerApi;
  }
}


