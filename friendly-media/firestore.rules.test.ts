/**
 * Phase 0 Payload-First Security TDD Test Specification for FRIENDLY MEDIA
 * Verifies all "Dirty Dozen" adversarial payloads yield PERMISSION_DENIED.
 */

export interface DirtyDozenCase {
  id: string;
  name: string;
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  expected: 'PERMISSION_DENIED';
  payload?: Record<string, unknown>;
}

export const dirtyDozenCases: DirtyDozenCase[] = [
  {
    id: 'DD-01',
    name: 'Shadow field injection on user profile create',
    path: '/users/userA',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { uid: 'userA', username: 'alice', displayName: 'Alice', verified: true, shadowRole: 'super_admin' },
  },
  {
    id: 'DD-02',
    name: 'Author ID spoofing on post creation',
    path: '/posts/post1',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { authorId: 'victim_uid', content: 'Impersonated post' },
  },
  {
    id: 'DD-03',
    name: 'Unverified admin email spoofing on Adsterra settings',
    path: '/adsterraPlacements/ad1',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { name: 'Injected Ad', scriptCode: '<script>evil()</script>' },
  },
  {
    id: 'DD-04',
    name: 'Cross-user PII read on private subcollection',
    path: '/users/userA/private/info',
    operation: 'get',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-05',
    name: 'Unscoped notifications list query',
    path: '/notifications',
    operation: 'list',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-06',
    name: 'Ordinary user attempting Adsterra placement write',
    path: '/adsterraPlacements/header_ad',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    payload: { enabled: true, scriptCode: 'https://evil.example/ad.js' },
  },
  {
    id: 'DD-07',
    name: 'Ordinary user attempting siteSettings tampering',
    path: '/siteSettings/global',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    payload: { siteName: 'HACKED' },
  },
  {
    id: 'DD-08',
    name: 'Self-verification privilege escalation',
    path: '/users/userA',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    payload: { verified: true, accountStatus: 'active' },
  },
  {
    id: 'DD-09',
    name: 'Oversized document ID poisoning',
    path: `/posts/${'a'.repeat(160)}`,
    operation: 'create',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-10',
    name: 'Client-forged createdAt timestamp',
    path: '/posts/post2',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { authorId: 'userA', createdAt: '2020-01-01T00:00:00Z' },
  },
  {
    id: 'DD-11',
    name: 'Audit log deletion attempt',
    path: '/auditLogs/log1',
    operation: 'delete',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-12',
    name: 'Non-participant reading direct messages',
    path: '/conversations/userA_userB/messages/msg1',
    operation: 'get',
    expected: 'PERMISSION_DENIED',
  },
];
