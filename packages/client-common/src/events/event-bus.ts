import mitt from "mitt";

export const eventBus = mitt<{
  transitionPage: { transitionUrl: string };
  // ローカルデータが変更され、バックグラウンド同期のプッシュを早めるべき
  // ことを通知する。どのkindが変わったかは問わない(SyncRunnerは常に全対象を
  // 差分判定するため、シグナルは「そろそろ確認して」という合図でしかない)。
  syncDirty: void;
  // バックグラウンド同期でリモートの変更をローカルへ取り込んだことを通知する。
  // 一覧などを onMounted で一度だけ読む画面は、これを受けて再読込する。
  syncPulled: void;
}>();
