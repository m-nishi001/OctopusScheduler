<template>
    <div class="roulette-container" :class="{ spinning }" tabindex="0" @keydown.enter="enterHandler">
        <canvas ref="canvas" width="500" height="500"></canvas>
        <div class="indicator">▼</div>
        <div v-if="showResult" class="result">{{ selectedPrize?.name }}</div>
    </div>
</template>

<script lang="ts">
import { defineComponent, computed, onMounted } from 'vue';
import { useRouletteAnimation, type RouletteItem, type RouletteAnimationProps } from './roulette-animation-logic';
import { useRouletteAnimationState } from '../prize-animation-state';
import { container } from 'tsyringe';
import { AssetDataService } from '@model/applications/asset/asset-data-service';
import type { PrizeDto } from '@model/applications/prize/dto/prize-dto';

export default defineComponent({
    name: 'RouletteAnimation',
    props: {
        prizes: { type: Array as () => PrizeDto[], default: () => [] },
        selectedPrize: { type: Object as () => PrizeDto, required: true },
        showResult: { type: Boolean, default: false },
    },
    setup(props, { emit }) {
        const assetService = container.resolve(AssetDataService);

        const {
            selectedPrize: stateSelectedPrize,
            showResult: stateShowResult,
            preparedPrizes: statePreparedPrizes,
            canStop: stateCanStop,
            updatePrizes: stateUpdatePrizes,
            setCanStop,
        } = useRouletteAnimationState(
            props.prizes,
            props.selectedPrize,
            props.showResult,
            assetService
        );

        const rouletteProps: RouletteAnimationProps = {
            prizes: statePreparedPrizes.value,
            selectedPrize: stateSelectedPrize.value ? ({ id: stateSelectedPrize.value.id, name: stateSelectedPrize.value.name, imageUrl: undefined } as RouletteItem) : null,
            showResult: stateShowResult.value,
        };

        const { canvas, startSpin, stopSpin: logicStopSpin, spinning, updatePrizes: logicUpdatePrizes } = useRouletteAnimation(
            rouletteProps
        );

        const stopSpin = async (durationSec?: number, targetPrizeId?: string | null) => {
            const result = await logicStopSpin(durationSec, targetPrizeId);
            await new Promise<void>((resolve) => setTimeout(resolve, 1000));
            emit('stopped', result);
            return result;
        };

        onMounted(async () => {
            try {
                await stateUpdatePrizes(props.prizes);
                await logicUpdatePrizes(statePreparedPrizes.value);
            } catch (e) {
                console.warn('Failed to update prizes on roulette hook', e);
            }
        });

        const handleStart = () => {
            startSpin();
            setCanStop(false);
            setTimeout(() => {
                setCanStop(true);
            }, 1000);
        };

        const handleStop = () => {
            if (stateCanStop.value) {
                stopSpin(undefined, props.selectedPrize.id);
                setCanStop(false);
            }
        };

        const enterHandler = computed(() => (spinning.value ? handleStop : handleStart));

        return {
            canvas, startSpin, stopSpin, spinning, enterHandler, preparedPrizes: statePreparedPrizes
        };
    }
});
</script>

<style scoped>
.roulette-container {
    position: relative;
    display: inline-block;
    background: radial-gradient(circle, #000 0%, #800000 50%, #FFD700 100%);
    padding: 30px;
    border-radius: 20px;
    box-shadow: 0 0 50px rgba(255, 215, 0, 0.8), inset 0 0 50px rgba(0, 0, 0, 0.5);
    border: 5px solid #FFD700;
}

canvas {
    border: 8px solid #FFD700;
    border-radius: 50%;
    box-shadow: 0 0 30px rgba(255, 215, 0, 0.8), 0 0 60px rgba(255, 0, 0, 0.5), 0 0 90px rgba(0, 0, 255, 0.3);
    animation: pulse 1s infinite;
    transition: box-shadow 0.3s ease;
}

.spinning canvas {
    animation: spinPulse 0.3s infinite;
}

@keyframes pulse {

    0%,
    100% {
        box-shadow: 0 0 30px rgba(255, 215, 0, 0.8), 0 0 60px rgba(255, 0, 0, 0.5), 0 0 90px rgba(0, 0, 255, 0.3);
    }

    50% {
        box-shadow: 0 0 50px rgba(255, 215, 0, 1), 0 0 80px rgba(255, 0, 0, 0.8), 0 0 120px rgba(0, 0, 255, 0.5);
    }
}

@keyframes spinPulse {

    0%,
    100% {
        box-shadow: 0 0 50px rgba(255, 215, 0, 1), 0 0 80px rgba(255, 0, 0, 0.8), 0 0 120px rgba(0, 0, 255, 0.5);
        transform: scale(1);
    }

    50% {
        box-shadow: 0 0 70px rgba(255, 215, 0, 1.2), 0 0 100px rgba(255, 0, 0, 1), 0 0 150px rgba(0, 0, 255, 0.7);
        transform: scale(1.02);
    }
}

.indicator {
    position: absolute;
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 40px;
    color: #FFD700;
    text-shadow: 0 0 20px #FFD700, 0 0 40px #FF4500, 0 0 60px #FFD700;
    animation: indicatorGlow 1.5s infinite;
}

@keyframes indicatorGlow {

    0%,
    100% {
        text-shadow: 0 0 20px #FFD700, 0 0 40px #FF4500, 0 0 60px #FFD700;
    }

    50% {
        text-shadow: 0 0 30px #FFD700, 0 0 60px #FF4500, 0 0 90px #FFD700;
    }
}

.result {
    position: absolute;
    bottom: 10px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 28px;
    color: #FFD700;
    font-weight: bold;
    text-shadow: 0 0 15px #FFD700, 0 0 30px #FF4500;
    background: rgba(0, 0, 0, 0.8);
    padding: 10px 20px;
    border-radius: 10px;
    border: 2px solid #FFD700;
    box-shadow: 0 0 20px rgba(255, 215, 0, 0.8);
    animation: resultPop 0.5s ease-out;
}

@keyframes resultPop {
    0% {
        transform: translateX(-50%) scale(0);
        opacity: 0;
    }

    100% {
        transform: translateX(-50%) scale(1);
        opacity: 1;
    }
}
</style>
