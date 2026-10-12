# Application logging

This note describes the application log added for troubleshooting, security investigation, and audit. It is not a statement that GuestMoments is GDPR-compliant. Retention periods and a few existing data stores still need confirmation from the business owner and, where needed, legal review.

## Purpose

The log records security-relevant and important operational events so an incident can be reconstructed without storing passwords, tokens, message content, or uploaded files.

It is not used for advertising, product analytics, or ordinary navigation.

## Where rows are stored

Rows are written to the `application_log` table. The application has no customer page and no public API for reading logs. There is also no owner log viewer. Investigation is done by someone with direct, authorized database access.

The table has no foreign key to users or events. Retention cleanup is not the only delete path: permanent account deletion also deletes or anonymizes the log rows described below. Database logs are not immutable. A person with database credentials can still change or delete rows. The application does not provide that protection.

## Who can access logs

- Customers cannot read logs, including their own.
- Guests cannot read logs.
- The owner area does not display logs.
- The retention cron can delete only expired rows in `application_log`. It does not read them back to the client. That cleanup is separate from the anonymization that runs when an owner deletes a customer.

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

These periods apply to log rows in general. They are not what happens at the moment an account is deleted. The defaults remain 30 days for operational logs, 90 days for failed logins, and 180 days for security logs unless `APP_LOG_RETENTION_OPERATIONAL_DAYS`, `APP_LOG_RETENTION_AUTH_FAILURE_DAYS`, or `APP_LOG_RETENTION_SECURITY_DAYS` overrides them. Each override must be an integer from 1 to 3650; an invalid value falls back to the default.

These periods are engineering defaults. The owner, and legal review if required, should confirm them before treating them as a settled retention policy.

## Permanent account deletion

An owner can permanently delete a customer. That deletion does not store the deleted customer's user id in the new `account.deleted` row. The row keeps the deleting owner's id, the time, a successful result, and the number of events removed.

After the account transaction commits, the application rewrites older log rows for that customer:

- Operational rows that contain the customer id, or an event, media, or album id belonging to that customer, are deleted. Examples are account updates, successful logins, event changes, and successful uploads.
- Security rows that contain those ids are kept, with the ids removed. The event type, result, reason, and timestamp stay. If another person accessed that customer's event, that other person's id stays and the event id is removed.
- Failed login rows that do not contain the deleted customer's id are left as they are.
- Platform setting rows are left as they are.
- Logs for other customers are left as they are.

This is not complete anonymization. A retained security row can still show a reason, an actor type, a timestamp, and a request id. Those fields do not by themselves name the person, but a request id or timestamp can be correlated with hosting logs, and a database backup can still contain the account from before the deletion. The log rewrite is not part of the account transaction. If it fails, the account stays deleted and the new deletion row still omits the customer id, but older rows can keep their ids.

Guest rate-limit buckets for the deleted customer's event codes are removed in the same database transaction as the account. Those buckets look like `guest:{ip}:{eventCode}` and can also use an IPv6 address in the middle. Branding buckets for that customer are removed there too. Unrelated buckets are not matched by that filter. If that database delete fails, the account deletion rolls back.

When Upstash is configured, the same event codes are removed from Redis after the account commit, and only keys that belong to the guest rate-limit prefix and that event code. A Redis failure does not restore the account and does not delete keys that fail that check. Those keys can remain until the 10-minute rate-limit window expires. The application does not write the IP address, event code, or Redis key to the log. Automated tests do not call Upstash.

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

Account deletion still completes if the following log rewrite fails. Blocking erasure because the log database is unavailable would get in the way of deleting a customer. The log rewrite and the `account.deleted` row run after the account transaction commits, so they are not atomic with the deletion. A crash between those steps can leave a deleted account without a deletion row, or with older identifiers still present. The deletion row itself does not contain the deleted customer's user id.

## Decisions still needing confirmation

- Whether 30, 90, and 180 days are the right retention periods.
- Who is allowed to query the production database, and how that access is granted and reviewed.
- Whether a future owner-only log screen is needed. It should not be added until that access model is explicit.
- Existing `RateLimitHit.bucket` values for active guests can contain an IP address and an event code until they age out. Permanent deletion removes the guest buckets for that customer's events. Buckets for other events stay. Upstash keys for a deleted event can outlive the account if Redis cleanup fails. Session rows can contain an IP address and user agent while the account exists; permanent deletion removes those session rows.
- When email delivery is not configured, `src/lib/email.ts` does not print the recipient, link, or token. Production fails with a generic delivery error. Development logs only that delivery is not configured. This log does not copy those values.
- Direct calls to the Better Auth HTTP routes are logged without an actor id, because reading the response body could capture an email address. The in-app login and password actions record the internal user id.
