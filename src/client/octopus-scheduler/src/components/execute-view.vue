<template>
    <div class="execute-screen">
        <!-- execute tab now only responds to IAppEventDto messages (actionType/eventId) -->
    </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { container } from 'tsyringe';
import { AppEventService } from '../model/applications/app-event/app-event-service';
import { eventBus } from '../core/event-bus';


const channel = new BroadcastChannel('octopus-control');

const handleMessage = async (event: MessageEvent) => {
    const data = event.data || {};
    console.debug('[execute-view] received BroadcastChannel message', data);

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
}
</style>