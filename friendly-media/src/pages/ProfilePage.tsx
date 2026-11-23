import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Ban,
  Check,
  Edit3,
  Flag,
  Globe,
  MapPin,
  MessageSquare,
  UserCheck,
  UserPlus,
  UserX,
} from 'lucide-react';
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import type { FriendRequest, Post, UserProfile } from '../types';
import { BRAND_ASSETS } from '../utils/media';
import { isSafeUrl } from '../utils/validation';
import { Avatar } from '../components/Avatar';
import { MainLayout } from '../components/MainLayout';
import { PostCard } from '../components/PostCard';

export function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { user, profile: myProfile, privateInfo } = useAuth();
  const navigate = useNavigate();

  const [targetProfile, setTargetProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [friendRequest, setFriendRequest] = useState<FriendRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'posts' | 'media'>('posts');
  const [statusNotice, setStatusNotice] = useState('');

  useEffect(() => {
    if (!username) return;
    setLoading(true);
    const q = query(collection(db, 'users'), where('username', '==', username.toLowerCase()));
    const unsub = onSnapshot(
      q,
      (snap) => {
        if (!snap.empty) {
          setTargetProfile(snap.docs[0].data() as UserProfile);
        } else {
          setTargetProfile(null);
        }
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [username]);

  useEffect(() => {
    if (!targetProfile) return;
    const isSelf = user?.uid === targetProfile.uid;
    const q = isSelf
      ? query(
          collection(db, 'posts'),
          where('authorId', '==', targetProfile.uid),
          orderBy('createdAt', 'desc')
        )
      : query(
          collection(db, 'posts'),
          where('authorId', '==', targetProfile.uid),
          where('visibility', '==', 'public'),
          orderBy('createdAt', 'desc')
        );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setPosts(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<Post, 'id'>),
          }))
        );
      },
      () => setPosts([])
    );
    return () => unsub();
  }, [targetProfile, user?.uid]);

  useEffect(() => {
    if (!user || !targetProfile || user.uid === targetProfile.uid) {
      setIsFollowing(false);
      setFriendRequest(null);
      return;
    }
    const followUnsub = onSnapshot(
      doc(db, 'follows', `${user.uid}_${targetProfile.uid}`),
      (snap) => setIsFollowing(snap.exists()),
      () => setIsFollowing(false)
    );

    const outgoingId = `${user.uid}_${targetProfile.uid}`;
    const incomingId = `${targetProfile.uid}_${user.uid}`;
    let active = true;

    const loadFriendReq = async () => {
      const outSnap = await getDoc(doc(db, 'friendRequests', outgoingId));
      if (!active) return;
      if (outSnap.exists()) {
        setFriendRequest({ id: outSnap.id, ...(outSnap.data() as Omit<FriendRequest, 'id'>) });
        return;
      }
      const inSnap = await getDoc(doc(db, 'friendRequests', incomingId));
      if (!active) return;
      if (inSnap.exists()) {
        setFriendRequest({ id: inSnap.id, ...(inSnap.data() as Omit<FriendRequest, 'id'>) });
      } else {
        setFriendRequest(null);
      }
    };
    void loadFriendReq();

    return () => {
      active = false;
      followUnsub();
    };
  }, [targetProfile, user]);

  if (loading) {
    return (
      <MainLayout>
        <div className="h-64 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-pulse" />
      </MainLayout>
    );
  }

  if (!targetProfile) {
    return (
      <MainLayout>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center">
          <h1 className="text-lg font-bold text-slate-900 dark:text-white">Profile not found</h1>
          <p className="text-sm text-slate-500 mt-1">
            The user @{username} could not be located.
          </p>
        </div>
      </MainLayout>
    );
  }

  const isOwnProfile = user?.uid === targetProfile.uid;
  const isBlocked = Boolean(privateInfo?.blockedUserIds?.includes(targetProfile.uid));

  const handleToggleFollow = async () => {
    if (!user || !user.emailVerified || !myProfile) {
      navigate('/login');
      return;
    }
    const followId = `${user.uid}_${targetProfile.uid}`;
    try {
      if (isFollowing) {
        await deleteDoc(doc(db, 'follows', followId));
        await updateDoc(doc(db, 'users', targetProfile.uid), {
          followersCount: increment(-1),
          updatedAt: serverTimestamp(),
        });
        await updateDoc(doc(db, 'users', user.uid), {
          followingCount: increment(-1),
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(doc(db, 'follows', followId), {
          followerId: user.uid,
          followingId: targetProfile.uid,
          createdAt: serverTimestamp(),
        });
        await updateDoc(doc(db, 'users', targetProfile.uid), {
          followersCount: increment(1),
          updatedAt: serverTimestamp(),
        });
        await updateDoc(doc(db, 'users', user.uid), {
          followingCount: increment(1),
          updatedAt: serverTimestamp(),
        });
        await addDoc(collection(db, 'notifications'), {
          recipientId: targetProfile.uid,
          actorId: user.uid,
          actorName: myProfile.displayName,
          actorUsername: myProfile.username,
          actorAvatar: myProfile.avatarUrl || '',
          type: 'follow',
          targetId: myProfile.username,
          message: `${myProfile.displayName} started following you.`,
          isRead: false,
          createdAt: serverTimestamp(),
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `follows/${followId}`);
    }
  };

  const handleFriendAction = async () => {
    if (!user || !user.emailVerified || !myProfile) {
      navigate('/login');
      return;
    }
    try {
      if (!friendRequest) {
        const reqId = `${user.uid}_${targetProfile.uid}`;
        await setDoc(doc(db, 'friendRequests', reqId), {
          fromUserId: user.uid,
          fromName: myProfile.displayName,
          fromUsername: myProfile.username,
          fromAvatar: myProfile.avatarUrl || '',
          toUserId: targetProfile.uid,
          status: 'pending',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await addDoc(collection(db, 'notifications'), {
          recipientId: targetProfile.uid,
          actorId: user.uid,
          actorName: myProfile.displayName,
          actorUsername: myProfile.username,
          actorAvatar: myProfile.avatarUrl || '',
          type: 'friend_request',
          targetId: myProfile.username,
          message: `${myProfile.displayName} sent you a friend request.`,
          isRead: false,
          createdAt: serverTimestamp(),
        });
        setFriendRequest({
          id: reqId,
          fromUserId: user.uid,
          fromName: myProfile.displayName,
          fromUsername: myProfile.username,
          fromAvatar: myProfile.avatarUrl,
          toUserId: targetProfile.uid,
          status: 'pending',
          createdAt: targetProfile.createdAt,
          updatedAt: targetProfile.updatedAt,
        });
      } else if (friendRequest.toUserId === user.uid && friendRequest.status === 'pending') {
        await updateDoc(doc(db, 'friendRequests', friendRequest.id), {
          status: 'accepted',
          updatedAt: serverTimestamp(),
        });
        setFriendRequest({ ...friendRequest, status: 'accepted' });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'friendRequests');
    }
  };

  const handleToggleBlock = async () => {
    if (!user) return;
    await updateDoc(doc(db, 'users', user.uid, 'private', 'info'), {
      blockedUserIds: isBlocked ? arrayRemove(targetProfile.uid) : arrayUnion(targetProfile.uid),
      updatedAt: serverTimestamp(),
    });
    setStatusNotice(isBlocked ? 'User unblocked.' : 'User blocked.');
  };

  const handleReportUser = async () => {
    if (!user || !user.emailVerified) return;
    await addDoc(collection(db, 'reports'), {
      reporterId: user.uid,
      targetType: 'user',
      targetId: targetProfile.uid,
      targetOwnerId: targetProfile.uid,
      reason: 'User profile reported',
      details: `Reported @${targetProfile.username}`,
      status: 'pending',
      reviewedBy: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setStatusNotice('User report sent to moderators.');
  };

  const handleMessageUser = () => {
    if (!user) {
      navigate('/login');
      return;
    }
    navigate(`/messages?to=${targetProfile.uid}`);
  };

  const coverSrc =
    targetProfile.coverUrl && isSafeUrl(targetProfile.coverUrl)
      ? targetProfile.coverUrl
      : BRAND_ASSETS.defaultCover;

  const displayedPosts =
    tab === 'media'
      ? posts.filter((p) => p.mediaType === 'image' || p.mediaType === 'video')
      : posts;

  return (
    <MainLayout>
      <div className="space-y-5">
        {/* Profile Header Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
          <div className="h-40 sm:h-52 bg-slate-200 dark:bg-slate-800 relative">
            <img
              src={coverSrc}
              alt={`${targetProfile.displayName} cover`}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>

          <div className="px-5 pb-5">
            <div className="flex flex-wrap items-end justify-between gap-4 -mt-12 relative z-10">
              <div className="p-1 rounded-full bg-white dark:bg-slate-900">
                <Avatar
                  src={targetProfile.avatarUrl}
                  name={targetProfile.displayName}
                  size="xl"
                  isOnline={targetProfile.isOnline}
                  verified={targetProfile.verified}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2">
                {isOwnProfile ? (
                  <Link
                    to="/profile/edit"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold hover:opacity-90"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Edit Profile
                  </Link>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => void handleToggleFollow()}
                      className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
                        isFollowing
                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                          : 'bg-blue-700 text-white hover:bg-blue-800'
                      }`}
                    >
                      {isFollowing ? <UserCheck className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
                      {isFollowing ? 'Following' : 'Follow'}
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleFriendAction()}
                      disabled={
                        friendRequest?.status === 'accepted' ||
                        (friendRequest?.status === 'pending' && friendRequest.fromUserId === user?.uid)
                      }
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60 cursor-pointer"
                    >
                      {friendRequest?.status === 'accepted' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          Friends
                        </>
                      ) : friendRequest?.status === 'pending' ? (
                        friendRequest.toUserId === user?.uid ? (
                          'Accept Friend'
                        ) : (
                          'Request Sent'
                        )
                      ) : (
                        'Add Friend'
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleMessageUser}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      Message
                    </button>

                    {user && (
                      <>
                        <button
                          type="button"
                          onClick={() => void handleToggleBlock()}
                          className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-red-600 cursor-pointer"
                          title={isBlocked ? 'Unblock user' : 'Block user'}
                        >
                          {isBlocked ? <UserX className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleReportUser()}
                          className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-amber-600 cursor-pointer"
                          title="Report user"
                        >
                          <Flag className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>

            {statusNotice && (
              <p className="mt-3 text-xs font-medium text-blue-700 dark:text-blue-400">
                {statusNotice}
              </p>
            )}

            <div className="mt-4">
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                {targetProfile.displayName}
              </h1>
              <p className="text-xs text-slate-500">@{targetProfile.username}</p>

              {targetProfile.bio && (
                <p className="mt-3 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                  {targetProfile.bio}
                </p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                {targetProfile.location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {targetProfile.location}
                  </span>
                )}
                {targetProfile.website && isSafeUrl(targetProfile.website) && (
                  <a
                    href={targetProfile.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-700 dark:text-blue-400 hover:underline"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    {targetProfile.website.replace(/^https?:\/\//, '')}
                  </a>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-6 text-xs sm:text-sm tabular-nums">
                <span>
                  <strong className="text-slate-900 dark:text-white">{targetProfile.postsCount}</strong>{' '}
                  <span className="text-slate-500">Posts</span>
                </span>
                <span>
                  <strong className="text-slate-900 dark:text-white">{targetProfile.followersCount}</strong>{' '}
                  <span className="text-slate-500">Followers</span>
                </span>
                <span>
                  <strong className="text-slate-900 dark:text-white">{targetProfile.followingCount}</strong>{' '}
                  <span className="text-slate-500">Following</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Profile Tabs */}
        <div className="flex gap-1 p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-fit">
          {(['posts', 'media'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold capitalize cursor-pointer ${
                tab === t
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {t === 'posts' ? 'Posts' : 'Photos & Videos'}
            </button>
          ))}
        </div>

        {displayedPosts.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center text-sm text-slate-500">
            No {tab === 'media' ? 'photos or videos' : 'posts'} shared yet.
          </div>
        ) : (
          <div className="space-y-4">
            {displayedPosts.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
