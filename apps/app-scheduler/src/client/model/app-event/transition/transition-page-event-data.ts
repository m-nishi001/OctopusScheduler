export interface TransitionPageEventData {
  id: string;
  type: "TransitionPageEvent";
  startTime: Date;
  endTime: Date;
  transitionUrl: string;
  fadeOutDuration?: number;
  processedAt: Date | null;
  registeredAt: Date;
  updatedAt: Date;
}
