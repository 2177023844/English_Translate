interface StartScreenProps {
  icon: string
  module: string
  onStart: () => void
}

/** 模块开始界面：今日还未开始 XX，点击开始今日 XX 之旅 */
export default function StartScreen({ icon, module, onStart }: StartScreenProps) {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-13rem)] max-w-md flex-col items-center justify-center py-16 text-center">
      <div className="text-6xl">{icon}</div>
      <h2 className="mt-6 text-3xl font-bold text-slate-800">今日还未开始{module}</h2>
      <p className="mt-3 text-slate-500">坚持每日{module}，积少成多 💪</p>
      <button
        type="button"
        onClick={onStart}
        className="mt-8 rounded-xl bg-indigo-600 px-8 py-3 text-base font-medium text-white transition-colors hover:bg-indigo-700"
      >
        开始今日{module}之旅 →
      </button>
    </div>
  )
}
