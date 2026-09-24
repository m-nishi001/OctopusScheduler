import { inject, injectable } from "tsyringe";
import { IJackpotGameApiToken } from "../../../server/jackpot-api-contract";
import type {
  JackpotGameApi,
  JackpotRemoteScreen,
  RemoteControlState,
} from "../../../server/jackpot-api-contract";

export type { JackpotRemoteScreen, RemoteControlState };

@injectable()
export class RemoteControlRepository {
  constructor(
    @inject(IJackpotGameApiToken) private readonly jackpotApi: JackpotGameApi
  ) {}

  async setScreen(screen: JackpotRemoteScreen): Promise<RemoteControlState> {
    return this.jackpotApi.setRemoteScreen(screen);
  }

  async advance(): Promise<RemoteControlState> {
    return this.jackpotApi.advanceRemoteAction();
  }

  async getState(): Promise<RemoteControlState> {
    return this.jackpotApi.getRemoteControlState();
  }
}
