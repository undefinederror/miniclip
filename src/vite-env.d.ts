/// <reference types="vite/client" />

import type { Settings } from './shared/settings'

declare global {
    interface ClipboardItem {
        id: number;
        content: string;
        timestamp: string;
        image_data?: Buffer;
        content_type: 'text' | 'image';
        original_format?: string;
        content_size: number;
    }

    interface Window {
        electronAPI: {
            onClipboardChange: (callback: (text: string) => void) => () => void
            onSettingsChanged: (callback: () => void) => () => void
            getHistory: () => Promise<ClipboardItem[]>
            copyToClipboard: (itemId: number) => Promise<void>
            deleteHistoryItem: (id: number) => Promise<void>
            hideWindow: () => Promise<void>
            minimizeWindow: () => Promise<void>
            closeWindow: () => Promise<void>
            getSettings: () => Promise<Settings>
            setSettings: (settings: Settings) => Promise<void>
            onWindowHidden: (callback: () => void) => () => void
            getVersion: () => Promise<string>
            openExternal: (url: string) => Promise<void>
        }
    }
}

export { }
