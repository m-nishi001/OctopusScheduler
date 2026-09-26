/**
 * member-directory の GAS エンドポイント。
 *
 * 各ハンドラは「引数パース -> use-case呼び出し -> ApiResponseに詰めてJSON.stringify」
 * という薄い層のみを担う。マスタメンバーデータは app-scheduler本体・各ゲームパッケージ
 * から共有される単一の名簿として IKeyValueStorage に保存する。
 */
import { container } from "tsyringe";
import { IKeyValueStorageToken } from "@octopus/infrastructures/interfaces";
import type { IKeyValueStorage } from "@octopus/infrastructures/interfaces";
import type {
  AddMemberArgs,
  DeleteMemberArgs,
  ListMembersArgs,
  ReplaceAllMembersArgs,
  UpdateMemberArgs,
} from "./member-directory-api-contract";
import {
  addMember,
  deleteMember,
  listMembers,
  replaceAllMembers,
  updateMember,
} from "./member-directory-use-cases";

function resolveDeps() {
  return {
    storage: container.resolve<IKeyValueStorage>(IKeyValueStorageToken),
    generateId: (): string => Utilities.getUuid(),
  };
}

declare let _memberDirectory_listMembers: (args: ListMembersArgs) => Promise<string>;
declare let _memberDirectory_addMember: (args: AddMemberArgs) => Promise<string>;
declare let _memberDirectory_updateMember: (args: UpdateMemberArgs) => Promise<string>;
declare let _memberDirectory_deleteMember: (args: DeleteMemberArgs) => Promise<string>;
declare let _memberDirectory_replaceAllMembers: (args: ReplaceAllMembersArgs) => Promise<string>;

_memberDirectory_listMembers = async (_args: ListMembersArgs): Promise<string> => {
  try {
    const result = await listMembers(resolveDeps());
    return JSON.stringify({ status: "success", data: result });
  } catch (error) {
    return JSON.stringify({ status: "error", message: (error as Error).message });
  }
};

_memberDirectory_addMember = async (args: AddMemberArgs): Promise<string> => {
  try {
    const result = await addMember(resolveDeps(), args);
    return JSON.stringify({ status: "success", data: result });
  } catch (error) {
    return JSON.stringify({ status: "error", message: (error as Error).message });
  }
};

_memberDirectory_updateMember = async (args: UpdateMemberArgs): Promise<string> => {
  try {
    const result = await updateMember(resolveDeps(), args);
    return JSON.stringify({ status: "success", data: result });
  } catch (error) {
    return JSON.stringify({ status: "error", message: (error as Error).message });
  }
};

_memberDirectory_deleteMember = async (args: DeleteMemberArgs): Promise<string> => {
  try {
    await deleteMember(resolveDeps(), args.id);
    return JSON.stringify({ status: "success", data: undefined });
  } catch (error) {
    return JSON.stringify({ status: "error", message: (error as Error).message });
  }
};

_memberDirectory_replaceAllMembers = async (args: ReplaceAllMembersArgs): Promise<string> => {
  try {
    const result = await replaceAllMembers(resolveDeps(), args.members);
    return JSON.stringify({ status: "success", data: result });
  } catch (error) {
    return JSON.stringify({ status: "error", message: (error as Error).message });
  }
};
