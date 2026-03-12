ConflictGuard 🚨
Real-time Telegram Chat Moderation Bot
AI-powered profanity, insult & conflict detection for Telegram groups. Production ready.

📋 Project Description
ConflictGuard monitors Telegram chats **real-time** and detects:
**Profanity**: → 65-95 points
**Insults**: fool, idiot → 15-60 points  
**Threats**: kill, stab → 70-95 points
**Conflicts**: fight, war → 25-50 points

**Three alert levels:**
**LOW (>15%)** → monitoring chat
**MEDIUM (>50%)** → monitoring chat  
**HIGH (>75%)** → monitoring + admins

🛠 Tech Stack
Frontend: **Next.js 14** (App Router) + TypeScript
Backend: **Next.js API Routes** (Serverless)
**Deployment**: Vercel (zero-config)
**Database**: PostgreSQL-ready (addStat hook)
**Detection**: Custom tokenizer (no regex)
**Styling**: Telegram Markdown
**Hosting**: Vercel / Cloudflare Workers

🚀 Installation
1. **Create Next.js Project**
npx create-next-app@latest conflictguard --typescript --tailwind --app --eslint --no-src-dir
cd conflictguard

2. **Install Dependencies**
npm install

3. **Create Project Structure**
conflictguard/
├── app/
│   └── api/webhook/route.ts     # Main bot logic
├── lib/
│   └── stats.ts                # Statistics (extend for DB)
├── .env.local                  # Environment variables
├── next.config.js
└── README.md

▶️ Running Locally
**Development Mode**
npm run dev
# Available at http://localhost:3000/api/webhook

**Production Build**
npm run build
npm start

**Testing with ngrok**
ngrok http 3000
# Use ngrok URL for webhook: https://abc123.ngrok.io/api/webhook

🌐 Deployment
**Vercel (Recommended)**
npm i -g vercel
vercel --prod

**Set Telegram Webhook**
curl -X POST "https://api.telegram.org/bot$TELEGRAM_TOKEN/setWebhook" \
  -d "url=https://your-project.vercel.app/api/webhook"

**Verify Webhook**
curl "https://api.telegram.org/bot$TELEGRAM_TOKEN/getWebhookInfo"

Usage Examples
**1. Basic Setup**
1. Add bot to target group as **admin**
2. Forward any message to @userinfobot → get **CHAT_ID**
3. Set **TELEGRAM_CHAT_ID** = your monitoring group
4. Deploy → bot starts monitoring **instantly**

**2. Notification Examples**
**LOW Risk (monitoring only):**
🔍 CONFLICTGUARD LOW
👤 ekatherin  
the fool
⚡ 25 / 25%
📊 fool ×1 (25)
⚠️LOW

⚙️ Configuration
**TELEGRAM_TOKEN**	✅	Bot token 
**TELEGRAM_CHAT_ID**	✅	Monitoring group ID	
**ADMIN_CHAT_IDS**	✅	Admin user IDs	

📊 Scoring Algorithm
1. Tokenize text → ["fool"]
2. Match dictionary → fool(25) = 25 points
3. Add bonuses:
   - CAPS (AAA): +12 points
   - Punctuation (!!): +10 points
4. Cap at 100% → Show: 100 / 100%
**Dictionary (50+ words):**

🔧 Extending the Bot
**1. Add New Words**
const BAD_WORDS = {
  "new_word": 45,  // Add to dictionary
  "another": 60
};

**2. Database Integration**
// lib/stats.ts
export async function addStat(text: string, score: number) {
  await db.conflicts.create({
    data: { text, score, chatId, timestamp: new Date() }
  });
}

**3. Custom Thresholds**
const LOW_THRESHOLD = 10;  // Instead of 15
const ADMIN_THRESHOLD = 60; // Instead of 75

🧪 Development Workflow
# 1. Edit route.ts
# 2. Test locally
npm run dev

# 3. Test webhook with ngrok  
curl -X POST "https://api.telegram.org/bot$TOKEN/setWebhook?url=https://ngrok-url.ngrok.io/api/webhook"

# 4. Push & deploy
git add . && git commit -m "feat: new words" && git push
# Vercel auto-deploys!

# 5. Update production webhook
curl -X POST "https://api.telegram.org/bot$TOKEN/setWebhook?url=https://vercel-url/api/webhook"

🤝 Contributing
Fork repository
Add words/scores to BAD_WORDS
Test with npm run dev + ngrok
PR with test cases

📄 License
MIT License - Free for commercial use

👩‍💻 Author
**Ekaterina Lehman**
Applied Linguistics & Text Analytics
Nizhny Novgorod, Russia
