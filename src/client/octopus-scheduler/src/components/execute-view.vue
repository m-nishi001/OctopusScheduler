<template>
    <div class="execute-screen">
        <div v-if="currentEvent.type === 'SHOW_IMAGE'" class="image-display">
            <img :src="currentEvent.payload.url" alt="Displayed Image" />
        </div>
        <!-- 他のイベントタイプも追加可能 -->
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { container } from 'tsyringe';
import { AppEventService } from '../model/applications/app-event/app-event-service';

const router = useRouter();

const currentEvent = ref<{ type: string; payload?: any }>({ type: '' });

const channel = new BroadcastChannel('octopus-control');

const handleMessage = async (event: MessageEvent) => {
    const data = event.data || {};
    console.debug('[execute-view] received BroadcastChannel message', data);

    // NAVIGATE events (legacy) cause the execute tab to navigate to the target game
    if (data.type === 'NAVIGATE' && data.payload && data.payload.target) {
        console.debug('[execute-view] NAVIGATE payload received', data.payload);
        const target = data.payload.target;
        if (target === 'jackpot') {
            router.push('/jackpot-home').catch(() => { });
        } else if (target === 'quiz') {
            router.push('/quiz-admin').catch(() => { });
        } else if (target === 'card') {
            router.push('/card-home').catch(() => { });
        }
        return;
    }

    // If message follows IAppEventDto shape: { actionType, eventId }
    if (data && typeof data.actionType === 'string') {
        const actionType = data.actionType;
        const eventId = data.eventId || (data.payload && data.payload.eventId);
        console.debug('[execute-view] detected IAppEventDto', { actionType, eventId });

        if (eventId) {
            try {
                const service = container.resolve(AppEventService);
                console.debug('[execute-view] resolving event by id', eventId);
                const ev = await service.getEventById(String(eventId));
                console.debug('[execute-view] lookup result for eventId', eventId, !!ev);
                if (ev) {
                    console.debug('[execute-view] executing event', { id: ev.id, type: ev.type, actionType });
                    if (actionType === 'start' || actionType === 'trigger') {
                        await ev.execute(true, true);
                    } else if (actionType === 'stop') {
                        await ev.execute(false, true);
                    }
                    return;
                }
            } catch (e) {
                console.error('Failed to resolve or execute app event', e);
            }
        } else {
            console.debug('[execute-view] IAppEventDto missing eventId');
        }
    }

    // otherwise treat as display event (e.g. legacy SHOW_IMAGE)
    currentEvent.value = data;
};

onMounted(() => {
    channel.addEventListener('message', handleMessage as any);
});

onUnmounted(() => {
    channel.removeEventListener('message', handleMessage as any);
    channel.close();
});
</script>

<style scoped>
.execute-screen {
    background: #000;
    width: 100vw;
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
}

.image-display img {
    max-width: 100%;
    max-height: 100%;
}
</style>