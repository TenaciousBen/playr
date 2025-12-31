export type UserSettings = {
  /** Allow collection of anonymous usage statistics. */
  allowStatistics: boolean;
  /** Which time window to use for the "Recently Added" view. */
  recentlyAddedRange: "today" | "week" | "month" | "quarter" | "year";
  /** Default sort mode for audiobook lists/grids. */
  sortBy: "title" | "author" | "dateAdded" | "progress" | "duration" | "userOrder";
  /** Preferred presentation of audiobook lists. */
  viewMode: "grid" | "list";
  /** User-defined ordering for the library pages (shared across All/Recent/Reading/Favorites). */
  libraryOrder: string[];
  /** User-defined ordering per author page, keyed by normalized author name. */
  authorOrders: Record<string, string[]>;
};

export const DEFAULT_USER_SETTINGS: UserSettings = {
  allowStatistics: true,
  recentlyAddedRange: "week",
  sortBy: "title",
  viewMode: "grid",
  libraryOrder: [],
  authorOrders: {}
};


