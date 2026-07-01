# Project Instructions for Codex

This is a Web Programming course project: Campus Second-hand Trading Platform.

## Tech Stack
- Backend: Node.js + Express
- Database: PostgreSQL + Prisma
- Frontend: static HTML files in public/, using Vue 3 CDN and Tailwind CDN
- Auth: JWT stored in localStorage
- Start command: npm run dev
- Database setup: npx prisma generate, npx prisma db push
- Prisma Studio: npx prisma studio

## Important Rules
- Do not rewrite the whole project.
- Make small, incremental changes.
- Keep the existing public/*.html structure.
- Prefer simple HTML + Vue CDN pages instead of converting to Vite or React.
- Do not commit .env or any secrets.
- Keep WEB3_MODE = FALSE for course demo.
- Avoid changing existing business logic unless necessary.
- Each task should be small and testable.

## Course Completion Plan
Implement the missing course-required modules step by step:
1. seed demo data
2. product management front-end
3. review and credit system front-end
4. admin user/product/statistics management
5. API documentation and third-party demo
6. CLI tool
7. credit evaluation Skill

## Testing After Each Change
After each change:
- run npm run dev
- test register/login
- test product listing
- test order flow
- check browser console