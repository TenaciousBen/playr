export type UserSettings = {
  /** Allow collection of anonymous usage statistics. */
  allowStatistics: boolean;
  /** Which time window to use for the "Recently Added" view. */
  recentlyAddedRange: "today" | "week" | "month" | "quarter" | "year";
};

export const DEFAULT_USER_SETTINGS: UserSettings = {
  allowStatistics: true,
  recentlyAddedRange: "week"
};


