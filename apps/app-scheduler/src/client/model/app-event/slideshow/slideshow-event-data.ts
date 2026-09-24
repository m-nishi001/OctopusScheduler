export interface SlideshowEventData {
  id: string;
  type: "SlideshowEvent";
  startTime: Date;
  endTime: Date;
  folderId: string;
  displayDuration: number;
  transitionType: "fade" | "slide";
  slideDirection?: "left" | "right" | "up" | "down";
  bgmIds: string[];
  processedAt: Date | null;
  registeredAt: Date;
  updatedAt: Date;
}
