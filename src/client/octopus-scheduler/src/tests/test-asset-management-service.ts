import { GasFunctionService } from '/root/google_apps_script/octopus-scheduler/src/client/packages/common-lib/src/google-apps-script/gas-script-service.ts';

export async function testAssetManagementService() {
    const googleFunctionService = GasFunctionService.create("callOctopusSchedulerApi")!!;
    console.log('==== AssetMetadataService.getAllAssetMetadatas テスト開始 ====');
    await googleFunctionService.createCall<any>("AssetMetadataService.getAllAssetMetadatas")
        .withTimeout(20000)
        .withRetryCount(1)
        .withSuccessed((result) => {
            if (Array.isArray(result)) {
                console.log('[AssetMetadataService.getAllAssetMetadatas] response:', result);
                const valid = result.every(meta =>
                    typeof meta.id === 'string' &&
                    typeof meta.name === 'string' &&
                    (meta.type === 'audio' || meta.type === 'image' || meta.type === 'movie') &&
                    !!meta.lastUpdatedAt
                );
                if (valid) {
                    console.log('[AssetMetadataService.getAllAssetMetadatas] response format: OK');
                } else {
                    console.error('[AssetMetadataService.getAllAssetMetadatas] response format: NG', result);
                }
            } else {
                console.error('[AssetMetadataService.getAllAssetMetadatas] response is not array', result);
            }
        })
        .withFailuered(message => {
            console.error(`[AssetMetadataService.getAllAssetMetadatas] failed`, message);
        })
        .invoke();
    console.log('==== AssetMetadataService テスト完了 ====');
}
