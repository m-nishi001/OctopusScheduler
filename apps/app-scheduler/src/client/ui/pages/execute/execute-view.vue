<template>
    <div class="execute-screen">
        <!-- execute tab now only responds to IAppEventDto messages (actionType/eventId) -->
        <div class="execute-content">
            <router-view />
        </div>
    </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { container } from 'tsyringe';
import { AppEventService } from '../../../applications/app-event/app-event-service';
import { eventBus } from '@octopus/client-common/events/event-bus';


const channel = new BroadcastChannel('octopus-control');

const handleMessage = async (event: MessageEvent) => {
    const data = event.data || {};

    // If message follows IAppEventDto shape: { actionType, eventId }
    if (data && typeof data.actionType === 'string') {
        // Global stopAll command from other tabs/windows -> stop local audio
        if (data.actionType === 'stopAll') {
            try {
                eventBus.emit('stopAudio');
            } catch {
                // ignore
            }
            return;
        }
        const actionType = data.actionType;
        const eventId = data.eventId || (data.payload && data.payload.eventId);

        if (eventId) {
            try {
                const service = container.resolve(AppEventService);
                const ev = await service.getEventById(String(eventId));
                if (ev) {
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
        }
    }
    // ignore other legacy message shapes
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
    position: relative;
}

.execute-content {
    width: 100vw;
    height: 100vh;
    position: relative;
    overflow: hidden;
}

/* Ensure the routed component (root element rendered by <router-view>) fills the container */
:deep(.execute-content > *) {
    display: block;
    width: 100%;
    height: 100%;
}
</style>