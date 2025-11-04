<template>
    <aside class="admin-sidebar">
        <nav>
            <ul>
                <li>
                    <button class="menu-link" :class="{ active: props.currentTab === 'events' }"
                        @click="setTab('events')">
                        <span class="icon">📅</span> イベント管理
                    </button>
                </li>
                <li>
                    <button class="menu-link" :class="{ active: props.currentTab === 'assets' }"
                        @click="setTab('assets')">
                        <span class="icon">📁</span> アセット管理
                    </button>
                </li>
                <li>
                    <button class="menu-link" :class="{ active: props.currentTab === 'keyboard-shortcuts' }"
                        @click="setTab('keyboard-shortcuts')">
                        <span class="icon">⌨️</span> キーボードショートカット設定
                    </button>
                </li>
                <li>
                    <button class="menu-link" @click="goHome">
                        <span class="icon">🏠</span> ホームへ
                    </button>
                </li>
            </ul>
        </nav>
    </aside>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';

interface Props {
    currentTab: string;
}

const props = defineProps<Props>();

const router = useRouter();

const emit = defineEmits<{
    tabChange: [tab: string];
}>();

const setTab = (tab: string) => {
    emit('tabChange', tab);
};

const goHome = () => router.push({ name: 'home' });
</script>

<style scoped>
.admin-sidebar {
    width: 220px;
    background: #222731;
    color: #fff;
    padding: 16px 0;
    align-self: stretch;
    min-height: 0;
    box-shadow: 2px 0 8px rgba(0, 0, 0, 0.04);
    display: flex;
    flex-direction: column;
    align-items: flex-start;
}

.admin-sidebar ul {
    list-style: none;
    padding: 0;
    width: 100%;
}

.admin-sidebar li {
    margin: 12px 0;
}

.menu-link {
    display: flex;
    align-items: center;
    gap: 6px;
    color: #fff;
    text-decoration: none;
    font-weight: 500;
    padding: 10px 20px;
    border-radius: 12px;
    transition: background 0.2s, color 0.2s;
    background: none;
    border: none;
    width: 100%;
    text-align: left;
    cursor: pointer;
}

.menu-link:hover {
    background: #3a4660;
    color: #aee1ff;
}

.menu-link.active {
    background: linear-gradient(180deg, rgba(125, 95, 255, 0.18) 0%, rgba(174, 225, 255, 0.08) 100%);
    color: #e9e9ff;
    font-weight: 700;
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.02);
}
</style>