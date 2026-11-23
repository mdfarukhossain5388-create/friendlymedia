import { Timestamp } from 'firebase/firestore';

export type AccountStatus = 'active' | 'suspended' | 'banned';
export type StaffRole = 'super_admin' | 'admin' | 'moderator' | 'support';
export type ReactionType = 'like' | 'love' | 'haha' | 'wow' | 'insight';
export type PostVisibility = 'public' | 'private' | 'followers';
export type PostMediaType = 'text' | 'image' | 'video';

export type AdsterraFormat = 'social_bar' | 'native_banner' | 'display_banner' | 'direct_link';
export type AdsterraPlacementSlot =
  | 'header'
  | 'sidebar'
  | 'news_feed'
  | 'between_posts'
  | 'video_page'
  | 'footer'
  | 'mobile';
export type AdsterraDeviceTarget = 'all' | 'desktop' | 'mobile';
export type AdsterraDisplayRule = 'all_pages' | 'guests_only' | 'logged_in_only' | 'feed_and_videos';

export interface UserProfile {
  uid: string;
  username: string;
  displayName: string;
  bio?: string;
  avatarUrl?: string;
  coverUrl?: string;
  location?: string;
  website?: string;
  verified: boolean;
  accountStatus: AccountStatus;
  isPrivate: boolean;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  isOnline?: boolean;
  lastSeenAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface UserPrivateInfo {
  uid: string;
  email: string;
  emailVerified: boolean;
  showOnlineStatus: boolean;
  allowMessagesFrom: 'everyone' | 'following' | 'none';
  blockedUserIds: string[];
  savedPostIds: string[];
  updatedAt: Timestamp;
}

export interface AdminRole {
  uid: string;
  email: string;
  role: StaffRole;
  grantedBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Post {
  id: string;
  authorId: string;
  authorName: string;
  authorUsername: string;
  authorAvatar?: string;
  authorVerified?: boolean;
  content: string;
  mediaType: PostMediaType;
  mediaUrls?: string[];
  videoUrl?: string;
  videoThumbnail?: string;
  videoTitle?: string;
  hashtags?: string[];
  visibility: PostVisibility;
  likesCount: number;
  reactionsSummary?: Partial<Record<ReactionType, number>>;
  commentsCount: number;
  sharesCount: number;
  viewsCount: number;
  isEdited: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface PostReaction {
  id: string;
  postId: string;
  postAuthorId: string;
  postVisibility: PostVisibility;
  userId: string;
  type: ReactionType;
  createdAt: Timestamp;
}

export interface PostComment {
  id: string;
  postId: string;
  postAuthorId: string;
  postVisibility: PostVisibility;
  authorId: string;
  authorName: string;
  authorUsername: string;
  authorAvatar?: string;
  content: string;
  parentCommentId?: string;
  likesCount: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FriendRequest {
  id: string;
  fromUserId: string;
  fromName: string;
  fromUsername: string;
  fromAvatar?: string;
  toUserId: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ConversationParticipant {
  name: string;
  username: string;
  avatar?: string;
}

export interface Conversation {
  id: string;
  participantIds: string[];
  participantMap: Record<string, ConversationParticipant>;
  lastMessage: string;
  lastMessageSenderId: string;
  lastMessageAt: Timestamp;
  typingUsers: Record<string, boolean>;
  unreadCounts: Record<string, number>;
  deletedFor: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  participantIds: string[];
  senderId: string;
  text: string;
  imageUrl?: string;
  readBy: string[];
  createdAt: Timestamp;
}

export type NotificationType =
  | 'follow'
  | 'friend_request'
  | 'like'
  | 'comment'
  | 'reply'
  | 'message'
  | 'mention'
  | 'announcement';

export interface AppNotification {
  id: string;
  recipientId: string;
  actorId: string;
  actorName: string;
  actorUsername?: string;
  actorAvatar?: string;
  type: NotificationType;
  targetId?: string;
  message: string;
  isRead: boolean;
  createdAt: Timestamp;
}

export interface ModerationReport {
  id: string;
  reporterId: string;
  targetType: 'post' | 'user' | 'comment';
  targetId: string;
  targetOwnerId?: string;
  reason: string;
  details?: string;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  reviewedBy?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface AdsterraPlacement {
  id: string;
  name: string;
  format: AdsterraFormat;
  placement: AdsterraPlacementSlot;
  deviceTarget: AdsterraDeviceTarget;
  scriptCode: string;
  directLinkUrl?: string;
  frequency: number;
  enabled: boolean;
  displayRule: AdsterraDisplayRule;
  updatedBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface SiteFeatures {
  registrationEnabled: boolean;
  messagingEnabled: boolean;
  videoUploadsEnabled: boolean;
  commentsEnabled: boolean;
  reactionsEnabled: boolean;
  maintenanceMode: boolean;
}

export interface SiteSettings {
  siteName: string;
  tagline: string;
  logoUrl?: string;
  faviconUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  fontFamily: 'Plus Jakarta Sans' | 'Manrope' | 'DM Sans' | 'Outfit';
  defaultTheme: 'light' | 'dark';
  cardStyle: 'elevated' | 'bordered' | 'glass';
  headerStyle: 'glass' | 'solid';
  sidebarStyle: 'compact' | 'expanded';
  announcementBanner?: string;
  announcementEnabled: boolean;
  heroHeadline: string;
  heroSubheadline: string;
  footerText: string;
  aboutContent: string;
  contactEmail: string;
  privacyContent: string;
  termsContent: string;
  features: SiteFeatures;
  updatedBy: string;
  updatedAt?: Timestamp;
}

export interface AuditLog {
  id: string;
  actorId: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  details: string;
  createdAt: Timestamp;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: 'new' | 'replied';
  createdAt: Timestamp;
}
