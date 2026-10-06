// 24x24 stroke アイコン。追加する場合はここへ path を足すだけでよい。
export const UI_ICON_PATHS = {
    add: ['M12 5v14', 'M5 12h14'],
    edit: ['M12 20h9', 'M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z'],
    delete: ['M3 6h18', 'M8 6V4h8v2', 'M19 6l-1 14H6L5 6', 'M10 11v6', 'M14 11v6'],
    upload: ['M12 16V4', 'M7 9l5-5 5 5', 'M5 20h14'],
    download: ['M12 4v12', 'M7 11l5 5 5-5', 'M5 20h14'],
    restore: ['M3 12a9 9 0 1 0 3-6.7', 'M3 4v5h5'],
    home: ['M3 11l9-8 9 8', 'M5 10v10h14V10'],
    sync: ['M21 12a9 9 0 0 1-15.5 6.2', 'M3 12A9 9 0 0 1 18.5 5.8', 'M21 4v5h-5', 'M3 20v-5h5'],
    close: ['M6 6l12 12', 'M18 6L6 18'],
    check: ['M5 12l5 5 9-10'],
    play: ['M7 4l13 8-13 8Z'],
    file: ['M14 3H6v18h12V7Z', 'M14 3v4h4'],
} as const;

export type UiIconName = keyof typeof UI_ICON_PATHS;
