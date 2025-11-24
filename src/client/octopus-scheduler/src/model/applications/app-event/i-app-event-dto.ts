export interface IAppEventDto {
  actionType: string;
  eventId?: string;
  // concrete converters extend with specific fields
}
