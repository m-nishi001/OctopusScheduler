import { injectable, inject } from "tsyringe";
import { ParticipantAuthRepository } from "../../model/participant-auth-repository";
import type { ParticipantSession } from "../../../server/quiz-api-contract";

@injectable()
export class ResolveDeviceTokenUseCase {
  constructor(
    @inject(ParticipantAuthRepository) private readonly participantAuthRepository: ParticipantAuthRepository
  ) {}

  async execute(token: string): Promise<ParticipantSession> {
    return this.participantAuthRepository.resolveToken(token);
  }
}
