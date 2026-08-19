# FEATURE: Optional Channel Connection + Publish Later Workflow

## Objective

Refactor the project creation workflow so users DO NOT need to connect any social media account before creating a project.

The application should follow a "Create First → Connect Later → Publish Anytime" workflow.

This should work for all supported platforms:
- YouTube
- Facebook
- Instagram
- TikTok
- LinkedIn
- X (Twitter)
- Any future platforms

-------------------------------------------------------

## Current Problem

Currently the Accounts & Details page displays:

"No YouTube accounts connected"

Although the UI says it is optional, the overall flow still pushes the user toward connecting a channel immediately.

Instead, users should be able to:

✅ Create unlimited projects
✅ Research
✅ Generate scripts
✅ Generate voice
✅ Generate images
✅ Generate videos
✅ Edit videos
✅ Save drafts
✅ Export locally

WITHOUT connecting any account.

Connecting accounts should only be required when the user actually wants to publish.

-------------------------------------------------------

## Required Architecture

Separate the application into two independent workflows.

Workflow A

Project Creation

↓

AI Creation

↓

Draft Saved

↓

User Continues Editing

Workflow B

Publish

↓

Choose Platform

↓

If account connected

Publish

Else

Connect Account

↓

OAuth

↓

Return

↓

Publish

These two workflows must never depend on each other.

-------------------------------------------------------

## New Project Wizard Changes

Accounts & Details page should become:

-------------------------------------------------

Primary Account

Status

○ No accounts connected

This is optional.

You can create your project now and connect any platform later when publishing.

[ Continue without connecting ]

[ Connect Account ]

-------------------------------------------------

Do NOT show warning colors.

Instead show a friendly neutral information card.

Example:

ℹ You don't need to connect any account now.
Create your content first.
You can connect YouTube, Facebook, Instagram, TikTok or any platform whenever you're ready to publish.

-------------------------------------------------------

Remove

"Go to Channel Access"

as a required CTA.

Replace with

Connect Account

(optional)

-------------------------------------------------------

Project Creation

The Create Project button must always be enabled.

No validation should check

connected account

OAuth

channel

publisher

-------------------------------------------------------

Database Changes

Projects table

Remove any required relation such as

primary_channel_id

publisher_id

channel_id

during creation.

Instead

status = draft

publishing_status = not_connected

connected_platforms = []

Allow NULL values.

-------------------------------------------------------

Publishing Workflow

When user clicks

Publish

show a modal.

-------------------------------------------------

Publish Content

Choose where you want to publish

YouTube

Facebook

Instagram

TikTok

LinkedIn

X

-------------------------------------------------

When user selects a platform

Check

isConnected(platform)

IF TRUE

↓

Open publish screen

IF FALSE

↓

Open OAuth flow

↓

After OAuth

↓

Automatically return to Publish

↓

Continue publishing

The user should never lose progress.

-------------------------------------------------------

New Publish Modal

Platform

Status

Action

YouTube

Not Connected

Connect

Facebook

Connected

Publish

Instagram

Connected

Publish

TikTok

Not Connected

Connect

LinkedIn

Connected

Publish

X

Not Connected

Connect

-------------------------------------------------------

After successful OAuth

Return automatically to

Publish Modal

instead of Dashboard.

-------------------------------------------------------

Draft Management

Projects must support

Draft

Ready

Scheduled

Published

Failed

Archived

Publishing should never affect editing.

-------------------------------------------------------

Export Feature

Even without any connected account user should be able to

Export MP4

Download subtitles

Download thumbnail

Download captions

Download transcript

Download script

-------------------------------------------------------

Future Platform System

Implement a provider architecture.

Example

PlatformProvider

YouTubeProvider

FacebookProvider

InstagramProvider

TikTokProvider

LinkedInProvider

TwitterProvider

Each provider should implement

connect()

disconnect()

publish()

schedule()

validate()

future APIs should only require a new provider class.

-------------------------------------------------------

Sidebar Changes

Add a new menu

Publishing

Inside it

Accounts

Connected Platforms

Publishing Queue

Scheduled Posts

Published History

Analytics

This is completely independent from Projects.

-------------------------------------------------------

User Journey

User opens app

↓

Create Project

↓

Generate Content

↓

AI Editing

↓

Save Draft

↓

Days later

↓

Open Publish

↓

Choose YouTube

↓

Not Connected

↓

OAuth

↓

Return Automatically

↓

Publish

No project recreation.

No lost progress.

-------------------------------------------------------

UI Improvements

Replace warning orange banner with soft purple or neutral blue information card.

Show platform logos.

Show "Optional" badge.

Add a small note:

"You can connect accounts anytime."

Use modern rounded cards.

Smooth animations.

Professional SaaS styling.

-------------------------------------------------------

Acceptance Criteria

✓ Project creation never requires OAuth.

✓ Users can create unlimited drafts offline.

✓ Publishing triggers account connection only when required.

✓ OAuth automatically returns to publishing.

✓ Multiple platforms supported.

✓ Provider architecture implemented.

✓ Drafts remain editable after publishing.

✓ Export works without connected accounts.

✓ Future platforms require minimal code changes.

-------------------------------------------------------

Deliverables

1. Update frontend UI.
2. Update project creation validation.
3. Update backend APIs.
4. Update database schema.
5. Implement provider-based publishing architecture.
6. Add Publish modal.
7. Implement deferred OAuth flow.
8. Preserve drafts throughout the workflow.
9. Add publishing sidebar section.
10. Ensure backward compatibility with existing projects.

Refactor the codebase following clean architecture, SOLID principles, TypeScript best practices, reusable React components, and scalable service layers.