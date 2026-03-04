export interface Settings {
    launchOnStartup: boolean
    maxHistorySize: number
    autoCloseOnSelect: boolean
    maxImageSize: number
    maxTextSize: number
}

export const defaultSettings: Settings = {
    launchOnStartup: true,
    maxHistorySize: 20,
    autoCloseOnSelect: true,
    maxImageSize: 0,  // 0 means disabled (no limit)
    maxTextSize: 0,   // 0 means disabled (no limit)
}
