import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-zinc-950">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-center gap-8 px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          ConflictGuard
        </h1>
        <p className="max-w-md text-center text-lg text-zinc-600 dark:text-zinc-400">
          Telegram-бот для анализа тона сообщений в чатах и приватных алертов менеджерам при росте риска конфликта.
        </p>
        <Link
          href="/dashboard"
          className="rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-6 py-3 font-medium hover:opacity-90 transition-opacity"
        >
          Открыть панель алертов
        </Link>
      </main>
    </div>
  );
}
