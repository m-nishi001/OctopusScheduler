
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
    const googleFunctionService = GasFunctionService.create("callOctopusSchedulerApi")!!;

    // Audio Service 並列
    const audioGetCalls = audioFileIds.map(audioId =>
        googleFunctionService.createCall<any>("AudioService.getAudio", audioId)
            .withTimeout(20000)
            .withRetryCount(1)
            .withSuccessed(audio => {
                console.log(`[AudioService.getAudio]`, audio);
                // 検証: audioId, audioName, data64が存在し型も妥当か
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
    const audioResults = await googleFunctionService.all(...audioGetCalls);

    // Audioのsave/updateも並列


    const audioSaveCalls = audioResults
        .map((result) => {
            if (
                result.status === 'fulfilled' &&
                result.value &&
                (result.value as any).audioName &&
                (result.value as any).data64
            ) {
                const audio = result.value as any;
                const newAudioName = appendSuffixToFileName(audio.audioName, '_copy');
                return googleFunctionService.createCall<any>("AudioService.saveAudio", { audioName: newAudioName, data64: audio.data64 })
                    .withTimeout(20000)
                    .withRetryCount(1)
                    .withSuccessed(saveResult => {
                        console.log(`[AudioService.saveAudio]`, saveResult);
                    })
                    .withFailuered(message => {
                        console.error(`[AudioService.saveAudio] failed`, message);
                    });
            }
            return null;
        })
        .filter((x): x is ReturnType<typeof googleFunctionService.createCall> => x !== null);
    const audioSaveResults = await googleFunctionService.all(...audioSaveCalls);


    const audioUpdateCalls = audioSaveResults
        .map((result, i) => {
            if (
                result.status === 'fulfilled' &&
                result.value &&
                (result.value as any).audioId &&
                audioResults[i].status === 'fulfilled' &&
                audioResults[i].value &&
                (audioResults[i].value as any).audioName &&
                (audioResults[i].value as any).data64
            ) {
                const audio = audioResults[i].value as any;
                const saveResult = result.value as any;
                const newAudioName = appendSuffixToFileName(audio.audioName, '_copy_updated');
                return googleFunctionService.createCall<any>("AudioService.saveAudio", { audioId: saveResult.audioId, audioName: newAudioName, data64: audio.data64 })
                    .withTimeout(20000)
                    .withRetryCount(1)
                    .withSuccessed(updateResult => {
                        console.log(`[AudioService.saveAudio: update]`, updateResult);
                    })
                    .withFailuered(message => {
                        console.error(`[AudioService.saveAudio: update] failed`, message);
                    });
            }
            return null;
        })
        .filter((x): x is ReturnType<typeof googleFunctionService.createCall> => x !== null);
    await googleFunctionService.all(...audioUpdateCalls);

    // Image Service 並列
    const imageGetCalls = imageFileIds.map(imageId =>
        googleFunctionService.createCall<any>("ImageService.getImage", imageId)
            .withTimeout(20000)
            .withRetryCount(1)
            .withSuccessed(data => {
                console.log(`[ImageService.getImage]`, data);
                // 検証: imageId, imageName, data64が存在し型も妥当か
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
    const imageResults = await googleFunctionService.all(...imageGetCalls);



    const imageSaveCalls = imageResults
        .map((result, i) => {
            if (result.status === 'fulfilled' && result.value) {
                const imageData = result.value as any;
                // imageData.imageNameがあればそれを使う
                const baseName = imageData.imageName || imageFileIds[i] + '.png';
                const newImageName = appendSuffixToFileName(baseName, '_copy');
                return googleFunctionService.createCall<any>("ImageService.saveImage", { imageName: newImageName, data64: imageData })
                    .withTimeout(20000)
                    .withRetryCount(1)
                    .withSuccessed(saveResult => {
                        console.log(`[ImageService.saveImage]`, saveResult);
                    })
                    .withFailuered(message => {
                        console.error(`[ImageService.saveImage] failed`, message);
                    });
            }
            return null;
        })
        .filter((x): x is ReturnType<typeof googleFunctionService.createCall> => x !== null);
    const imageSaveResults = await googleFunctionService.all(...imageSaveCalls);


    const imageUpdateCalls = imageSaveResults
        .map((result, i) => {
            if (
                result.status === 'fulfilled' &&
                result.value &&
                (result.value as any).imageId &&
                imageResults[i].status === 'fulfilled'
            ) {
                const imageData = imageResults[i].value as any;
                const saveResult = result.value as any;
                const baseName = imageData.imageName || imageFileIds[i] + '.png';
                const newImageName = appendSuffixToFileName(baseName, '_copy_updated');
                return googleFunctionService.createCall<any>("ImageService.saveImage", { imageId: saveResult.imageId, imageName: newImageName, data64: imageData })
                    .withTimeout(20000)
                    .withRetryCount(1)
                    .withSuccessed(updateResult => {
                        console.log(`[ImageService.saveImage: update]`, updateResult);
                    })
                    .withFailuered(message => {
                        console.error(`[ImageService.saveImage: update] failed`, message);
                    });
            }
            return null;
        })
        .filter((x): x is ReturnType<typeof googleFunctionService.createCall> => x !== null);
    await googleFunctionService.all(...imageUpdateCalls);

    // Movie Service 並列
    const movieGetCalls = movieFileIds.map(movieId =>
        googleFunctionService.createCall<any>("MovieService.getMovie", movieId)
            .withTimeout(20000)
            .withRetryCount(1)
            .withSuccessed(data => {
                console.log(`[MovieService.getMovie]`, data);
                // 検証: movieId, movieName, data64が存在し型も妥当か
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
    const movieResults = await googleFunctionService.all(...movieGetCalls);



    const movieSaveCalls = movieResults
        .map((result, i) => {
            if (result.status === 'fulfilled' && result.value) {
                const movieData = result.value as any;
                const baseName = movieData.movieName || movieFileIds[i] + '.mp4';
                const newMovieName = appendSuffixToFileName(baseName, '_copy');
                return googleFunctionService.createCall<any>("MovieService.saveMovie", { movieName: newMovieName, data64: movieData })
                    .withTimeout(20000)
                    .withRetryCount(1)
                    .withSuccessed(saveResult => {
                        console.log(`[MovieService.saveMovie]`, saveResult);
                    })
                    .withFailuered(message => {
                        console.error(`[MovieService.saveMovie] failed`, message);
                    });
            }
            return null;
        })
        .filter((x): x is ReturnType<typeof googleFunctionService.createCall> => x !== null);
    const movieSaveResults = await googleFunctionService.all(...movieSaveCalls);


    const movieUpdateCalls = movieSaveResults
        .map((result, i) => {
            if (
                result.status === 'fulfilled' &&
                result.value &&
                (result.value as any).movieId &&
                movieResults[i].status === 'fulfilled'
            ) {
                const movieData = movieResults[i].value as any;
                const saveResult = result.value as any;
                const baseName = movieData.movieName || movieFileIds[i] + '.mp4';
                const newMovieName = appendSuffixToFileName(baseName, '_copy_updated');
                return googleFunctionService.createCall<any>("MovieService.saveMovie", { movieId: saveResult.movieId, movieName: newMovieName, data64: movieData })
                    .withTimeout(20000)
                    .withRetryCount(1)
                    .withSuccessed(updateResult => {
                        console.log(`[MovieService.saveMovie: update]`, updateResult);
                    })
                    .withFailuered(message => {
                        console.error(`[MovieService.saveMovie: update] failed`, message);
                    });
            }
            return null;
        })
        .filter((x): x is ReturnType<typeof googleFunctionService.createCall> => x !== null);
    await googleFunctionService.all(...movieUpdateCalls);
}
