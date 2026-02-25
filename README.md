# ConflictGuard

Telegram-бот для анализа тона сообщений в чатах в реальном времени: оценивает уровень вежливости/риска конфликта и отправляет **приватные алерты менеджерам**, когда риск растёт до эскалации.

Стек: **Next.js** (App Router, TypeScript).

## Возможности

- Приём сообщений из Telegram через **Webhook**
- Анализ текста по словарям «острых» и «смягчающих» слов → `riskScore` (0–100) и `riskLevel` (LOW / MEDIUM / HIGH)
- При **HIGH** — отправка приватного уведомления каждому менеджеру с текстом сообщения и рекомендацией
- **Панель** `/dashboard`: список последних алертов и фильтр по уровню риска

## Быстрый старт

1. Установка зависимостей уже выполнена (`npm install`).

2. Скопируйте переменные окружения:
   ```bash
   cp .env.example .env.local
   ```
   Заполните в `.env.local`:
   - `TELEGRAM_BOT_TOKEN` — токен от [@BotFather](https://t.me/BotFather)
   - `MANAGER_IDS` — ID пользователей Telegram менеджеров через запятую (например, `12345,67890`). Узнать свой ID можно через [@userinfobot](https://t.me/userinfobot).

3. Запуск:
   ```bash
   npm run dev
   ```
   Откройте [http://localhost:3000](http://localhost:3000). Панель алертов: [http://localhost:3000/dashboard](http://localhost:3000/dashboard).

4. Настройка Webhook (нужен публичный HTTPS-URL):
   - Локально: например, [ngrok](https://ngrok.com): `ngrok http 3000`, затем подставьте `https://ВАШ_ДОМЕН/api/telegram/webhook`.
   - Установка webhook (один раз):
     ```bash
     curl "https://api.telegram.org/bot<ВАШ_ТОКЕН>/setWebhook?url=https://ВАШ_ДОМЕН/api/telegram/webhook"
     ```

5. Добавьте бота в тестовый чат и отправьте сообщения. «Острые» фразы (из словаря в `lib/conflictAnalyzer.ts`) поднимут риск; при HIGH менеджеры получат личное сообщение от бота.

## Структура проекта

- `app/api/telegram/webhook/route.ts` — приём обновлений от Telegram
- `app/api/alerts/route.ts` — API для панели (список алертов)
- `lib/conflictAnalyzer.ts` — анализ текста, riskScore / riskLevel
- `lib/notifications.ts` — отправка приватных сообщений менеджерам
- `lib/alertsStore.ts` — in-memory хранилище алертов
- `lib/config.ts` — конфиг из env (токен, MANAGER_IDS)
- `app/dashboard/page.tsx` — страница мониторинга алертов

## Критерии приёмки

- Бот получает сообщения чата через Webhook и обрабатывает их в Next.js
- Анализатор классифицирует сообщения по LOW / MEDIUM / HIGH
- При HIGH бот отправляет приватный алерт хотя бы одному менеджеру
- `/dashboard` показывает последние алерты и фильтр по уровню риска
- Код разбит по модулям, типы TypeScript

## Дополнительно (по желанию)

- БД (SQLite + Prisma) для хранения алертов
- Авторизация на `/dashboard`
- Учёт контекста (серия сообщений, частота конфликтов от автора)
- Разные тексты рекомендаций в зависимости от riskLevel
