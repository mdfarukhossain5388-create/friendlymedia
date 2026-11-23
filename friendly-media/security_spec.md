# FRIENDLY MEDIA Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **PII Isolation**: User email, private preferences, blocked IDs, and saved post IDs live strictly in `/users/{userId}/private/info` and are readable/writable only by `userId` or `isAdmin()`. Public `/users/{userId}` documents contain zero PII.
2. **RBAC Integrity**: Ordinary users can never create or elevate `/admins/{userId}` documents or set `verified: true` / `accountStatus` on their own profile. Only the bootstrapped Super Admin (`mdfarukhossain5388@gmail.com` with `email_verified == true`) or an existing `super_admin` in `/admins` may manage roles.
3. **Adsterra Script Security**: Only verified `super_admin` or `admin` users may create, update, or delete `/adsterraPlacements/{placementId}` documents. Non-admin users cannot inject arbitrary scripts.
4. **Site Settings Integrity**: Only verified `super_admin` or `admin` users may modify `/siteSettings/global`.
5. **Immutable Audit Trail**: `/auditLogs/{logId}` entries are append-only by staff and cannot be updated or deleted by anyone via client SDK.
6. **Temporal Integrity**: All `createdAt` and `updatedAt` timestamps must match `request.time`.
7. **Post & Comment Ownership**: `authorId` must equal `request.auth.uid` on create and remain immutable on update.
8. **Messaging Isolation**: Conversations and messages are accessible solely to the two `participantIds` listed in the document.
9. **Terminal State Locking**: Reports in terminal states (`resolved`, `dismissed`) cannot be reopened by non-admins.
10. **Strict Key & Size Enforcement**: Every collection uses `hasAll()` + `hasOnly()` on create, `affectedKeys().hasOnly()` on update, and `.size()` limits on all strings and lists.

## 2. The "Dirty Dozen" Attack Payloads
1. **Shadow Field Injection on Profile Create**: `{ uid: "u1", username: "alice", ..., isAdmin: true, verified: true }` -> `PERMISSION_DENIED`.
2. **Identity Spoofing on Post Create**: `{ authorId: "other_uid", content: "spoofed", ... }` -> `PERMISSION_DENIED`.
3. **Email Spoofing Admin Bypass**: Token with `email: "mdfarukhossain5388@gmail.com"`, `email_verified: false` writing to `/adsterraPlacements` -> `PERMISSION_DENIED`.
4. **PII Blanket Read**: User B attempting `get(/users/userA/private/info)` -> `PERMISSION_DENIED`.
5. **Client Query Scraping on Notifications**: User B attempting `list(/notifications)` without `recipientId == request.auth.uid` -> `PERMISSION_DENIED`.
6. **Non-Admin Adsterra Script Injection**: Regular user writing `<script>alert(1)</script>` to `/adsterraPlacements/p1` -> `PERMISSION_DENIED`.
7. **Non-Admin Site Customization Tampering**: Regular user updating `/siteSettings/global` -> `PERMISSION_DENIED`.
8. **Self-Verification Escalation**: User A updating `verified: true` on `/users/userA` -> `PERMISSION_DENIED`.
9. **Resource Poisoning / Oversized ID**: Creating `/posts/<200-char-junk-id>` -> `PERMISSION_DENIED`.
10. **Immutable Timestamp Tampering**: Creating a post with `createdAt` forged to 2020 instead of `request.time` -> `PERMISSION_DENIED`.
11. **Audit Log Deletion**: Moderator attempting `delete(/auditLogs/log1)` to cover tracks -> `PERMISSION_DENIED`.
12. **Eavesdropping Direct Messages**: User C attempting to read `/conversations/u1_u2/messages/m1` -> `PERMISSION_DENIED`.
