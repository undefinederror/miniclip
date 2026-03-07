import { useEffect, useState } from 'react';
import { defaultSettings } from './shared/settings';

export default function Preferences() {
    const [settings, setSettings] = useState({ ...defaultSettings });

    useEffect(() => {
        window.electronAPI.getSettings().then(setSettings);
    }, []);

    const handleChange = (key: string, value: any) => {
        const newSettings = { ...settings, [key]: value };
        setSettings(newSettings);
        window.electronAPI.setSettings(newSettings);
    };

    return (
        <div className="h-screen w-full bg-gnome-bg text-gnome-text p-3 font-sans select-none overflow-hidden flex flex-col">
            <div className="flex-1 overflow-y-auto space-y-2">
                {/* General Section */}
                <div className="bg-gnome-surface border border-gnome-border/50 rounded-xl overflow-hidden shadow-sm">
                    {/* Launch on Startup */}
                    <div className="flex items-center justify-between p-2 border-b border-gnome-border/30 hover:bg-gnome-text/5 transition-colors">
                        <div className="flex flex-col">
                            <span className="text-sm font-semibold">Launch on startup</span>
                            <span className="text-[11px] text-gnome-text-dim">Start automatically at login</span>
                        </div>
                        <input
                            type="checkbox"
                            checked={settings.launchOnStartup}
                            onChange={(e) => handleChange('launchOnStartup', e.target.checked)}
                            className="w-5 h-5 accent-gnome-accent rounded cursor-pointer"
                        />
                    </div>

                    {/* Autoclose on select */}
                    <div className="flex items-center justify-between p-2 hover:bg-gnome-text/5 transition-colors">
                        <div className="flex flex-col">
                            <span className="text-sm font-semibold">Autoclose on select</span>
                            <span className="text-[11px] text-gnome-text-dim">Hide window after copying</span>
                        </div>
                        <input
                            type="checkbox"
                            checked={settings.autoCloseOnSelect}
                            onChange={(e) => handleChange('autoCloseOnSelect', e.target.checked)}
                            className="w-5 h-5 accent-gnome-accent rounded cursor-pointer"
                        />
                    </div>
                </div>


                {/* History Section */}
                <div className="bg-gnome-surface border border-gnome-border/50 rounded-xl p-2 shadow-sm">
                    <div className="flex flex-col space-y-3">
                        <div className="flex flex-col">
                            <span className="text-sm font-semibold">Max history size</span>
                            <span className="text-[11px] text-gnome-text-dim">Maximum items to keep in session</span>
                        </div>
                        <div className="flex items-center space-x-4">
                            <input
                                type="range"
                                min="5"
                                max="100"
                                step="5"
                                value={settings.maxHistorySize}
                                onChange={(e) => handleChange('maxHistorySize', parseInt(e.target.value))}
                                className="flex-1 accent-gnome-accent h-1.5 bg-gnome-border/30 rounded-lg appearance-none cursor-pointer"
                            />
                            <span className="font-mono text-xs font-bold bg-gnome-border/20 px-2 py-1 rounded min-w-[32px] text-center">
                                {settings.maxHistorySize}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Text Section */}
                <div className="bg-gnome-surface border border-gnome-border/50 rounded-xl p-2 shadow-sm">
                    <div className="flex flex-col space-y-3">
                        <div className="flex flex-col">
                            <span className="text-sm font-semibold">Max text size</span>
                            <span className="text-[11px] text-gnome-text-dim">Maximum text size to save (0 = no limit)</span>
                        </div>
                        <div className="flex items-center space-x-4">
                            <input
                                type="range"
                                min="0"
                                max="5000"
                                step="100"
                                value={settings.maxTextSize}
                                onChange={(e) => handleChange('maxTextSize', parseInt(e.target.value))}
                                className="flex-1 accent-gnome-accent h-1.5 bg-gnome-border/30 rounded-lg appearance-none cursor-pointer"
                            />
                            <span className="font-mono text-xs font-bold bg-gnome-border/20 px-2 py-1 rounded min-w-[48px] text-center">
                                {settings.maxTextSize === 0 ? 'No limit' : `${settings.maxTextSize}KB`}
                            </span>
                        </div>
                    </div>
                </div>
                {/* Image Section */}
                <div className="bg-gnome-surface border border-gnome-border/50 rounded-xl p-2 shadow-sm">
                    <div className="flex flex-col space-y-3">
                        <div className="flex flex-col">
                            <span className="text-sm font-semibold">Max image size</span>
                            <span className="text-[11px] text-gnome-text-dim">Maximum image size to save (0 = no limit)</span>
                        </div>
                        <div className="flex items-center space-x-4">
                            <input
                                type="range"
                                min="0"
                                max="5000"
                                step="100"
                                value={settings.maxImageSize}
                                onChange={(e) => handleChange('maxImageSize', parseInt(e.target.value))}
                                className="flex-1 accent-gnome-accent h-1.5 bg-gnome-border/30 rounded-lg appearance-none cursor-pointer"
                            />
                            <span className="font-mono text-xs font-bold bg-gnome-border/20 px-2 py-1 rounded min-w-[48px] text-center">
                                {settings.maxImageSize === 0 ? 'No limit' : `${settings.maxImageSize}KB`}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <footer className="mt-4 pb-2 text-center text-[10px] text-gnome-text-dim uppercase tracking-widest opacity-60 font-bold">
                Changes applied instantly
            </footer>
        </div>
    );
}
