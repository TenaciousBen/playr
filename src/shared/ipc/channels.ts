/**
 * IPC channel names shared across main/preload/renderer.
 * Keep these stable to avoid breaking renderer<->main communication.
 */
export const IpcChannels = {
  Library: {
    AddFolders: "library:add-folders",
    Search: "library:search",
    List: "library:list"
  },
  Playback: {
    Play: "playback:play",
    Pause: "playback:pause",
    Seek: "playback:seek",
    SetRate: "playback:set-rate",
    SkipBy: "playback:skip-by",
    NextChapter: "playback:next-chapter",
    PrevChapter: "playback:prev-chapter",
    GetState: "playback:get-state"
  }
} as const;


