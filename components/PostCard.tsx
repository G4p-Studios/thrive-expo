
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
  Image,
  ImageSourcePropType,
  AccessibilityInfo,
} from 'react-native';
import { colors } from '@/styles/commonStyles';
import { MastodonPost } from '@/types/mastodon';
import { IconSymbol } from '@/components/IconSymbol';

// Helper to resolve image sources
function resolveImageSource(source: string | number | ImageSourcePropType | undefined): ImageSourcePropType {
  if (!source) return { uri: '' };
  if (typeof source === 'string') return { uri: source };
  return source as ImageSourcePropType;
}

interface PostCardProps {
  post: MastodonPost;
  onReply: (postId: string) => void;
  onReblog: (postId: string, currentState: boolean) => void;
  onFavourite: (postId: string, currentState: boolean) => void;
  onBookmark?: (postId: string, currentState: boolean) => void;
}

export default function PostCard({ post, onReply, onReblog, onFavourite, onBookmark }: PostCardProps) {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? colors.dark : colors.light;
  
  // Check if this is a boosted post
  const isBoost = !!post.reblog;
  const actualPost = isBoost ? post.reblog! : post;
  const booster = isBoost ? post.account : null;
  
  const [reblogged, setReblogged] = useState(post.reblogged);
  const [favourited, setFavourited] = useState(post.favourited);
  const [bookmarked, setBookmarked] = useState(post.bookmarked || false);
  const [reblogsCount, setReblogsCount] = useState(post.reblogsCount || 0);
  const [favouritesCount, setFavouritesCount] = useState(post.favouritesCount || 0);

  const handleReply = () => {
    console.log('User tapped reply button for post:', post.id);
    onReply(post.id);
  };

  const handleReblog = async () => {
    console.log('User tapped reblog button for post:', post.id, 'current state:', reblogged);
    const previousState = reblogged;
    const previousCount = reblogsCount;
    
    // Optimistic update
    const newState = !reblogged;
    setReblogged(newState);
    setReblogsCount(prev => newState ? prev + 1 : prev - 1);
    
    try {
      await onReblog(post.id, previousState);
    } catch (error) {
      // Revert on error
      console.error('Failed to toggle reblog, reverting:', error);
      setReblogged(previousState);
      setReblogsCount(previousCount);
    }
  };

  const handleFavourite = async () => {
    console.log('User tapped favourite button for post:', post.id, 'current state:', favourited);
    const previousState = favourited;
    const previousCount = favouritesCount;
    
    // Optimistic update
    const newState = !favourited;
    setFavourited(newState);
    setFavouritesCount(prev => newState ? prev + 1 : prev - 1);
    
    try {
      await onFavourite(post.id, previousState);
    } catch (error) {
      // Revert on error
      console.error('Failed to toggle favourite, reverting:', error);
      setFavourited(previousState);
      setFavouritesCount(previousCount);
    }
  };

  const handleBookmark = async () => {
    if (!onBookmark) return;
    
    console.log('User tapped bookmark button for post:', post.id, 'current state:', bookmarked);
    const previousState = bookmarked;
    
    // Optimistic update
    const newState = !bookmarked;
    setBookmarked(newState);
    
    try {
      await onBookmark(post.id, previousState);
    } catch (error) {
      // Revert on error
      console.error('Failed to toggle bookmark, reverting:', error);
      setBookmarked(previousState);
    }
  };

  // Strip HTML tags from content for display
  const stripHtml = (html: string) => {
    return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  };

  const displayContent = stripHtml(actualPost.content);
  const displayName = actualPost.account.displayName || actualPost.account.username;
  const username = actualPost.account.username;
  const boosterDisplayName = booster ? (booster.displayName || booster.username) : '';
  
  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString();
  };

  const timeAgo = formatDate(actualPost.createdAt);

  // Accessibility labels
  const repliesCount = actualPost.repliesCount || 0;
  const replyAccessibilityLabel = `Reply to ${displayName}'s post. ${repliesCount} replies`;
  const reblogAccessibilityLabel = reblogged 
    ? `Unboost. Currently boosted. ${reblogsCount} boosts` 
    : `Boost ${displayName}'s post. ${reblogsCount} boosts`;
  const favouriteAccessibilityLabel = favourited
    ? `Unlike. Currently liked. ${favouritesCount} likes`
    : `Like ${displayName}'s post. ${favouritesCount} likes`;
  const bookmarkAccessibilityLabel = bookmarked
    ? `Remove bookmark. Currently bookmarked`
    : `Bookmark ${displayName}'s post`;

  return (
    <View 
      style={[styles.container, { backgroundColor: theme.card, borderColor: theme.border }]}
      accessible={false}
      importantForAccessibility="auto"
    >
      {/* Boost Indicator */}
      {isBoost && (
        <View 
          style={styles.boostIndicator}
          accessible={true}
          accessibilityRole="text"
          accessibilityLabel={`${boosterDisplayName} boosted this post`}
        >
          <IconSymbol
            ios_icon_name="arrow.2.squarepath"
            android_material_icon_name="repeat"
            size={16}
            color={theme.success}
            accessible={false}
          />
          <Text 
            style={[styles.boostText, { color: theme.success }]}
            accessible={false}
          >
            {boosterDisplayName} boosted
          </Text>
        </View>
      )}

      {/* Header */}
      <View 
        style={styles.header}
        accessible={true}
        accessibilityRole="header"
        accessibilityLabel={`Post by ${displayName}, ${username}. Posted ${timeAgo}`}
      >
        <Image 
          source={resolveImageSource(actualPost.account.avatar)}
          style={styles.avatar}
          accessible={false}
          importantForAccessibility="no"
        />
        <View style={styles.headerText}>
          <Text 
            style={[styles.displayName, { color: theme.text }]} 
            numberOfLines={1}
            accessible={false}
            importantForAccessibility="no"
          >
            {displayName}
          </Text>
          <Text 
            style={[styles.username, { color: theme.textSecondary }]} 
            numberOfLines={1}
            accessible={false}
            importantForAccessibility="no"
          >
            @{username}
          </Text>
        </View>
        <Text 
          style={[styles.timestamp, { color: theme.textSecondary }]}
          accessible={false}
          importantForAccessibility="no"
        >
          {timeAgo}
        </Text>
      </View>

      {/* Content */}
      <Text 
        style={[styles.content, { color: theme.text }]}
        accessible={true}
        accessibilityRole="text"
        accessibilityLabel={`Post content: ${displayContent}`}
      >
        {displayContent}
      </Text>

      {/* Media attachments */}
      {actualPost.mediaAttachments && actualPost.mediaAttachments.length > 0 && (
        <View style={styles.mediaContainer}>
          {actualPost.mediaAttachments.slice(0, 4).map((media, index) => (
            <Image
              key={index}
              source={resolveImageSource(media.url)}
              style={styles.mediaImage}
              accessibilityLabel={media.description || `Image ${index + 1}`}
            />
          ))}
        </View>
      )}

      {/* Actions - Each button is independently accessible */}
      <View
        style={styles.actions}
        accessible={false}
        importantForAccessibility="no"
      >
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={handleReply}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={replyAccessibilityLabel}
          accessibilityHint="Double tap to reply to this post"
          accessibilityState={{ disabled: false }}
        >
          <IconSymbol
            ios_icon_name="bubble.left"
            android_material_icon_name="chat"
            size={20}
            color={theme.textSecondary}
            accessible={false}
          />
          <Text 
            style={[styles.actionCount, { color: theme.textSecondary }]}
            accessible={false}
          >
            {repliesCount}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionButton}
          onPress={handleReblog}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={reblogAccessibilityLabel}
          accessibilityHint="Double tap to boost this post"
          accessibilityState={{ disabled: false, checked: reblogged }}
        >
          <IconSymbol
            ios_icon_name="arrow.2.squarepath"
            android_material_icon_name="repeat"
            size={20}
            color={reblogged ? theme.success : theme.textSecondary}
            accessible={false}
          />
          <Text 
            style={[styles.actionCount, { color: reblogged ? theme.success : theme.textSecondary }]}
            accessible={false}
          >
            {reblogsCount}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionButton}
          onPress={handleFavourite}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={favouriteAccessibilityLabel}
          accessibilityHint="Double tap to like this post"
          accessibilityState={{ disabled: false, checked: favourited }}
        >
          <IconSymbol
            ios_icon_name={favourited ? "heart.fill" : "heart"}
            android_material_icon_name={favourited ? "favorite" : "favorite-border"}
            size={20}
            color={favourited ? theme.error : theme.textSecondary}
            accessible={false}
          />
          <Text 
            style={[styles.actionCount, { color: favourited ? theme.error : theme.textSecondary }]}
            accessible={false}
          >
            {favouritesCount}
          </Text>
        </TouchableOpacity>

        {onBookmark && (
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={handleBookmark}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={bookmarkAccessibilityLabel}
            accessibilityHint="Double tap to bookmark this post"
            accessibilityState={{ disabled: false, checked: bookmarked }}
          >
            <IconSymbol
              ios_icon_name={bookmarked ? "bookmark.fill" : "bookmark"}
              android_material_icon_name={bookmarked ? "bookmark" : "bookmark-border"}
              size={20}
              color={bookmarked ? theme.primary : theme.textSecondary}
              accessible={false}
            />
          </TouchableOpacity>
        )}

        <TouchableOpacity 
          style={styles.actionButton}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Share post"
          accessibilityHint="Double tap to share this post"
          accessibilityState={{ disabled: false }}
        >
          <IconSymbol
            ios_icon_name="square.and.arrow.up"
            android_material_icon_name="share"
            size={20}
            color={theme.textSecondary}
            accessible={false}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    borderWidth: 1,
  },
  boostIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  boostText: {
    fontSize: 13,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  displayName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  username: {
    fontSize: 14,
  },
  timestamp: {
    fontSize: 14,
  },
  content: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 12,
  },
  mediaContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
    gap: 8,
  },
  mediaImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionCount: {
    fontSize: 14,
    fontWeight: '500',
  },
});
