<template>
    <transition name="kakuhen-fade" @after-leave="onAfterLeave">
        <div v-if="visible" ref="root" class="kakuhen-overlay-root" aria-hidden="true">
            <div class="kakuhen-dim" />
            <div class="kakuhen-content">
                <div class="kakuhen-text" role="presentation">
                    <span class="char char-1">だ</span><span class="char char-2">が</span>
                </div>
                <div class="kakuhen-ripple" />
            </div>
        </div>
    </transition>
</template>

<script lang="ts">
export default {
    name: 'KakuhenOverlay',
    props: {
        visible: {
            type: Boolean,
            required: true,
        },
    },
    mounted() {
        // If the overlay is already visible at mount, schedule attaching listeners.
        if ((this as any).visible) {
            // Defer to attach function which will use $nextTick.
            (this as any)._attachKakuhenListeners && (this as any)._attachKakuhenListeners();
        }
    },
    watch: {
        visible(v: boolean) {
            if (v) {
                try {
                    (this as any)._attachKakuhenListeners && (this as any)._attachKakuhenListeners();
                } catch (e) {
                    // noop
                }
            }
        }
    },
    methods: {
        async _attachKakuhenListeners() {
            if ((this as any)._kakuhen_attached) return;
            (this as any)._kakuhen_attached = true;

            await (this as any).$nextTick();

            const el = (this as any).$refs.root as HTMLElement | null;
            const dispatchFinished = (_source = 'unknown') => {
                try {
                    if ((this as any)._kakuhen_dispatched) return;
                    (this as any)._kakuhen_dispatched = true;
                    // dispatch finished (production: no debug log)
                    window.dispatchEvent(new CustomEvent('kakuhen.finished'));
                } catch (e) {
                    // noop
                }
            };

            // Respect reduced-motion: immediately dispatch finished.
            if (
                typeof window !== 'undefined' &&
                window.matchMedia &&
                window.matchMedia('(prefers-reduced-motion: reduce)').matches
            ) {
                dispatchFinished('reduced-motion');
                return;
            }

            if (!el) {
                // fallback: small timeout — tag the source so diagnostics show why we fired
                (this as any)._kakuhen_timer = window.setTimeout(() => {
                    dispatchFinished('no-el');
                }, 1200);
                return;
            }

            // Attach listener to the second character (.char-2) so we dispatch
            // `kakuhen.finished` precisely when the last character's animation ends.
            const char2 = el.querySelector('.char-2');
            if (char2) {
                    const onChar2End = (_ev: AnimationEvent) => {
                    dispatchFinished('char2');
                    (char2 as Element).removeEventListener('animationend', onChar2End as EventListener);
                };
                char2.addEventListener('animationend', onChar2End as EventListener);
                (this as any)._kakuhen_char2_onend = onChar2End;
                (this as any)._kakuhen_char2 = char2;
                // attached char2 animationend listener

                // Also try to detect ongoing animations via the Web Animations API.
                try {
                    const el2 = char2 as HTMLElement;
                    if (typeof el2.getAnimations === 'function') {
                        const anims = el2.getAnimations();
                        // char2.getAnimations.length: ${anims.length}
                        if (anims.length > 0) {
                            // Wait for any of the animations to finish (race) and then dispatch.
                            const finishedPromises = anims.map((a) => a.finished);
                            Promise.race(finishedPromises)
                                .then(() => {
                                    dispatchFinished('char2-promise');
                                })
                                .catch(() => {
                                    // ignore
                                });
                        } else {
                            // No animations found on the element — probably already visible.
                            Promise.resolve().then(() => dispatchFinished('char2-none'));
                        }
                    }
                } catch (e) {
                    // ignore failures from getAnimations in older browsers
                }
            }

            // Keep ripple as a secondary fallback (some render scenarios may not fire
            // char animations reliably). It will dispatch only if char2 doesn't.
            const ripple = el.querySelector('.kakuhen-ripple');
            if (ripple) {
                const onEnd = () => {
                    // If char2 exists (likely animating), defer dispatch so char2 can finish.
                    if ((this as any)._kakuhen_char2) {
                        const prev = (this as any)._kakuhen_ripple_timer;
                        if (prev) {
                            clearTimeout(prev);
                        }
                        (this as any)._kakuhen_ripple_timer = window.setTimeout(() => {
                            dispatchFinished('ripple');
                        }, 200);
                    } else {
                        // No char2 — dispatch immediately.
                        dispatchFinished('ripple');
                    }

                    ripple.removeEventListener('animationend', onEnd as EventListener);
                };
                ripple.addEventListener('animationend', onEnd as EventListener);
                (this as any)._kakuhen_onend = onEnd;
                (this as any)._kakuhen_ripple = ripple;
            } else {
                // no ripple found: fallback to timeout slightly longer than char animations
                (this as any)._kakuhen_timer = window.setTimeout(() => {
                    dispatchFinished('fallback');
                }, 2000);
            }
        },
        onAfterLeave() {
            try {
                window.dispatchEvent(new CustomEvent('kakuhen.dismissed'));
            } catch (e) {
                // noop
            }
        },
    },
    unmounted() {
        try {
            const onEnd = (this as any)._kakuhen_onend;
            const ripple = (this as any)._kakuhen_ripple;
            if (ripple && onEnd) {
                ripple.removeEventListener('animationend', onEnd as EventListener);
            }

            const char2OnEnd = (this as any)._kakuhen_char2_onend;
            const char2El = (this as any)._kakuhen_char2;
            if (char2El && char2OnEnd) {
                try {
                    char2El.removeEventListener('animationend', char2OnEnd as EventListener);
                } catch (e) {
                    // noop
                }
            }

            const t = (this as any)._kakuhen_timer;
            if (t) {
                clearTimeout(t);
            }

            const rt = (this as any)._kakuhen_ripple_timer;
            if (rt) {
                clearTimeout(rt);
            }
        } catch (e) {
            // noop
        }
    },
};
</script>

<style>
:root {
    --k-text-color: #ff3232;
    --k-glow: 0 0 40px rgba(255, 50, 50, 0.85);
}

.kakuhen-overlay-root {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 20000;
    pointer-events: none;
}

.kakuhen-dim {
    position: absolute;
    inset: 0;
    background: #000;
    opacity: 0.0;
    animation: dimIn 240ms ease-out forwards;
}

.kakuhen-content {
    position: relative;
    pointer-events: none;
    display: flex;
    align-items: center;
    justify-content: center;
}

.kakuhen-text {
    font-family: 'Noto Sans JP', system-ui, -apple-system, 'Hiragino Kaku Gothic ProN', 'Hiragino Kaku Gothic Pro', 'メイリオ', meiryo, sans-serif;
    font-weight: 900;
    color: var(--k-text-color);
    font-size: 18vw;
    /* very large, scales with viewport */
    line-height: 1;
    letter-spacing: 0.02em;
    text-align: center;
    text-shadow: var(--k-glow), 0 6px 18px rgba(0, 0, 0, 0.6);
    transform-origin: center center;
}

.kakuhen-text .char {
    display: inline-block;
    opacity: 0;
    transform: scale(0.6);
}

.kakuhen-text .char-1 {
    animation: charPop 360ms cubic-bezier(.2, .9, .2, 1) forwards;
}

.kakuhen-text .char-2 {
    animation: charPunch 420ms cubic-bezier(.12, .9, .2, 1) forwards;
    /* increased gap between 'だ' and 'が' for a more dramatic reveal */
    animation-delay: 520ms;
}

.kakuhen-ripple {
    position: absolute;
    width: 28vw;
    height: 28vw;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255, 80, 80, 0.12), rgba(255, 80, 80, 0.02));
    filter: blur(10px);
    opacity: 0;
    animation: ripplePulse 900ms ease-out forwards;
}

/* Fade transition for hiding the overlay */
.kakuhen-fade-leave-active {
    transition: opacity 1s ease;
}

.kakuhen-fade-leave-to {
    opacity: 0;
}

@keyframes dimIn {
    from {
        opacity: 0;
    }

    to {
        opacity: 0.72;
    }
}

@keyframes charPop {
    0% {
        transform: scale(0.6);
        opacity: 0;
    }

    40% {
        transform: scale(1.6);
        opacity: 1;
    }

    65% {
        transform: scale(0.95);
    }

    100% {
        transform: scale(1);
        opacity: 1;
    }
}

@keyframes charPunch {
    0% {
        transform: scale(0);
        opacity: 0;
    }

    40% {
        transform: scale(2.0);
        opacity: 1;
    }

    70% {
        transform: scale(0.9);
    }

    100% {
        transform: scale(1);
        opacity: 1;
    }
}

@keyframes ripplePulse {
    0% {
        transform: scale(0.2);
        opacity: 0.65;
    }

    60% {
        transform: scale(1.6);
        opacity: 0.18;
    }

    100% {
        transform: scale(2.4);
        opacity: 0;
    }
}

/* Respect reduced motion */
@media (prefers-reduced-motion: reduce) {
    .kakuhen-dim {
        animation: none;
        opacity: 0.72;
    }

    .kakuhen-text .char {
        animation: none;
        opacity: 1;
        transform: none;
    }

    .kakuhen-ripple {
        animation: none;
        opacity: 0;
    }
}
</style>