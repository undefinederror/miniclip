/// <reference types="vite/client" />

interface Window {
    electronAPI: {
        onClipboardChange: (callback: (text: string) => void) => () => void
        onSettingsChanged: (callback: () => void) => () => void
        getHistory: () => Promise<{ id: number; content: string; timestamp: string }[]>
        copyToClipboard: (text: string) => Promise<void>
        deleteHistoryItem: (id: number) => Promise<void>
        hideWindow: () => Promise<void>
        minimizeWindow: () => Promise<void>
        closeWindow: () => Promise<void>
        getSettings: () => Promise<{ launchOnStartup: boolean; maxHistorySize: number; autoCloseOnSelect: boolean; globalShortcut: string }>
        setSettings: (settings: { launchOnStartup: boolean; maxHistorySize: number; autoCloseOnSelect: boolean; globalShortcut: string }) => Promise<void>
        onWindowHidden: (callback: () => void) => () => void
    }
}
