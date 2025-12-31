export type CollectionId = string;

export type Collection = {
  id: CollectionId;
  name: string;
  createdAt: string; // ISO
  audiobookIds: string[];
};


