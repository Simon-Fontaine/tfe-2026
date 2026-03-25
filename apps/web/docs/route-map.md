# Route Map (Canonical)

This document defines the canonical route hierarchy for the web app.

## Public
- `/`
- `/players`
- `/teams`
- `/orgs`
- `/scrims`

## Auth flow
- `/auth`
- `/onboarding`

## Dashboard
- `/dashboard`
- `/dashboard/workspace/orgs`
- `/dashboard/workspace/orgs/[orgId]`
- `/dashboard/workspace/orgs/[orgId]/teams/[teamId]`
- `/dashboard/recruit/lfg`
- `/dashboard/recruit/applications`
- `/dashboard/recruit/invitations`
- `/dashboard/me/profile`
- `/dashboard/me/schedule`
- `/dashboard/me/notifications`
- `/dashboard/me/settings`

## Policy
- Only the canonical routes above are supported.
