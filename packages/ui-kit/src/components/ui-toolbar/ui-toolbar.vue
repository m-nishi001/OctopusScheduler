<template>
    <div class="ui-toolbar" role="toolbar"><slot /></div>
</template>

<style scoped>
.ui-toolbar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--ui-space-2, 8px);
    margin-bottom: var(--ui-space-3, 12px);
}

/* 末尾に寄せたい要素(件数表示など)は margin-left:auto を付ける */
.ui-toolbar > :deep(.ui-toolbar__spacer) {
    margin-left: auto;
}
</style>
