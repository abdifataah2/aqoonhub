# Somskill — React Starter

Mashruucan waxa ku jira React frontend iyo Express API ku xiran PostgreSQL. Qaar ka mid ah bogagga iyo workflows-ku weli waa horumar; isticmaal xog tijaabo ah ilaa release checklist-ka oo dhan la xaqiijiyo.

## Ku bilow Windows / VS Code
1. ZIP-ka fur (Extract All).
2. VS Code ku fur folder-ka `somskill-starter`.
3. Terminal > New Terminal.
4. Qor `npm install`.
5. Qor `npm run dev`.
6. Browser-ka ka fur URL-ka terminal-ka kuu soo baxa (badanaa `http://localhost:5173`).

## Bogagga tijaabada
- `/` — Somskill homepage
- `/s/al-maqaasid` — bogga iskuulka
- `/s/al-maqaasid/natiijo` — foomka natiijada (UI oo keliya)
- `/s/al-maqaasid/galitaan` — foomka login (UI oo keliya)
- `/s/al-maqaasid/demo` — admin dashboard demo (ma aha private)

## Vercel deployment
Vercel waxa uu ku wada daabacaa Vite frontend-ka iyo Express API-ga hal multi-service project; `/api/*` wuxuu aadaa API-ga. Ku xidh GitHub repository-ga iyo Neon PostgreSQL. Vercel environment variables ku dar `DATABASE_URL` (Neon pooled URL) iyo `JWT_SECRET` random ah oo ugu yaraan 32 xaraf ah.

Ka hor inta aan API-ga la isticmaalin, Neon SQL Editor ku mari `database/001_initial_schema.sql` ilaa `database/004_class_subjects.sql` si ay u kala horreeyaan. Ha commit-gareyn secrets, hana ku qorin chat-ka. Tilmaamaha deployment-ka iyo release checks-ka ka eeg [SOMSKILL_DEPLOY.md](./SOMSKILL_DEPLOY.md).

Health endpoint-ku waa `/api/health`. Adeegso accounts iyo xog tijaabo ah ilaa backup, recovery iyo hubinnada kale ee production-ka la dhammeeyo.
