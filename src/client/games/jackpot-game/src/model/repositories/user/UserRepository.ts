import type { User } from '../../domains/user/User';

export interface UserRepository {
  getUserById(id: string): Promise<User | null>;
  getAllUsers(): Promise<User[]>;
}
