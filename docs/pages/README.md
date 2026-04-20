# Nousio — Page-by-Page UX/UI Documentation

> **Purpose**: This folder contains one .md file per web app page/component, documenting what each page does, its UX flow, API calls with expected wait times, and component breakdown. Use these documents for a full UX/UI review in Google Stitch.

## Page Index

| # | File | Page | Route |
|---|------|------|-------|
| 00 | [00-global-layout.md](./00-global-layout.md) | Global Layout & Navigation | `/(dashboard)/layout.tsx` |
| 01 | [01-dashboard.md](./01-dashboard.md) | Dashboard Home | `/dashboard` |
| 02 | [02-company-profile.md](./02-company-profile.md) | Company Profile | `/company/profile` |
| 03 | [03-company-dna.md](./03-company-dna.md) | Company DNA | `/company-dna` |
| 04 | [04-documents.md](./04-documents.md) | Documents | `/documents` |
| 05 | [05-marketing-assistant.md](./05-marketing-assistant.md) | Marketing Assistant | `/marketing` |
| 06 | [06-sales-assistant.md](./06-sales-assistant.md) | Sales Assistant | `/sales` |
| 07-09 | [07-09-product-advisor-onboarding.md](./07-09-product-advisor-onboarding.md) | Product + Advisor + Onboarding | `/product`, `/company-advisor`, `/onboarding-assistant` |
| 10-11 | [10-11-chat-search.md](./10-11-chat-search.md) | Ask AI + Search | `/chat`, `/search` |
| 12 | [12-boardroom.md](./12-boardroom.md) | Boardroom | `/boardroom`, `/boardroom/[id]` |
| 13 | [13-tasks.md](./13-tasks.md) | Tasks | `/tasks` |
| 14-16 | [14-16-projects-customers-crm.md](./14-16-projects-customers-crm.md) | Projects + Customers + CRM | `/projects`, `/customers`, `/crm` |
| 17-19 | [17-19-ai-team-skills.md](./17-19-ai-team-skills.md) | AI Team + Workspace + Skills | `/settings/ai-brain`, `/ai-team`, `/skills` |
| 20-22 | [20-22-virtual-office-classifications-gaps.md](./20-22-virtual-office-classifications-gaps.md) | Virtual Office + Classifications + Gaps | `/virtual-office`, `/classifications`, `/knowledge-gaps` |
| 23-26 | [23-26-settings-users-groups-integrations.md](./23-26-settings-users-groups-integrations.md) | Settings + Users + Groups + Integrations | `/settings`, `/settings/users`, `/settings/access-groups`, `/settings/integrations` |
| 27 | [27-action-assistant.md](./27-action-assistant.md) | Action Assistant (Global FAB) | Every page |

## Document Structure per Page

Each page document follows this structure:
1. **Route** — URL path
2. **Purpose** — What the page does and why it exists
3. **UX Flow** — Step-by-step user interaction sequence
4. **API Calls** — Table with endpoint, method, trigger, purpose, and expected wait time
5. **Components & Sections** — Complete breakdown of UI elements

## Coverage Summary

| Category | Pages |
|----------|-------|
| Setup & Config | Company Profile, Company DNA, Integrations, AI Team Settings |
| AI Assistants | Marketing, Sales, Product, Company Advisor, Onboarding, Ask AI |
| Knowledge | Documents, Search, Knowledge Insights, Classifications |
| Execution | Boardroom, Tasks, CRM |
| Management | Projects, Customers, Settings, Users, Access Groups |
| Global | Layout/Navigation, Action Assistant, Virtual Office |

## Redirect Pages (not documented separately)
- `/` → redirects to `/dashboard`
- `/leads` → redirects to `/sales?tab=leads`
- `/skills` → renders SkillsManagerPanel (documented in AI Team)
