export interface Settings {
    firstLaunch: boolean
    launchOnStartup: boolean
    maxHistorySize: number
    autoCloseOnSelect: boolean
    maxImageSize: number
    maxTextSize: number
}

export const defaultSettings: Settings = {
    firstLaunch: true,
    launchOnStartup: true,
    maxHistorySize: 20,
    autoCloseOnSelect: true,
    maxImageSize: 0,  // 0 means disabled (no limit)
    maxTextSize: 0,   // 0 means disabled (no limit)
}
