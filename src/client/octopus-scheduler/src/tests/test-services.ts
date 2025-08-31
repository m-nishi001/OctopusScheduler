
import { GasFunctionService } from '/root/google_apps_script/octopus-scheduler/src/client/packages/common-lib/src/google-apps-script/gas-script-service.ts';

// ファイル名から拡張子を抽出し、サフィックスの多重付与を防ぐユーティリティ
function appendSuffixToFileName(filename: string, suffix: string): string {
    const match = filename.match(/^(.*?)(?:_(copy|copy_updated))*((\.[^.]+)?)$/i);
    if (!match) return filename + suffix;
    let base = match[1];
    let ext = match[3] || '';
    // 既存の_suffixを除去
    return base + suffix + ext;
}

const audioFileIds = [
    "1CcJaRELLzF4gPMDTqNBUjVwYpmu9OYBL",
    "1ySOu_pAvMC2OQ1YCc24qvO7c9KUBKnpA"
];
const imageFileIds = [
    "1B2Pv7HAJjSYbgSF5N4CbnTBEkchIeGtI",
    "1Oe5w-xWZOxOVfBXpa_C33Ovx_IJzTDl9"
];
const movieFileIds = [
    "1Z0MojrHPaviTxF0hwgSq3c9q4nlXfl6F",
    "1aPSnNBqTggwLcKwdBe0fZqnp58zP41Q8"
];

export async function test() {
    await Promise.all([
        testAudio(),
        testImage(),
        testMovie()
    ]);
    console.log('==== 全テスト完了 ====');
}

async function testAudio() {
    const googleFunctionService = GasFunctionService.create("callOctopusSchedulerApi")!!;
    console.log('==== AudioService.getAudio テスト開始 ====');
    const audioDataList: any[] = [];
    const audioGetCalls = audioFileIds.map(audioId =>
        googleFunctionService.createCall<any>("AudioService.getAudio", audioId)
            .withTimeout(20000)
            .withRetryCount(1)
            .withSuccessed(audio => {
                audioDataList.push(audio);
                const valid = audio && typeof audio === 'object' &&
                    typeof audio.audioId === 'string' &&
                    typeof audio.audioName === 'string' &&
                    typeof audio.data64 === 'string';
                if (valid) {
                    console.log('[AudioService.getAudio] response format: OK');
                } else {
                    console.error('[AudioService.getAudio] response format: NG', audio);
                }
            })
            .withFailuered(message => {
                console.error(`[AudioService.getAudio] failed`, message);
            })
    );
    await googleFunctionService.all(...audioGetCalls);

    console.log('==== AudioService.saveAudio テスト開始 ====');
    const audioSaveDataList: any[] = [];
    const audioSaveCalls = audioDataList.map(audio => {
        const newAudioName = appendSuffixToFileName(audio.audioName, '_copy');
        return googleFunctionService.createCall<any>("AudioService.saveAudio", { audioName: newAudioName, data64: audio.data64 })
            .withTimeout(20000)
            .withRetryCount(1)
            .withSuccessed(saveResult => {
                audioSaveDataList.push({ saveResult, original: audio });
                console.log(`[AudioService.saveAudio]`, saveResult);
            })
            .withFailuered(message => {
                console.error(`[AudioService.saveAudio] failed`, message);
            });
    });
    await googleFunctionService.all(...audioSaveCalls);

    console.log('==== AudioService.saveAudio(update) テスト開始 ====');
    const audioUpdateCalls = audioSaveDataList.map(({ saveResult, original }) => {
        const newAudioName = appendSuffixToFileName(original.audioName, '_copy_updated');
        return googleFunctionService.createCall<any>("AudioService.saveAudio", { audioId: saveResult.audioId, audioName: newAudioName, data64: original.data64 })
            .withTimeout(20000)
            .withRetryCount(1)
            .withSuccessed(updateResult => {
                console.log(`[AudioService.saveAudio: update]`, updateResult);
            })
            .withFailuered(message => {
                console.error(`[AudioService.saveAudio: update] failed`, message);
            });
    });
    await googleFunctionService.all(...audioUpdateCalls);
    console.log('==== AudioService テスト完了 ====');
}

async function testImage() {
    const googleFunctionService = GasFunctionService.create("callOctopusSchedulerApi")!!;
    console.log('==== ImageService.getImage テスト開始 ====');
    const imageDataList: any[] = [];
    const imageGetCalls = imageFileIds.map(imageId =>
        googleFunctionService.createCall<any>("ImageService.getImage", imageId)
            .withTimeout(20000)
            .withRetryCount(1)
            .withSuccessed(data => {
                imageDataList.push(data);
                const valid = data && typeof data === 'object' &&
                    typeof data.imageId === 'string' &&
                    typeof data.imageName === 'string' &&
                    typeof data.data64 === 'string';
                if (valid) {
                    console.log('[ImageService.getImage] response format: OK');
                } else {
                    console.error('[ImageService.getImage] response format: NG', data);
                }
            })
            .withFailuered(message => {
                console.error(`[ImageService.getImage] failed`, message);
            })
    );
    await googleFunctionService.all(...imageGetCalls);

    console.log('==== ImageService.saveImage テスト開始 ====');
    const imageSaveDataList: any[] = [];
    const imageSaveCalls = imageDataList.map(imageData => {
        const baseName = imageData.imageName || imageData.imageId + '.png';
        const newImageName = appendSuffixToFileName(baseName, '_copy');
        return googleFunctionService.createCall<any>("ImageService.saveImage", { imageName: newImageName, data64: imageData.data64 })
            .withTimeout(20000)
            .withRetryCount(1)
            .withSuccessed(saveResult => {
                imageSaveDataList.push({ saveResult, original: imageData });
                console.log(`[ImageService.saveImage]`, saveResult);
            })
            .withFailuered(message => {
                console.error(`[ImageService.saveImage] failed`, message);
            });
    });
    await googleFunctionService.all(...imageSaveCalls);

    console.log('==== ImageService.saveImage(update) テスト開始 ====');
    const imageUpdateCalls = imageSaveDataList.map(({ saveResult, original }) => {
        const baseName = original.imageName || original.imageId + '.png';
        const newImageName = appendSuffixToFileName(baseName, '_copy_updated');
        return googleFunctionService.createCall<any>("ImageService.saveImage", { imageId: saveResult.imageId, imageName: newImageName, data64: original.data64 })
            .withTimeout(20000)
            .withRetryCount(1)
            .withSuccessed(updateResult => {
                console.log(`[ImageService.saveImage: update]`, updateResult);
            })
            .withFailuered(message => {
                console.error(`[ImageService.saveImage: update] failed`, message);
            });
    });
    await googleFunctionService.all(...imageUpdateCalls);
    console.log('==== ImageService テスト完了 ====');
}

async function testMovie() {
    const googleFunctionService = GasFunctionService.create("callOctopusSchedulerApi")!!;
    console.log('==== MovieService.getMovie テスト開始 ====');
    const movieDataList: any[] = [];
    const movieGetCalls = movieFileIds.map(movieId =>
        googleFunctionService.createCall<any>("MovieService.getMovie", movieId)
            .withTimeout(20000)
            .withRetryCount(1)
            .withSuccessed(data => {
                movieDataList.push(data);
                const valid = data && typeof data === 'object' &&
                    typeof data.movieId === 'string' &&
                    typeof data.movieName === 'string' &&
                    typeof data.data64 === 'string';
                if (valid) {
                    console.log('[MovieService.getMovie] response format: OK');
                } else {
                    console.error('[MovieService.getMovie] response format: NG', data);
                }
            })
            .withFailuered(message => {
                console.error(`[MovieService.getMovie] failed`, message);
            })
    );
    await googleFunctionService.all(...movieGetCalls);

    console.log('==== MovieService.saveMovie テスト開始 ====');
    const movieSaveDataList: any[] = [];
    const movieSaveCalls = movieDataList.map(movieData => {
        const baseName = movieData.movieName || movieData.movieId + '.mp4';
        const newMovieName = appendSuffixToFileName(baseName, '_copy');
        return googleFunctionService.createCall<any>("MovieService.saveMovie", { movieName: newMovieName, data64: movieData.data64 })
            .withTimeout(20000)
            .withRetryCount(1)
            .withSuccessed(saveResult => {
                movieSaveDataList.push({ saveResult, original: movieData });
                console.log(`[MovieService.saveMovie]`, saveResult);
            })
            .withFailuered(message => {
                console.error(`[MovieService.saveMovie] failed`, message);
            });
    });
    await googleFunctionService.all(...movieSaveCalls);

    console.log('==== MovieService.saveMovie(update) テスト開始 ====');
    const movieUpdateCalls = movieSaveDataList.map(({ saveResult, original }) => {
        const baseName = original.movieName || original.movieId + '.mp4';
        const newMovieName = appendSuffixToFileName(baseName, '_copy_updated');
        return googleFunctionService.createCall<any>("MovieService.saveMovie", { movieId: saveResult.movieId, movieName: newMovieName, data64: original.data64 })
            .withTimeout(20000)
            .withRetryCount(1)
            .withSuccessed(updateResult => {
                console.log(`[MovieService.saveMovie: update]`, updateResult);
            })
            .withFailuered(message => {
                console.error(`[MovieService.saveMovie: update] failed`, message);
            });
    });
    await googleFunctionService.all(...movieUpdateCalls);
    console.log('==== MovieService テスト完了 ====');
}
