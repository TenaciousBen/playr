/**
 * IPC channel names shared across main/preload/renderer.
 * Keep these stable to avoid breaking renderer<->main communication.
 */
export const IpcChannels = {
  Library: {
    AddFiles: "library:add-files",
    AddFolders: "library:add-folders",
    Remove: "library:remove",
    Clear: "library:clear",
    Search: "library:search",
    List: "library:list"
  },
  Settings: {
    Get: "settings:get",
    Set: "settings:set"
  },
  Playback: {
    Play: "playback:play",
    Pause: "playback:pause",
    Seek: "playback:seek",
    SetRate: "playback:set-rate",
    SkipBy: "playback:skip-by",
    NextChapter: "playback:next-chapter",
    PrevChapter: "playback:prev-chapter",
    GetState: "playback:get-state",
    GetStateForAudiobook: "playback:get-state-for-audiobook",
    SetState: "playback:set-state"
  }
} as const;


