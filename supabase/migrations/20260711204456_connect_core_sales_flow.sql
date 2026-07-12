-- Issue #19: create the Contact -> SalesRoute -> CalendarEvent -> ActionTask
-- chain in one database transaction. The function is SECURITY INVOKER, so
-- the existing owner-only RLS policies remain the authorization boundary.

create or replace function public.create_scheduled_sales_flow(
  p_contact_id text,
  p_sales_route_id text,
  p_calendar_event_id text,
  p_pre_meeting_task_id text,
  p_after_memo_task_id text,
  p_reminder_id text,
  p_interaction_log_id text,
  p_route_type text,
  p_route_title text,
  p_route_goal text,
  p_route_next_step text,
  p_event_title text,
  p_event_type text,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_location text default null,
  p_meeting_method text default '',
  p_purpose text default '',
  p_memo text default null,
  p_created_by text default 'user',
  p_reminder_at timestamptz default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_reminder_at timestamptz := coalesce(p_reminder_at, p_start_at - interval '1 hour');
begin
  if v_user_id is null then
    raise exception 'Authentication is required';
  end if;

  if p_contact_id is null or p_contact_id = ''
    or p_sales_route_id is null or p_sales_route_id = ''
    or p_calendar_event_id is null or p_calendar_event_id = ''
    or p_pre_meeting_task_id is null or p_pre_meeting_task_id = ''
    or p_after_memo_task_id is null or p_after_memo_task_id = ''
    or p_reminder_id is null or p_reminder_id = ''
    or p_interaction_log_id is null or p_interaction_log_id = '' then
    raise exception 'All flow IDs are required';
  end if;

  if p_end_at <= p_start_at then
    raise exception 'Event end time must be after start time';
  end if;

  perform 1
  from public.contacts
  where id = p_contact_id and user_id = v_user_id and archived_at is null;
  if not found then
    raise exception 'Contact not found or not owned by current user';
  end if;

  insert into public.sales_routes (
    id, user_id, contact_id, route_type, title, goal, current_stage,
    next_step, priority, reason, status, confidence, created_by
  ) values (
    p_sales_route_id, v_user_id, p_contact_id, p_route_type, p_route_title,
    p_route_goal, 'scheduled', p_route_next_step, 'normal', p_purpose,
    'active', 0, p_created_by
  );

  insert into public.calendar_events (
    id, user_id, contact_id, sales_route_id, title, event_type, start_at,
    end_at, location, meeting_method, purpose, memo, status, created_by
  ) values (
    p_calendar_event_id, v_user_id, p_contact_id, p_sales_route_id,
    p_event_title, p_event_type, p_start_at, p_end_at, p_location,
    p_meeting_method, p_purpose, p_memo, 'scheduled', p_created_by
  );

  insert into public.action_tasks (
    id, user_id, contact_id, sales_route_id, calendar_event_id, title,
    action_type, priority, reason, today_goal, next_step, target_screen,
    due_date, status, created_from
  ) values
  (
    p_pre_meeting_task_id, v_user_id, p_contact_id, p_sales_route_id,
    p_calendar_event_id, p_event_title || 'の予定前ナビを作る',
    'pre_meeting', 'high', p_purpose, p_route_goal,
    '予定前ナビを作成する', 'PreMeeting', p_start_at, 'open', p_created_by
  ),
  (
    p_after_memo_task_id, v_user_id, p_contact_id, p_sales_route_id,
    p_calendar_event_id, p_event_title || 'の後メモを入力する',
    'after_memo', 'high', '予定後の情報を人脈カードへ蓄積する',
    p_route_goal, '後メモを入力して人脈カードを更新する',
    'AfterMemo', p_end_at, 'open', p_created_by
  );

  insert into public.reminders (
    id, user_id, contact_id, sales_route_id, calendar_event_id,
    action_task_id, title, body, scheduled_at, status, source_type,
    notification_timing
  ) values (
    p_reminder_id, v_user_id, p_contact_id, p_sales_route_id,
    p_calendar_event_id, p_pre_meeting_task_id,
    p_event_title || 'の準備', p_route_next_step, v_reminder_at,
    'scheduled', p_created_by, 'at_time'
  );

  insert into public.interaction_logs (
    id, user_id, contact_id, sales_route_id, type, title, summary,
    source_type, source_id, happened_at
  ) values (
    p_interaction_log_id, v_user_id, p_contact_id, p_sales_route_id,
    'calendar_event_created', '予定を追加', p_purpose,
    'calendar_event', p_calendar_event_id, now()
  );

  update public.contacts
  set next_contact_date = p_start_at,
      next_step = '予定前ナビを作成する'
  where id = p_contact_id and user_id = v_user_id;

  return jsonb_build_object(
    'contactId', p_contact_id,
    'salesRouteId', p_sales_route_id,
    'calendarEventId', p_calendar_event_id,
    'preMeetingTaskId', p_pre_meeting_task_id,
    'afterMemoTaskId', p_after_memo_task_id,
    'reminderId', p_reminder_id,
    'interactionLogId', p_interaction_log_id
  );
end;
$$;

revoke all on function public.create_scheduled_sales_flow(
  text, text, text, text, text, text, text, text, text, text, text,
  text, text, timestamptz, timestamptz, text, text, text, text, text,
  timestamptz
) from public, anon;

grant execute on function public.create_scheduled_sales_flow(
  text, text, text, text, text, text, text, text, text, text, text,
  text, text, timestamptz, timestamptz, text, text, text, text, text,
  timestamptz
) to authenticated;

create or replace function public.save_linked_pre_meeting_nav(
  p_nav_id text,
  p_contact_id text,
  p_sales_route_id text,
  p_calendar_event_id text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_task_id text;
begin
  if v_user_id is null then
    raise exception 'Authentication is required';
  end if;

  perform 1
  from public.calendar_events e
  join public.sales_routes r on r.id = e.sales_route_id
  where e.id = p_calendar_event_id
    and e.contact_id = p_contact_id
    and e.sales_route_id = p_sales_route_id
    and e.user_id = v_user_id
    and r.contact_id = p_contact_id
    and r.user_id = v_user_id;
  if not found then
    raise exception 'Contact, route and event do not form one owned flow';
  end if;

  insert into public.pre_meeting_navs (
    id, user_id, contact_id, sales_route_id, calendar_event_id, action_type,
    additional_memo, purpose, goal_today, conversation_policy, opening_topic,
    main_questions, follow_up_questions, ng_actions, should_sell_or_listen,
    referral_request_timing, items_to_record_after, scientific_reason, status
  ) values (
    p_nav_id, v_user_id, p_contact_id, p_sales_route_id, p_calendar_event_id,
    coalesce(p_payload->>'actionType', ''), coalesce(p_payload->>'memo', ''),
    coalesce(p_payload->>'purpose', ''), coalesce(p_payload->>'goalToday', ''),
    coalesce(p_payload->>'conversationPolicy', ''), coalesce(p_payload->>'openingTopic', ''),
    coalesce(p_payload->'mainQuestions', '[]'::jsonb),
    coalesce(p_payload->'followUpQuestions', '[]'::jsonb),
    coalesce(p_payload->'ngActions', '[]'::jsonb),
    coalesce(p_payload->>'shouldSellOrListen', ''),
    coalesce(p_payload->>'referralRequestTiming', ''),
    coalesce(p_payload->'itemsToRecordAfter', '[]'::jsonb),
    coalesce(p_payload->'scientificReason', '[]'::jsonb), 'created'
  );

  update public.calendar_events
  set pre_meeting_nav_id = p_nav_id
  where id = p_calendar_event_id and user_id = v_user_id;

  update public.action_tasks
  set status = 'completed'
  where user_id = v_user_id
    and contact_id = p_contact_id
    and sales_route_id = p_sales_route_id
    and calendar_event_id = p_calendar_event_id
    and action_type = 'pre_meeting'
  returning id into v_task_id;

  if v_task_id is null then
    raise exception 'Linked pre-meeting task was not found';
  end if;

  return jsonb_build_object(
    'preMeetingNavId', p_nav_id,
    'calendarEventId', p_calendar_event_id,
    'salesRouteId', p_sales_route_id,
    'completedTaskId', v_task_id
  );
end;
$$;

revoke all on function public.save_linked_pre_meeting_nav(text, text, text, text, jsonb)
  from public, anon;
grant execute on function public.save_linked_pre_meeting_nav(text, text, text, text, jsonb)
  to authenticated;

create or replace function public.save_linked_after_memo(
  p_after_memo_id text,
  p_pre_meeting_nav_id text,
  p_contact_id text,
  p_sales_route_id text,
  p_calendar_event_id text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_task_id text;
begin
  if v_user_id is null then
    raise exception 'Authentication is required';
  end if;

  perform 1
  from public.pre_meeting_navs n
  join public.calendar_events e on e.id = n.calendar_event_id
  join public.sales_routes r on r.id = n.sales_route_id
  where n.id = p_pre_meeting_nav_id
    and n.contact_id = p_contact_id
    and n.sales_route_id = p_sales_route_id
    and n.calendar_event_id = p_calendar_event_id
    and n.user_id = v_user_id
    and e.user_id = v_user_id
    and r.user_id = v_user_id;
  if not found then
    raise exception 'After memo is not linked to one owned pre-meeting flow';
  end if;

  insert into public.after_memos (
    id, user_id, contact_id, sales_route_id, calendar_event_id,
    pre_meeting_nav_id, contact_type, question_answers, free_memo,
    extracted_info, summary, update_proposal, classification_update,
    goal_update, next_action, feedback, next_questions, saved_to_contact
  ) values (
    p_after_memo_id, v_user_id, p_contact_id, p_sales_route_id,
    p_calendar_event_id, p_pre_meeting_nav_id, '会話後メモ',
    coalesce(p_payload->'questionAnswers', '[]'::jsonb),
    coalesce(p_payload->>'freeMemo', ''),
    coalesce(p_payload->'extractedInfo', '{}'::jsonb),
    coalesce(p_payload->>'summary', ''),
    coalesce(p_payload->>'updateProposal', ''),
    coalesce(p_payload->'classificationUpdate', '{}'::jsonb),
    coalesce(p_payload->>'goalUpdate', ''),
    coalesce(p_payload->>'nextAction', ''),
    coalesce(p_payload->>'feedback', ''),
    coalesce(p_payload->'nextQuestions', '[]'::jsonb), true
  );

  update public.pre_meeting_navs
  set after_memo_id = p_after_memo_id, status = 'after_memo_done'
  where id = p_pre_meeting_nav_id and user_id = v_user_id;

  update public.calendar_events
  set after_memo_id = p_after_memo_id, status = 'completed'
  where id = p_calendar_event_id and user_id = v_user_id;

  update public.action_tasks
  set status = 'completed'
  where user_id = v_user_id
    and contact_id = p_contact_id
    and sales_route_id = p_sales_route_id
    and calendar_event_id = p_calendar_event_id
    and action_type = 'after_memo'
  returning id into v_task_id;

  if v_task_id is null then
    raise exception 'Linked after-memo task was not found';
  end if;

  update public.contacts
  set next_step = coalesce(nullif(p_payload->>'nextAction', ''), next_step)
  where id = p_contact_id and user_id = v_user_id;

  update public.sales_routes
  set current_stage = 'after_memo_saved',
      next_step = coalesce(nullif(p_payload->>'nextAction', ''), next_step)
  where id = p_sales_route_id and user_id = v_user_id;

  return jsonb_build_object(
    'afterMemoId', p_after_memo_id,
    'calendarEventId', p_calendar_event_id,
    'salesRouteId', p_sales_route_id,
    'completedTaskId', v_task_id
  );
end;
$$;

revoke all on function public.save_linked_after_memo(text, text, text, text, text, jsonb)
  from public, anon;
grant execute on function public.save_linked_after_memo(text, text, text, text, text, jsonb)
  to authenticated;

create or replace function public.ensure_contact_sales_route(
  p_contact_id text,
  p_sales_route_id text,
  p_title text,
  p_goal text,
  p_next_step text
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication is required';
  end if;
  perform 1
  from public.contacts
  where id = p_contact_id and user_id = v_user_id and archived_at is null;
  if not found then
    raise exception 'Contact not found or not owned by current user';
  end if;

  insert into public.sales_routes (
    id, user_id, contact_id, route_type, title, goal, current_stage,
    next_step, priority, reason, status, confidence, created_by
  ) values (
    p_sales_route_id, v_user_id, p_contact_id, 'relationship_development',
    p_title, p_goal, 'contact_created', p_next_step, 'normal',
    '人物に対する最初の営業ルート', 'active', 0, 'system'
  )
  on conflict (id) do update
  set title = excluded.title,
      goal = excluded.goal,
      next_step = excluded.next_step
  where public.sales_routes.user_id = v_user_id
    and public.sales_routes.contact_id = p_contact_id;

  return p_sales_route_id;
end;
$$;

revoke all on function public.ensure_contact_sales_route(text, text, text, text, text)
  from public, anon;
grant execute on function public.ensure_contact_sales_route(text, text, text, text, text)
  to authenticated;
