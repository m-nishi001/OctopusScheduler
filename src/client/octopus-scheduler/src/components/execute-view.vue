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
import { AppEventService } from '../model/applications/app-event/app-event-service';
import { eventBus } from '../core/event-bus';


const channel = new BroadcastChannel('octopus-control');

const handleMessage = async (event: MessageEvent) => {
    const data = event.data || {};
    console.debug('[execute-view] received BroadcastChannel message', data, 'ts=', Date.now());

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
        console.debug('[execute-view] detected IAppEventDto', { actionType, eventId, ts: Date.now() });

        if (eventId) {
            try {
                const service = container.resolve(AppEventService);
                console.debug('[execute-view] resolving event by id', eventId, 'ts=', Date.now());
                const ev = await service.getEventById(String(eventId));
                console.debug('[execute-view] lookup result for eventId', eventId, !!ev, 'ts=', Date.now());
                if (ev) {
                    console.debug('[execute-view] executing event', { id: ev.id, type: ev.type, actionType, ts: Date.now() });
                    if (actionType === 'start' || actionType === 'trigger') {
                        console.debug('[execute-view] about to ev.execute start', ev.id, 'ts=', Date.now());
                        await ev.execute(true, true);
                        console.debug('[execute-view] ev.execute start returned', ev.id, 'ts=', Date.now());
                    } else if (actionType === 'stop') {
                        console.debug('[execute-view] about to ev.execute stop', ev.id, 'ts=', Date.now());
                        await ev.execute(false, true);
                        console.debug('[execute-view] ev.execute stop returned', ev.id, 'ts=', Date.now());
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
    position: relative;
}

.execute-content {
    width: 100vw;
    height: 100vh;
    position: relative;
    overflow: hidden;
}

/* Ensure the routed component (root element rendered by <router-view>) fills the container */
::v-deep .execute-content>* {
    display: block;
    width: 100%;
    height: 100%;
}
</style>