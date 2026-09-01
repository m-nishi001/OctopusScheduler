<template>
    <div class="opening-html">
        <div class="html-content" v-html="contentHtml"></div>
    </div>
</template>

<script lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import { useRouter } from 'vue-router';

export default {
    name: 'OpeningHtml',
    props: {
        element: { type: Object, required: true },
        bgm: { type: null, required: false }
    },
    setup(props: any) {
        const router = useRouter();
        const contentHtml = ref('');

        const escapeHtml = (str: string) =>
            str
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');

        onMounted(async () => {
            const raw = props.element.content || '';
            const hasHtmlTag = /<[^>]+>/.test(raw);
            contentHtml.value = hasHtmlTag ? raw : `<div class="centered-html">${escapeHtml(raw).replace(/\n/g, '<br/>')}</div>`;

            await nextTick();
            const htmlContainer = document.querySelector('.html-content') as HTMLElement | null;
            const waitForImagesIn = (el: HTMLElement | null) =>
                new Promise<void>((resolve) => {
                    if (!el) return resolve();
                    const imgs = Array.from(el.querySelectorAll('img')) as HTMLImageElement[];
                    if (imgs.length === 0) return resolve();
                    let remaining = imgs.length;
                    imgs.forEach((img) => {
                        if (img.complete) {
                            remaining -= 1;
                            if (remaining === 0) resolve();
                        } else {
                            img.addEventListener('load', () => {
                                remaining -= 1;
                                if (remaining === 0) resolve();
                            });
                            img.addEventListener('error', () => {
                                remaining -= 1;
                                if (remaining === 0) resolve();
                            });
                        }
                    });
                });

            await waitForImagesIn(htmlContainer);

            const durationMs = props.element.animation?.duration || 3000;
            setTimeout(() => {
                props.bgm?.pause();
                router.push('/jackpot-description');
            }, durationMs);
        });

        onUnmounted(() => { });

        return { contentHtml };
    }
};
</script>

<style scoped>
.html-content {
    width: 100vw;
    height: 100vh;
    overflow: auto
}

.centered-html {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    width: 100%;
    color: #fff;
    text-align: center;
    font-size: 2em
}
</style>
