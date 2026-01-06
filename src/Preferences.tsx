import { useEffect, useState } from 'react';

export default function Preferences() {
    const [settings, setSettings] = useState({
        launchOnStartup: true,
        maxHistorySize: 20,
        autoCloseOnSelect: true,
    });

    useEffect(() => {
        window.electronAPI.getSettings().then(setSettings);
    }, []);

    const handleChange = (key: string, value: any) => {
        const newSettings = { ...settings, [key]: value };
        setSettings(newSettings);
        window.electronAPI.setSettings(newSettings);
    };

    return (
        <div className="h-screen w-full bg-gnome-bg text-gnome-text p-4 font-sans select-none overflow-hidden flex flex-col">
            <header className="mb-6 flex items-center justify-center">
                <h1 className="text-lg font-bold">Preferences</h1>
            </header>

            <div className="flex-1 overflow-y-auto space-y-4">
                {/* General Section */}
                <div className="bg-gnome-surface border border-gnome-border/50 rounded-xl overflow-hidden shadow-sm">
                    {/* Launch on Startup */}
                    <div className="flex items-center justify-between p-4 border-b border-gnome-border/30 hover:bg-gnome-text/5 transition-colors">
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
                    <div className="flex items-center justify-between p-4 hover:bg-gnome-text/5 transition-colors">
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
                <div className="bg-gnome-surface border border-gnome-border/50 rounded-xl p-4 shadow-sm">
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
            </div>

            <footer className="mt-4 pb-2 text-center text-[10px] text-gnome-text-dim uppercase tracking-widest opacity-60 font-bold">
                Changes applied instantly
            </footer>
        </div>
    );
}
