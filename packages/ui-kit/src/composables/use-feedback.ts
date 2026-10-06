import { reactive, ref } from 'vue';

export interface ConfirmOptions {
    title?: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    /** true で主操作を danger(赤)にする。削除確認用 */
    danger?: boolean;
    /** false で「キャンセル」を出さない(alert 相当) */
    showCancel?: boolean;
}

export interface ConfirmState extends ConfirmOptions {
    id: number;
    resolve: (ok: boolean) => void;
}

export type ToastKind = 'info' | 'success' | 'error';
export interface ToastItem {
    id: number;
    kind: ToastKind;
    message: string;
}

// アプリ全体で1つの状態を共有する(PageShell 内の FeedbackHost が描画する)
export const confirmQueue = reactive<ConfirmState[]>([]);
export const toasts = ref<ToastItem[]>([]);
let toastSeq = 0;
let confirmSeq = 0;

/** native confirm()/alert() の置き換え。Promise<boolean> を返す。 */
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
    return new Promise((resolve) => {
        confirmQueue.push({ ...options, id: ++confirmSeq, resolve });
    });
}

export function resolveConfirm(ok: boolean) {
    const current = confirmQueue.shift();
    current?.resolve(ok);
}

export function dismissToast(id: number) {
    toasts.value = toasts.value.filter((t) => t.id !== id);
}

function pushToast(kind: ToastKind, message: string, durationMs: number) {
    const id = ++toastSeq;
    toasts.value = [...toasts.value, { id, kind, message }];
    if (durationMs > 0) setTimeout(() => dismissToast(id), durationMs);
    return id;
}

export const toast = {
    info: (message: string, durationMs = 3000) => pushToast('info', message, durationMs),
    success: (message: string, durationMs = 3000) => pushToast('success', message, durationMs),
    error: (message: string, durationMs = 6000) => pushToast('error', message, durationMs),
};

export function useConfirm() {
    return {
        confirm: confirmDialog,
        /** 削除確認 */
        confirmDelete: (message: string, title = '削除の確認') =>
            confirmDialog({ title, message, confirmLabel: '削除', danger: true }),
        /** 未保存変更の破棄確認 */
        confirmDiscard: (message = '保存されていない変更があります。破棄して閉じますか?') =>
            confirmDialog({ title: '未保存の変更', message, confirmLabel: '破棄して閉じる', cancelLabel: '編集を続ける', danger: true }),
    };
}

export function useToast() {
    return toast;
}
