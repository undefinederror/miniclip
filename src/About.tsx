export default function About() {
  return (
    <div className="h-screen w-full bg-gnome-bg text-gnome-text p-6 font-sans select-none overflow-hidden flex flex-col justify-between">
      <header className="mb-8 flex flex-col items-center">
        <img
          src="icon.png"
          alt="Miniclip"
          className="w-20 h-20 rounded-2xl mb-4"
        />
        <h1 className="text-2xl font-bold">Miniclip</h1>
        <p className="text-sm text-gnome-text-dim">Version {import.meta.env.VITE_APP_VERSION}</p>
      </header>

      <div className="space-y-4">
        <div className="flex flex-col">
          <span className="text-sm font-semibold">Author</span>
          <div
            onClick={() => window.electronAPI.openExternal('https://github.com/undefinederror/miniclip')}
            className="flex items-center gap-2 group cursor-pointer"
          >
            <span className="text-[13px] text-gnome-text-dim group-hover:text-gnome-accent">
              undefinederror (l.paci)
            </span>
            <div className="relative w-12 h-4">
              
              <img className="block absolute bottom-1/2 translate-y-1/2 left-0 h-5 w-auto" src="github.svg" height="32" width="32" />
            </div>
          </div>
        </div>

        <div className="flex flex-col">
          <span className="text-sm font-semibold">License</span>
          <span className="text-[13px] text-gnome-text-dim">
            GPL-3.0-only
          </span>
        </div>

        <div className="flex flex-col">
          <span className="text-sm font-semibold">Built with</span>
          <span className="text-[13px] text-gnome-text-dim">
            React · TypeScript · Vite · Electron · Tailwind CSS
          </span>
        </div>
      </div>
    </div>
  );
}
