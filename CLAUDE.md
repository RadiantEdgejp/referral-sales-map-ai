# CLAUDE.md

## Project

`referral-sales-map-ai` is an AI sales navigation app for referral-based salespeople.

It is not just a CRM, contact memo, AI chat, or calendar app. The purpose is to help salespeople avoid losing track of **who to contact, when to contact them, what to say, and how to move the relationship forward**.

The app must connect contacts, sales routes, events, pre-meeting navigation, after-memos, message checks, coaching, follow-up tasks, reminders, end-of-day checks, AI context, Supabase persistence, and re-login restoration.

---

## 1. Highest-priority rule

Do not treat visual completion as functional completion.

A feature is complete only when it works with a **new Contact created from the UI**, not only with demo/seed contacts.

The main product risk is this failure mode:

> The UI looks good, but new contacts do not actually connect to AI, tasks, reminders, histories, Supabase, or re-login restoration.

Therefore, every implementation must be validated with a newly created Contact.

---

## 2. Non-negotiable completion gates

Every meaningful change must satisfy these gates unless the Issue explicitly states otherwise.

1. A new Contact can be created from the UI.
2. Supabase has real persisted rows.
3. Related rows have correct `user_id`, `contact_id`, and required `sales_route_id`.
4. Logout/re-login restores the state.
5. AIContext references the correct new Contact.
6. No demo contact ID, hardcoded person name, or seed-only SalesRoute/Task is required.
7. RLS and user ownership are not broken.
8. AI failure does not update the DB.
9. `npx.cmd tsc --noEmit` succeeds.
10. The implementation result, verification result, and remaining risks are reported back to the Issue.

If these gates are not met, do not call the work complete.

---

## 3. Work only by GitHub Issue

Implement only the assigned GitHub Issue.

Do not make broad unrelated improvements. Do not do opportunistic UI rewrites. Do not add functionality outside the Issue unless it is required to satisfy the Issue's acceptance criteria.

### At the start of work

1. Read the Issue body.
2. Identify affected screens, logic, repositories, LLM adapters, and DB tables.
3. Check existing docs and audit reports if relevant.
4. Keep the change scope narrow.
5. Do not rely on demo data for acceptance.

### At the end of work

Comment/report with:

```md
## Implementation summary

## Changed files

## New-contact E2E result

## Supabase data verification

## RLS / user_id verification

## AIContext verification

## Mobile QR environment impact

## Remaining risks

## Type check

`npx.cmd tsc --noEmit`: success / failure

## Items for human manual verification
```

---

## 4. Architecture rules

### 4.1 Contact is the source of truth

`Contact` is the only source of truth for a person.

Forbidden:

- Treating `Person` as an independent source of truth.
- Maintaining separate Contact/Person states that can diverge.
- Saving only to a view-model or local state.
- Using old localStorage Person data as the real source.
- Matching contacts by name alone.

If a screen needs a display `Person`, derive it from `Contact`.

### 4.2 Supabase is the persistence source of truth

Supabase is the source of truth for persisted app data.

Forbidden:

- Calling a feature complete when it only works in local state.
- Silently falling back to localStorage after a Supabase write failure.
- Showing success after a failed Supabase save.
- Mixing mock data into production UI.

Core tables:

- `profiles`
- `contacts`
- `sales_routes`
- `calendar_events`
- `action_tasks`
- `reminders`
- `pre_meeting_navs`
- `after_memos`
- `message_checks`
- `coach_logs`
- `update_histories`
- `interaction_logs`
- `data_gaps`
- `end_of_day_checks`
- `relationship_edges`
- `suggestion_approvals`

### 4.3 Security / RLS

Do not break security.

Requirements:

- RLS remains enabled on app tables.
- Every user-owned row has `user_id`.
- Users cannot read other users' data.
- Fake `user_id` INSERT/UPDATE attempts are rejected.
- anon access cannot read app data.
- service role keys never appear in frontend code.
- `.env.local`, tester credentials, tunnel URLs with secrets, or private keys are not committed.

If any of these breaks, treat it as P0.

### 4.4 AI must go through the LLM Adapter

Do not call Ollama/OpenAI/Claude/Gemini directly from UI components.

Expected flow:

```text
UI
-> logic
-> LLM Adapter
-> provider implementation
```

The app must be able to switch models later without rewriting screens or changing DB shape.

Supported/future providers:

- Ollama
- OpenAI
- Claude
- Gemini
- other API models

Rules:

- Keep LLM input/output types stable.
- Validate AI outputs before DB writes.
- If AI generation fails, do not write DB changes.
- If AI output contradicts user input or event state, block or warn before saving.
- Do not mix another contact's AIContext into the current contact.

---

## 5. Product behavior rules

### 5.1 New Contact creation

Creating a Contact must not create only `contacts` and stop.

When appropriate, creation must connect to:

- `contacts`
- `sales_routes`
- `data_gaps`
- `action_tasks`
- `reminders`
- `interaction_logs`

If next contact date is empty, use the initial rule: **3 days later at 09:00**.

Then:

- update `contacts.next_contact_date`
- create a follow-up `action_task`
- create a `reminder`
- write the auto-decision reason to `interaction_logs`
- show the task on Home

### 5.2 Contact picker/search

Every place that selects a person must support search.

Applicable areas include:

- event creation
- message check
- sales coach
- after memo
- pre-meeting navigation
- end-of-day check
- any other Contact selection UI

Show enough identifying information to distinguish people with the same name:

- name
- company
- title/role
- relationship
- last contact date
- next contact date
- short memo excerpt if useful

Archived contacts should not appear in normal pickers.

### 5.3 Event creation

Creating an event must:

- allow selecting a newly created Contact
- save `calendar_events.user_id`
- save `calendar_events.contact_id`
- save `calendar_events.sales_route_id` when required
- create a pre-meeting navigation task
- create an after-memo task
- reflect on Home
- restore after re-login

### 5.4 Pre-meeting navigation

Pre-meeting navigation AI must use the correct Contact's AIContext.

It should produce:

- meeting goal
- 3 main questions
- risks / NG actions
- suggested flow
- what to confirm next

Rules:

- Do not invent fixed dates or commitments.
- Do not overstate the contact's needs.
- Do not mix demo contact context.
- Saved 3 questions must pass exactly into the after-memo flow.

### 5.5 After memo

After memo input after the meeting has highest priority.

Priority order:

1. after-memo question answers
2. free memo
3. facts learned in the meeting
4. pre-meeting navigation
5. past history

Forbidden:

- Turning a completed event back into the next action.
- Using past datetimes as `nextAction`.
- Prioritizing pre-meeting assumptions over after-meeting answers.
- Inventing facts not present in the input.
- Treating undecided timing as a committed sales opportunity.

After saving, sync:

- `after_memos`
- `contacts`
- `sales_routes`
- `action_tasks`
- `reminders`
- `data_gaps`
- `update_histories`
- `interaction_logs`

### 5.6 Message check

Do not ask the user to choose a check type.

Flow:

1. Select related Contact.
2. Paste the message.
3. Optionally enter what the user wants to achieve.
4. AI classifies the message internally.
5. AI returns improvement, reply, risk, temperature, and next action.

Internal classifications can include:

- outbound draft
- received message
- rejection / low-temperature response
- referral request
- scheduling
- thank-you
- follow-up / reminder
- other

Low-temperature messages such as "busy", "not now", "when needed", or "maybe later" should not be pursued aggressively.

### 5.7 Sales coach

Sales coach should be a multi-turn chatbot, not a one-shot answer box.

Requirements:

- Contact selection
- AIContext from the selected Contact
- recent `coach_logs`
- multi-turn conversation
- save messages to `coach_logs`
- do not update Contact/SalesRoute/Task automatically
- keep answers short and action-oriented

### 5.8 End-of-day check

End-of-day check must use real data, not fixed mock data.

It should collect:

- incomplete `action_tasks`
- unresolved `data_gaps`
- events missing after-memo
- pending follow-ups
- today's interaction logs
- tasks to move to tomorrow

Saving should update:

- `end_of_day_checks`
- `action_tasks`
- `interaction_logs`

Do not show "after memo missing" for events that already have a saved after memo.

### 5.9 Contact archive

Use archive as the default deletion behavior.

Requirements:

- archive from contact detail
- confirmation modal
- do not delete related history rows
- hide archived contacts from normal lists/search/pickers
- remove archived contacts from Home tasks
- persist archive state after re-login

---

## 6. AIContext requirements

AIContext must be contact-specific.

Include relevant data such as:

- Contact
- SalesRoute
- CalendarEvent
- PreMeetingNav
- AfterMemo
- MessageCheck
- CoachLog
- InteractionLog
- UpdateHistory
- DataGap
- incomplete ActionTasks
- confirmedFacts
- hypotheses
- unknowns
- cautions

Forbidden:

- using data from a different `contact_id`
- using demo contact context for a new contact
- using stale local state when Supabase has newer data

---

## 7. New-contact E2E gate

Use a new Contact created from the UI. Existing demo contacts do not count.

Test contact example:

- Name: `新規連動テスト 佐藤`
- Company: `連動検証株式会社`
- Role: `営業責任者`
- Memo: `人材採用と営業組織づくりに関心あり`

Required flow:

1. Create a new Contact from the UI.
2. Save without entering a next contact date.
3. Verify automatic next contact date, ActionTask, and Reminder.
4. Verify the task appears on Home.
5. Search/select the new Contact in event creation.
6. Save an event.
7. Generate and save pre-meeting navigation.
8. Open after memo.
9. Verify the 3 pre-meeting questions match exactly.
10. Run after-memo AI organization.
11. Update the contact card.
12. Verify after-memo, update history, and interaction history on contact detail.
13. Select the new Contact in message check.
14. Run message check without manual check-type selection.
15. Save message check.
16. Verify message-check history on contact detail.
17. Select the new Contact in sales coach.
18. Run a multi-turn coaching conversation.
19. Verify the answer uses the new Contact context.
20. Verify end-of-day check includes relevant new-contact pending items.
21. Archive the contact.
22. Verify it disappears from normal lists/search/pickers.
23. Logout.
24. Login again.
25. Verify all persisted state is restored.
26. Verify Supabase rows exist and point to the same `contact_id`.
27. Verify RLS/user_id isolation.
28. Run `npx.cmd tsc --noEmit`.

Passing this E2E is required for completion unless the Issue explicitly says otherwise.

---

## 8. Mobile QR beta environment

The app may be tested on smartphone via Cloudflare Quick Tunnel and the beta proxy.

Do not directly expose Ollama `11434` to the internet.

Expected route:

```text
Tester smartphone
-> Cloudflare Quick Tunnel HTTPS URL
-> local beta proxy
-> Expo Web
-> /api/ollama proxy
-> local Ollama 127.0.0.1:11434
-> Supabase
```

Changes must not break this flow unless the Issue explicitly replaces it.

---

## 9. Do not work on these unless explicitly assigned

Do not implement the following unless an Issue says so:

- Stripe
- Google login
- multi-user public beta
- production push notifications
- Google Calendar sync
- formal legal documents
- archive restore UI
- monthly calendar
- full UI redesign

---

## 10. Definition of done

A change is done only when:

- the assigned Issue is implemented
- new-contact E2E impact is checked
- Supabase real data is verified
- RLS/user_id impact is checked
- AIContext impact is checked if AI-related
- mobile QR environment impact is checked if relevant
- `npx.cmd tsc --noEmit` succeeds
- remaining risks are documented
- manual verification points are listed

This app is an AI sales navigation system. It is complete only when a salesperson can add a real new contact and continue through the actual sales workflow without hidden demo-data dependencies or broken persistence.
