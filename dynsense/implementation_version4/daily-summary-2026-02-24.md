**What did I work on today?**
- Added a Workspace Name field to the login page so users can select which workspace to sign into
- Fixed backend to accept workspace names (not just slugs)
- Fixed a redirect bug that prevented users from getting past login
- Ran a pending migration for multi-workspace support
- Fixed mismatched columns across 8+ tables (tasks, tags, phases, audit log, custom fields) so the app stops erroring out
- Created 3 realistic projects with 50 unique tasks, project phases, and 130+ backfilled audit log entries
- Made audit log entries human-readable and added permanent filter tabs
- Built a full send notification feature — backend endpoint + frontend form where users can pick a team member, select a task, and send an in-app notification
- Hid unused nav tabs (AI Sessions, AI Review, Integrations) while keeping files as backup

**What did I learn?**
- How database schema drift happens when migrations fall behind ORM definitions, and how to diagnose and fix column mismatches across multiple tables
- How multi-tenant, multi-workspace auth flows work — matching by slug vs name, scoping data by tenant ID
- The importance of seeding realistic, varied data to properly test UI components like dropdowns and filters

**What challenges did I face?**
- Next.js was serving stale cached pages after file changes — had to clear the `.next` directory and restart the dev server
- Several pages were broken due to missing or renamed database columns that didn't match the Drizzle schema definitions
- Login kept redirecting in a loop because a migration hadn't been applied yet

**How did I verify my work?**
- Tested all 20+ pages and 25+ API endpoints across the app
- Manually checked that all buttons function correctly and there are no runtime errors
- Tested the send notification feature end-to-end from the UI and via API
