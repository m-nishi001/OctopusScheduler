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

declare let _memberDirectory_listMembers: (args: ListMembersArgs) => string;
declare let _memberDirectory_addMember: (args: AddMemberArgs) => string;
declare let _memberDirectory_updateMember: (args: UpdateMemberArgs) => string;
declare let _memberDirectory_deleteMember: (args: DeleteMemberArgs) => string;
declare let _memberDirectory_replaceAllMembers: (args: ReplaceAllMembersArgs) => string;

_memberDirectory_listMembers = (_args: ListMembersArgs): string => {
  try {
    const result = listMembers(resolveDeps());
    return JSON.stringify({ status: "success", data: result });
  } catch (error) {
    return JSON.stringify({ status: "error", message: (error as Error).message });
  }
};

_memberDirectory_addMember = (args: AddMemberArgs): string => {
  try {
    const result = addMember(resolveDeps(), args);
    return JSON.stringify({ status: "success", data: result });
  } catch (error) {
    return JSON.stringify({ status: "error", message: (error as Error).message });
  }
};

_memberDirectory_updateMember = (args: UpdateMemberArgs): string => {
  try {
    const result = updateMember(resolveDeps(), args);
    return JSON.stringify({ status: "success", data: result });
  } catch (error) {
    return JSON.stringify({ status: "error", message: (error as Error).message });
  }
};

_memberDirectory_deleteMember = (args: DeleteMemberArgs): string => {
  try {
    deleteMember(resolveDeps(), args.id);
    return JSON.stringify({ status: "success", data: undefined });
  } catch (error) {
    return JSON.stringify({ status: "error", message: (error as Error).message });
  }
};

_memberDirectory_replaceAllMembers = (args: ReplaceAllMembersArgs): string => {
  try {
    const result = replaceAllMembers(resolveDeps(), args.members);
    return JSON.stringify({ status: "success", data: result });
  } catch (error) {
    return JSON.stringify({ status: "error", message: (error as Error).message });
  }
};
