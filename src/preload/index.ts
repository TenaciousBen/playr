import { contextBridge, ipcRenderer, webUtils } from "electron";
import { IpcChannels } from "@/src/shared/ipc/channels";
import type { AudioplayerApi } from "@/src/shared/preload/audioplayerApi";

const api: AudioplayerApi = {
  library: {
    list: () => ipcRenderer.invoke(IpcChannels.Library.List),
    search: (query) => ipcRenderer.invoke(IpcChannels.Library.Search, query),
    addFolders: (folderPaths) =>
      ipcRenderer.invoke(IpcChannels.Library.AddFolders, folderPaths),
    addFiles: (filePaths) => ipcRenderer.invoke(IpcChannels.Library.AddFiles, filePaths),
    addDroppedFiles: async (files) => {
      const paths = (files ?? [])
        .map((f) => {
          try {
            return webUtils.getPathForFile(f);
          } catch {
            return "";
          }
        })
        .filter((p) => typeof p === "string" && p.length > 0);

      // eslint-disable-next-line no-console
      console.log("[preload] addDroppedFiles", {
        filesLength: files?.length ?? 0,
        extractedPaths: paths.length
      });

      return await ipcRenderer.invoke(IpcChannels.Library.AddFiles, paths);
    },
    remove: (audiobookId) => ipcRenderer.invoke(IpcChannels.Library.Remove, audiobookId),
    clear: () => ipcRenderer.invoke(IpcChannels.Library.Clear)
  },
  settings: {
    get: () => ipcRenderer.invoke(IpcChannels.Settings.Get),
    set: (settings) => ipcRenderer.invoke(IpcChannels.Settings.Set, settings)
  },
  playback: {
    getState: () => ipcRenderer.invoke(IpcChannels.Playback.GetState),
    getStateForAudiobook: (audiobookId) =>
      ipcRenderer.invoke(IpcChannels.Playback.GetStateForAudiobook, audiobookId),
    setState: (state) => ipcRenderer.invoke(IpcChannels.Playback.SetState, state),
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


