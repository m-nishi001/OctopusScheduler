// このWeb Workerは、BlobデータをBase64に変換する処理をバックグラウンドで行う
// メインスレッドのブロックを防ぐことで、UIの応答性を維持する

// self.onmessageは、メインスレッドからメッセージを受け取ったときに実行される
self.onmessage = (event) => {
    const { blob } = event.data;

    // FileReaderを使用してBlobを読み込む
    const reader = new FileReader();
    reader.onloadend = () => {
        // 読み込み完了後、Base64文字列を取得
        const base64data = reader.result as string;
        // メインスレッドに結果を送信
        self.postMessage(base64data.split(',')[1]); // "data:mime/type;base64," の部分を削除
    };
    reader.onerror = (error) => {
        // エラーが発生した場合、エラーを送信
        self.postMessage({ error: 'Failed to convert blob to base64', details: error });
    };

    // BlobをData URLとして読み込み開始
    reader.readAsDataURL(blob);
};