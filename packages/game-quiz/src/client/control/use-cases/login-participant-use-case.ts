import { injectable, inject } from "tsyringe";
import { ParticipantAuthRepository } from "../../model/participant-auth-repository";
import type { ParticipantSession } from "../../../server/quiz-api-contract";

@injectable()
export class LoginParticipantUseCase {
  constructor(
    @inject(ParticipantAuthRepository) private readonly participantAuthRepository: ParticipantAuthRepository
  ) {}

  async execute(userId: string): Promise<ParticipantSession> {
    return this.participantAuthRepository.login(userId);
  }
}
