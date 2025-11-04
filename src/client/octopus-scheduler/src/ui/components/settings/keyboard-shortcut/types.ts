// src/ui/components/settings/keyboard-shortcut/types.ts
export interface EventFormData {
  actionType: string;
  // 各イベント固有のデータ（例: transitionUrl, audioId など）
  [key: string]: any;
}
