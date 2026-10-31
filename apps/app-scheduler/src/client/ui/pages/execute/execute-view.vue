<template>
    <div class="execute-screen">
        <div class="execute-content">
            <router-view />
        </div>
    </div>
</template>

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