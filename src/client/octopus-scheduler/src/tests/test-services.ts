import { GasFunctionService } from '/root/google_apps_script/octopus-scheduler/src/client/packages/common-lib/src/google-apps-script/gas-script-service.ts';

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

    // Audio Service
    async function getAudio(audioId: string) {
        return new Promise<any>((resolve) => {
            googleFunctionService
                .createCall<any>("AudioService.getAudio", audioId)
                .withTimeout(20000)
                .withRetryCount(1)
                .withSuccessed(audio => resolve(audio))
                .withFailuered(message => {
                    console.error(`[AudioService.getAudio] failed`, message);
                    resolve(null);
                })
                .invoke();
        });
    }
    async function saveAudio(audioName: string, data64: string) {
        return new Promise<any>((resolve) => {
            googleFunctionService
                .createCall<any>("AudioService.saveAudio", { audioName, data64 })
                .withTimeout(20000)
                .withRetryCount(1)
                .withSuccessed(result => resolve(result))
                .withFailuered(message => {
                    console.error(`[AudioService.saveAudio] failed`, message);
                    resolve(null);
                })
                .invoke();
        });
    }
    async function updateAudio(audioId: string, audioName: string, data64: string) {
        return new Promise<any>((resolve) => {
            googleFunctionService
                .createCall<any>("AudioService.saveAudio", { audioId, audioName, data64 })
                .withTimeout(20000)
                .withRetryCount(1)
                .withSuccessed(result => resolve(result))
                .withFailuered(message => {
                    console.error(`[AudioService.saveAudio: update] failed`, message);
                    resolve(null);
                })
                .invoke();
        });
    }
    for (const audioId of audioFileIds) {
        const audio = await getAudio(audioId);
        console.log(`[AudioService.getAudio]`, audio);
        if (audio) {
            const newAudioName = audio.audioName + "_copy";
            const saveResult = await saveAudio(newAudioName, audio.data64);
            console.log(`[AudioService.saveAudio]`, saveResult);
            if (saveResult && saveResult.audioId) {
                const updateResult = await updateAudio(saveResult.audioId, newAudioName + "_updated", audio.data64);
                console.log(`[AudioService.saveAudio: update]`, updateResult);
            }
        }
    }

    // Image Service
    async function getImage(imageId: string) {
        return new Promise<any>((resolve) => {
            googleFunctionService
                .createCall<any>("ImageService.getImage", imageId)
                .withTimeout(20000)
                .withRetryCount(1)
                .withSuccessed(data => resolve(data))
                .withFailuered(message => {
                    console.error(`[ImageService.getImage] failed`, message);
                    resolve(null);
                })
                .invoke();
        });
    }
    async function saveImage(imageName: string, data64: string) {
        return new Promise<any>((resolve) => {
            googleFunctionService
                .createCall<any>("ImageService.saveImage", { imageName, data64 })
                .withTimeout(20000)
                .withRetryCount(1)
                .withSuccessed(result => resolve(result))
                .withFailuered(message => {
                    console.error(`[ImageService.saveImage] failed`, message);
                    resolve(null);
                })
                .invoke();
        });
    }
    async function updateImage(imageId: string, imageName: string, data64: string) {
        return new Promise<any>((resolve) => {
            googleFunctionService
                .createCall<any>("ImageService.saveImage", { imageId, imageName, data64 })
                .withTimeout(20000)
                .withRetryCount(1)
                .withSuccessed(result => resolve(result))
                .withFailuered(message => {
                    console.error(`[ImageService.saveImage: update] failed`, message);
                    resolve(null);
                })
                .invoke();
        });
    }
    for (const imageId of imageFileIds) {
        const imageData = await getImage(imageId);
        console.log(`[ImageService.getImage]`, imageData);
        if (imageData) {
            const newImageName = imageId + "_copy.png";
            const saveResult = await saveImage(newImageName, imageData);
            console.log(`[ImageService.saveImage]`, saveResult);
            if (saveResult && saveResult.imageId) {
                const updateResult = await updateImage(saveResult.imageId, newImageName + "_updated.png", imageData);
                console.log(`[ImageService.saveImage: update]`, updateResult);
            }
        }
    }

    // Movie Service
    async function getMovie(movieId: string) {
        return new Promise<any>((resolve) => {
            googleFunctionService
                .createCall<any>("MovieService.getMovie", movieId)
                .withTimeout(20000)
                .withRetryCount(1)
                .withSuccessed(data => resolve(data))
                .withFailuered(message => {
                    console.error(`[MovieService.getMovie] failed`, message);
                    resolve(null);
                })
                .invoke();
        });
    }
    async function saveMovie(movieName: string, data64: string) {
        return new Promise<any>((resolve) => {
            googleFunctionService
                .createCall<any>("MovieService.saveMovie", { movieName, data64 })
                .withTimeout(20000)
                .withRetryCount(1)
                .withSuccessed(result => resolve(result))
                .withFailuered(message => {
                    console.error(`[MovieService.saveMovie] failed`, message);
                    resolve(null);
                })
                .invoke();
        });
    }
    async function updateMovie(movieId: string, movieName: string, data64: string) {
        return new Promise<any>((resolve) => {
            googleFunctionService
                .createCall<any>("MovieService.saveMovie", { movieId, movieName, data64 })
                .withTimeout(20000)
                .withRetryCount(1)
                .withSuccessed(result => resolve(result))
                .withFailuered(message => {
                    console.error(`[MovieService.saveMovie: update] failed`, message);
                    resolve(null);
                })
                .invoke();
        });
    }
    for (const movieId of movieFileIds) {
        const movieData = await getMovie(movieId);
        console.log(`[MovieService.getMovie]`, movieData);
        if (movieData) {
            const newMovieName = movieId + "_copy.mp4";
            const saveResult = await saveMovie(newMovieName, movieData);
            console.log(`[MovieService.saveMovie]`, saveResult);
            if (saveResult && saveResult.movieId) {
                const updateResult = await updateMovie(saveResult.movieId, newMovieName + "_updated.mp4", movieData);
                console.log(`[MovieService.saveMovie: update]`, updateResult);
            }
        }
    }
}
