
import { GasFunctionService } from '../../../../../../packages/common-lib/src/google-apps-script/gas-script-service';
import { useLocalStorage } from '../../../../../../packages/shared-composables/src/use-localstorage';
import type { Member } from '../../domains/member/member';

const MEMBER_CACHE_KEY = 'members';

export class MemberRepository {
    private readonly gasService = GasFunctionService.create('callJackpotGameApi')!;
    private readonly localStorage = useLocalStorage();

    async fetchMembers(): Promise<Member[]> {
        const cached = await this.localStorage.get<Member[]>(MEMBER_CACHE_KEY);
        if (cached && cached.length > 0) {
            return cached;
        }
        if (!this.gasService) return [];
        return new Promise((resolve, reject) => {
            this.gasService
                .createCall<{ members: Member[] }>('MemberService.getAll')
                .withSuccessed((res: { members: Member[] }) => {
                    this.localStorage.save(MEMBER_CACHE_KEY, res.members);
                    resolve(res.members);
                })
                .withFailuered((msg: string) => reject(new Error(msg)))
                .invoke();
        });
    }

    async saveMember(member: Member): Promise<void> {
        const members = (await this.localStorage.get<Member[]>(MEMBER_CACHE_KEY)) || [];
        members.push(member);
        await this.localStorage.save(MEMBER_CACHE_KEY, members);
        if (!this.gasService) return;
        return new Promise((resolve, reject) => {
            this.gasService
                .createCall<void>('MemberService.save', { member })
                .withSuccessed(() => resolve())
                .withFailuered((msg: string) => reject(new Error(msg)))
                .invoke();
        });
    }

    async updateMember(member: Member): Promise<void> {
        let members = (await this.localStorage.get<Member[]>(MEMBER_CACHE_KEY)) || [];
        members = members.map((m: Member) => m.id === member.id ? member : m);
        await this.localStorage.save(MEMBER_CACHE_KEY, members);
        if (!this.gasService) return;
        return new Promise((resolve, reject) => {
            this.gasService
                .createCall<void>('MemberService.save', { member })
                .withSuccessed(() => resolve())
                .withFailuered((msg: string) => reject(new Error(msg)))
                .invoke();
        });
    }

    async deleteMember(memberId: string): Promise<void> {
        let members = (await this.localStorage.get<Member[]>(MEMBER_CACHE_KEY)) || [];
        members = members.filter((m: Member) => m.id !== memberId);
        await this.localStorage.save(MEMBER_CACHE_KEY, members);
        if (!this.gasService) return;
        return new Promise((resolve, reject) => {
            this.gasService
                .createCall<void>('MemberService.delete', { id: memberId })
                .withSuccessed(() => resolve())
                .withFailuered((msg: string) => reject(new Error(msg)))
                .invoke();
        });
    }

    async syncMembersWithServer(): Promise<Member[]> {
        if (!this.gasService) return [];
        return new Promise((resolve, reject) => {
            this.gasService
                .createCall<{ members: Member[] }>('MemberService.getAll')
                .withSuccessed((res: { members: Member[] }) => {
                    this.localStorage.save(MEMBER_CACHE_KEY, res.members);
                    resolve(res.members);
                })
                .withFailuered((msg: string) => reject(new Error(msg)))
                .invoke();
        });
    }

    async getMemberById(memberId: string): Promise<Member | undefined> {
        const members = await this.fetchMembers();
        return members.find(m => m.id === memberId);
    }
}

export interface GetMembersRequest { }
export interface GetMembersResponse { members: Member[]; }
export interface ErrorResponse { code: string; message: string; }
