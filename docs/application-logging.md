# Application logging

This note describes the application log added for troubleshooting, security investigation, and audit. It is not a statement that GuestMoments is GDPR-compliant. Retention periods and a few existing data stores still need confirmation from the business owner and, where needed, legal review.

## Purpose

The log records security-relevant and important operational events so an incident can be reconstructed without storing passwords, tokens, message content, or uploaded files.

It is not used for advertising, product analytics, or ordinary navigation.

## Where rows are stored

Rows are written to the `application_log` table. The application has no customer page and no public API for reading logs. There is also no owner log viewer. Investigation is done by someone with direct, authorized database access.

The table has no foreign key to users or events. Deleting an account does not delete its log rows. The application does not update log rows. The only application delete path is the retention cleanup below.

Database logs are not immutable. A person with database credentials can still change or delete rows. The application does not provide that protection.

## Who can access logs

- Customers cannot read logs, including their own.
- Guests cannot read logs.
- The owner area does not display logs.
- The retention cron can delete only expired rows in `application_log`. It does not read them back to the client.

## Fields

| Field | Content |
| --- | --- |
| `id` | Random log id |
| `eventType` | One of the allowlisted names below |
| `actorType` | `customer`, `owner`, `guest`, `anonymous`, or `system` |
| `actorId` | Internal account id, or empty |
| `targetType` | `user`, `event`, `media`, `album`, `settings`, or `upload`, or empty |
| `targetId` | Internal id for that target, or empty |
| `result` | `success`, `failure`, or `denied` |
| `requestId` | A short correlation id from `x-request-id` or `x-vercel-id` when it matches a safe pattern, or empty |
| `metadata` | Only the allowlisted keys below |
| `createdAt` | Time the row was written |

Allowed metadata keys are `reason`, `fields`, `count`, `mediaKind`, `visibility`, `uploadPurpose`, `privacyMode`, `eventStatus`, `eventId`, `retentionDays`, `quotaMib`, `maxPhotoMib`, `maxVideoMib`, and `maxEventsPerCustomer`.

`fields` stores setting names such as `privacyMode` or `name`. It does not store the new name, surname, welcome text, album name, or file name.

`reason` is a fixed code such as `invalid_credentials`, `forbidden`, `rate`, or `type`.

## Event types

Account and authentication:

- `account.created`
- `account.updated`
- `account.deleted`
- `account.access.changed`
- `auth.login.succeeded`
- `auth.login.failed`
- `auth.password.changed`
- `auth.password.reset`

Events and media:

- `event.created`
- `event.updated` when privacy, status, retention, storage quota, or customer assignment changes
- `event.deleted`
- `media.upload.succeeded`
- `media.upload.rejected`
- `media.deleted`
- `media.visibility.changed`
- `media.bulk.assigned`
- `album.created`
- `album.renamed`
- `album.deleted`

Security and reliability:

- `access.denied`
- `rate.limited`
- `settings.updated`
- `app.error`

Favorites, ordinary gallery views, and ordinary downloads are not logged.

## Categories and retention

Initial defaults, overridable with environment variables from 1 to 3650 days:

| Category | Default | Events | Why this starting point |
| --- | --- | --- | --- |
| Operational | 30 days (`APP_LOG_RETENTION_OPERATIONAL_DAYS`) | Account creation and profile updates, successful login, event and album changes, successful uploads, media deletion and visibility, bulk album assignment, unexpected errors | Enough to troubleshoot a recent wedding upload problem, then delete |
| Authentication failures | 90 days (`APP_LOG_RETENTION_AUTH_FAILURE_DAYS`) | `auth.login.failed` | Long enough to see repeated failures, shorter than the security record |
| Security | 180 days (`APP_LOG_RETENTION_SECURITY_DAYS`) | Password change and reset, account deletion, access changes, rejected uploads, access denials, rate limits, platform setting changes | Keeps an investigation window after an incident without keeping the rows indefinitely |

The existing daily Vercel cron `GET /api/cron/retention` deletes expired log rows after the storage cleanup. The delete is limited to `application_log`, filtered by allowlisted event type and `createdAt`. Running it again is safe. It does not delete users, events, or media.

These periods are engineering defaults. The owner, and legal review if required, should confirm them before production use.

## Personal data

These fields can be linked to a person or a wedding even though the log does not store names or email addresses:

- `actorId` and a `targetId` of type `user`
- `targetId` for an event, media item, or album
- `metadata.eventId`

Treat them as personal data. Do not describe them as anonymous.

The log is written so that it does not store passwords, password hashes, session cookies, guest upload tokens, password-reset tokens, API keys, environment values, request or response bodies, headers, uploaded file bytes, email addresses, names, file names, storage keys, or full URLs. IP addresses are not written to this log.

## How a failed log write is handled

Most user actions continue if the log write fails. A logging outage should not block a guest upload, a login, or an event change.

Platform setting changes are the exception. The setting update and its `settings.updated` row are saved in one database transaction. If the log row cannot be written, the setting change is rolled back.

Account deletion still completes if the following log write fails. Blocking erasure because the log database is unavailable would get in the way of deleting a customer. The deletion row is written after the delete commits, so a crash between the two steps can leave a deletion without a log row.

## Decisions still needing confirmation

- Whether 30, 90, and 180 days are the right retention periods.
- Who is allowed to query the production database, and how that access is granted and reviewed.
- Whether a future owner-only log screen is needed. It should not be added until that access model is explicit.
- Existing `RateLimitHit.bucket` values can contain an IP address and an event code. That store was already there and is separate from `application_log`.
- Existing `session` rows can contain an IP address and user agent. That is Better Auth session data, not this log.
- When email delivery is not configured, `src/lib/email.ts` does not print the recipient, link, or token. Production fails with a generic delivery error. Development logs only that delivery is not configured. This log does not copy those values.
- Direct calls to the Better Auth HTTP routes are logged without an actor id, because reading the response body could capture an email address. The in-app login and password actions record the internal user id.
