export class PlayAudioEventDetail {
  audioUrl: string;
  volume?: number;
  constructor(audioUrl: string, volume?: number) {
    this.audioUrl = audioUrl;
    this.volume = volume;
  }
}
