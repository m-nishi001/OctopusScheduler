<template>
    <div class="ui-form-grid"><slot /></div>
</template>

<style scoped>
/* 2カラム(狭い画面では自動で1カラム)。項目を全幅にしたい場合は子に .ui-form-grid__full を付ける */
.ui-form-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 22rem), 1fr));
    column-gap: var(--ui-space-5, 24px);
    row-gap: var(--ui-space-3, 12px);
    min-width: 0;
}

.ui-form-grid > :deep(.ui-form-grid__full) {
    grid-column: 1 / -1;
}
</style>
