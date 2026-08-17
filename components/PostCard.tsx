
import React, { memo, useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
  Image,
  ImageSourcePropType,
  Share,
  Linking,
  AccessibilityInfo,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import { voteOnPoll } from '@/lib/mastodon';
import { MastodonPoll, MastodonPost } from '@/types/mastodon';
import { IconSymbol } from '@/components/IconSymbol';
import MediaPlayer from '@/components/MediaPlayer';
import EmojiText, { stripEmojiColons } from '@/components/EmojiText';
import { playInAppSound } from '@/lib/notifications';

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
  onPress?: (postId: string) => void;
  /** When set, the translated text is shown in place of the original. */
  translation?: { content: string; detectedSourceLanguage: string; provider: string };
}

function PostCard({ post, onReply, onReblog, onFavourite, onBookmark, onPress, translation }: PostCardProps) {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const theme = colorScheme === 'dark' ? colors.dark : colors.light;

  // Check if this is a boosted post
  const isBoost = !!post.reblog;
  const actualPost = isBoost ? post.reblog! : post;
  const booster = isBoost ? post.account : null;

  // Use values directly from post prop (parent handles optimistic updates)
  const reblogged = post.reblogged;
  const favourited = post.favourited;
  const bookmarked = post.bookmarked || false;
  const reblogsCount = post.reblogsCount || 0;
  const favouritesCount = post.favouritesCount || 0;

  const handleReply = useCallback(() => {
    onReply(post.id);
  }, [onReply, post.id]);

  // Sounds fire on the tap rather than on the server's reply: these actions are
  // optimistic in the UI, so waiting would put the sound out of step with what
  // the reader just saw happen.
  const handleReblog = useCallback(() => {
    if (!reblogged) playInAppSound('boost');
    onReblog(post.id, reblogged || false);
  }, [onReblog, post.id, reblogged]);

  const handleFavourite = useCallback(() => {
    playInAppSound(favourited ? 'unfavourite' : 'favourite');
    onFavourite(post.id, favourited || false);
  }, [onFavourite, post.id, favourited]);

  const handleBookmark = useCallback(() => {
    if (onBookmark) {
      onBookmark(post.id, bookmarked);
    }
  }, [onBookmark, post.id, bookmarked]);

  // Strip HTML tags from content for display
  const stripHtml = (html: string) => {
    return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  };

  // A translation replaces the body; the original stays one tap away by
  // translating again from the menu.
  const displayContent = stripHtml(translation?.content ?? actualPost.content);

  // Filters are matched server-side; `filtered` tells us what to do about it.
  // A boost is judged on the boosted post, which is what actually matched.
  const filterMatches = actualPost.filtered ?? [];
  const hideFilter = filterMatches.find(m => m.filter.filterAction === 'hide');
  const warnFilter = filterMatches.find(m => m.filter.filterAction === 'warn');
  const blurFilter = filterMatches.find(m => m.filter.filterAction === 'blur');

  // A content warning hides the body and any media until the reader opts in.
  // `sensitive` on its own only covers the media, which is how Mastodon
  // itself treats the two flags.
  const spoilerText = actualPost.spoilerText?.trim() || '';
  const hasContentWarning = spoilerText.length > 0;
  const hasSensitiveMedia = !!actualPost.sensitive;
  const [revealed, setRevealed] = useState(false);

  // A warn filter behaves like a content warning, with the filter's name as the
  // reason, so one reveal control covers both.
  const bodyHidden = (hasContentWarning || !!warnFilter) && !revealed;
  const mediaHidden =
    (hasContentWarning || hasSensitiveMedia || !!warnFilter || !!blurFilter) && !revealed;

  // The author's own warning wins over the filter's name when both apply.
  const warningText = hasContentWarning
    ? spoilerText
    : warnFilter
      ? `Filtered: ${warnFilter.filter.title}`
      : '';

  const toggleReveal = useCallback(() => {
    const next = !revealed;
    setRevealed(next);
    AccessibilityInfo.announceForAccessibility(next ? 'Content shown' : 'Content hidden');
  }, [revealed]);

  // Poll. `votedPoll` holds the server's response after voting; until then the
  // poll from props is authoritative, which avoids syncing prop into state.
  const [votedPoll, setVotedPoll] = useState<MastodonPoll | undefined>(undefined);
  const [pollSelection, setPollSelection] = useState<number[]>([]);
  const [pollSubmitting, setPollSubmitting] = useState(false);
  const poll = votedPoll ?? actualPost.poll;

  // Taken from the server rather than compared against the local clock: reading
  // the clock during render is impure, and a poll that lapses while the screen
  // is open fails the vote with a 422 we already surface.
  const pollExpired = !!poll?.expired;
  const pollShowsResults = !!poll && (poll.voted || pollExpired);
  const pollVotable = !!poll && !pollShowsResults && !pollSubmitting;

  const submitPollVote = useCallback(
    async (choices: number[]) => {
      if (!poll || choices.length === 0) return;

      setPollSubmitting(true);
      try {
        const updated = await voteOnPoll(poll.id, choices);
        setVotedPoll(updated);
        setPollSelection([]);
        playInAppSound('vote');
        AccessibilityInfo.announceForAccessibility('Vote submitted');
      } catch (error: any) {
        console.error('Failed to vote on poll:', error);
        AccessibilityInfo.announceForAccessibility(
          error?.message ? `Vote failed. ${error.message}` : 'Vote failed'
        );
      } finally {
        setPollSubmitting(false);
      }
    },
    [poll]
  );

  const handlePollOptionPress = useCallback(
    (index: number) => {
      if (!poll || !pollVotable) return;

      // Single-choice polls commit straight away; multiple-choice ones collect
      // selections until the reader confirms.
      if (!poll.multiple) {
        submitPollVote([index]);
        return;
      }

      setPollSelection(prev =>
        prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
      );
    },
    [poll, pollVotable, submitPollVote]
  );

  const pollTotalVotes = poll?.votersCount ?? poll?.votesCount ?? 0;

  const displayName = actualPost.account.displayName || actualPost.account.username;
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

  const repliesCount = actualPost.repliesCount || 0;

  const handlePress = useCallback(() => {
    if (onPress) {
      onPress(post.id);
    } else {
      router.push(`/post/${post.id}` as any);
    }
  }, [onPress, post.id, router]);

  const handleAccountPress = useCallback(() => {
    router.push(`/account/${actualPost.account.id}` as any);
  }, [router, actualPost.account.id]);

  const card = actualPost.card;

  const handleCardPress = useCallback(() => {
    if (!card?.url) return;
    Linking.openURL(card.url).catch(() => {
      AccessibilityInfo.announceForAccessibility('Could not open that link');
    });
  }, [card]);

  const handleShare = useCallback(() => {
    const url = actualPost.url || actualPost.uri;
    if (url) {
      Share.share({ url, message: url });
    }
  }, [actualPost.url, actualPost.uri]);

  // Combined accessibility label for the entire post
  const accessibilityLabel = useMemo(() => {
    const parts: string[] = [];

    if (isBoost) {
      parts.push(`${boosterDisplayName} boosted`);
    }

    parts.push(`${displayName}, @${actualPost.account.acct}, ${timeAgo}`);

    if (hasContentWarning) {
      parts.push(`Content warning: ${spoilerText}`);
    } else if (warnFilter) {
      parts.push(`Filtered by ${warnFilter.filter.title}`);
    }

    // Never read out content the author — or a filter — asked to keep hidden.
    if (bodyHidden) {
      parts.push(
        hasContentWarning ? 'Post hidden behind a content warning' : 'Post hidden by your filter'
      );
    } else {
      parts.push(stripEmojiColons(displayContent, actualPost.emojis));
      if (translation) parts.push('Translated');
      if (card?.title) {
        parts.push(
          card.providerName
            ? `Link: ${card.title}, from ${card.providerName}`
            : `Link: ${card.title}`
        );
      }
    }

    // Media descriptions
    const media = actualPost.mediaAttachments;
    if (media && media.length > 0) {
      if (mediaHidden) {
        parts.push(
          `${media.length} hidden attachment${media.length > 1 ? 's' : ''}`
        );
      } else {
        const descs = media.slice(0, 4).map((m, i) => m.description || `Image ${i + 1}`);
        parts.push(`${media.length} attachment${media.length > 1 ? 's' : ''}: ${descs.join(', ')}`);
      }
    }

    // Poll: read out the options, and the results once they're known.
    if (poll && !bodyHidden) {
      const optionText = poll.options.map((option, i) => {
        if (!pollShowsResults) {
          const selected = pollSelection.includes(i) ? ', selected' : '';
          return `${option.title}${selected}`;
        }
        const share = pollTotalVotes > 0
          ? Math.round(((option.votesCount ?? 0) / pollTotalVotes) * 100)
          : 0;
        const own = poll.ownVotes?.includes(i) ? ', your vote' : '';
        return `${option.title}, ${share} percent${own}`;
      });

      parts.push(
        `Poll${poll.multiple ? ', choose several' : ''}: ${optionText.join('. ')}`
      );
      parts.push(
        pollExpired
          ? `Poll closed, ${pollTotalVotes} ${pollTotalVotes === 1 ? 'vote' : 'votes'}`
          : `${pollTotalVotes} ${pollTotalVotes === 1 ? 'vote' : 'votes'} so far`
      );
    }

    // Interaction counts
    const counts: string[] = [];
    if (repliesCount > 0) counts.push(`${repliesCount} ${repliesCount === 1 ? 'reply' : 'replies'}`);
    if (reblogsCount > 0) counts.push(`${reblogsCount} ${reblogsCount === 1 ? 'boost' : 'boosts'}`);
    if (favouritesCount > 0) counts.push(`${favouritesCount} ${favouritesCount === 1 ? 'like' : 'likes'}`);
    if (counts.length > 0) parts.push(counts.join(', '));

    // Current user state
    const states: string[] = [];
    if (favourited) states.push('liked');
    if (reblogged) states.push('boosted');
    if (bookmarked) states.push('bookmarked');
    if (states.length > 0) parts.push(`You have ${states.join(', ')} this post`);

    return parts.join('. ');
  }, [isBoost, boosterDisplayName, displayName, timeAgo, displayContent, actualPost.mediaAttachments, repliesCount, reblogsCount, favouritesCount, favourited, reblogged, bookmarked, hasContentWarning, spoilerText, bodyHidden, mediaHidden, poll, pollShowsResults, pollExpired, pollSelection, pollTotalVotes, actualPost.account.acct, warnFilter, actualPost.emojis, card, translation]);

  // Accessibility actions with dynamic labels
  const accessibilityActions = useMemo(() => {
    const actions = [
      { name: 'reply', label: 'Reply' },
      { name: 'boost', label: reblogged ? 'Unboost' : 'Boost' },
      { name: 'like', label: favourited ? 'Unlike' : 'Like' },
    ];
    if (onBookmark) {
      actions.push({ name: 'bookmark', label: bookmarked ? 'Remove bookmark' : 'Bookmark' });
    }
    // The reveal control is a nested button, which the card's own
    // accessible={true} would otherwise swallow — expose it as an action.
    if (hasContentWarning || hasSensitiveMedia || warnFilter || blurFilter) {
      actions.push({ name: 'reveal', label: revealed ? 'Hide content' : 'Show content' });
    }
    // Poll options are nested touchables too, so each one gets an action.
    if (poll && pollVotable && !bodyHidden) {
      poll.options.forEach((option, i) => {
        actions.push({
          name: `poll-${i}`,
          label: poll.multiple
            ? `${pollSelection.includes(i) ? 'Deselect' : 'Select'} ${option.title}`
            : `Vote for ${option.title}`,
        });
      });
      if (poll.multiple && pollSelection.length > 0) {
        actions.push({ name: 'poll-submit', label: 'Submit vote' });
      }
    }
    // Tapping the avatar opens the author's profile; that touchable sits inside
    // the card's accessible node, so surface it as an action too.
    if (card?.url && !bodyHidden) {
      actions.push({ name: 'open-link', label: 'Open link' });
    }
    actions.push({ name: 'profile', label: `View @${actualPost.account.acct}'s profile` });
    actions.push({ name: 'share', label: 'Share' });
    return actions;
  }, [reblogged, favourited, bookmarked, onBookmark, hasContentWarning, hasSensitiveMedia, revealed, poll, pollVotable, pollSelection, bodyHidden, actualPost.account.acct, warnFilter, blurFilter, card]);

  const onAccessibilityAction = useCallback((event: { nativeEvent: { actionName: string } }) => {
    const action = event.nativeEvent.actionName;

    if (action === 'poll-submit') {
      submitPollVote(pollSelection);
      return;
    }
    if (action.startsWith('poll-')) {
      handlePollOptionPress(Number(action.slice('poll-'.length)));
      return;
    }

    switch (action) {
      case 'reply':
        handleReply();
        break;
      case 'boost':
        handleReblog();
        AccessibilityInfo.announceForAccessibility(reblogged ? 'Unboosted' : 'Boosted');
        break;
      case 'like':
        handleFavourite();
        AccessibilityInfo.announceForAccessibility(favourited ? 'Unliked' : 'Liked');
        break;
      case 'bookmark':
        handleBookmark();
        AccessibilityInfo.announceForAccessibility(bookmarked ? 'Bookmark removed' : 'Bookmarked');
        break;
      case 'reveal':
        toggleReveal();
        break;
      case 'open-link':
        handleCardPress();
        break;
      case 'profile':
        handleAccountPress();
        break;
      case 'share':
        handleShare();
        break;
    }
  }, [handleReply, handleReblog, handleFavourite, handleBookmark, handleShare, toggleReveal, submitPollVote, handlePollOptionPress, handleAccountPress, handleCardPress, pollSelection, reblogged, favourited, bookmarked]);

  //  means exactly that: the server still sent the post (outside home
  // and notifications it does not drop them), so the client removes it.
  if (hideFilter) return null;

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.7}
      style={[styles.container, { backgroundColor: theme.card, borderColor: theme.border }]}
      accessible={true}
      accessibilityRole="button"
      importantForAccessibility="yes"
      accessibilityLabel={accessibilityLabel}
      accessibilityActions={accessibilityActions}
      onAccessibilityAction={onAccessibilityAction}
    >
      {/* Boost Indicator */}
      {isBoost && (
        <View
          style={styles.boostIndicator}
          accessible={false}
          importantForAccessibility="no-hide-descendants"
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
        accessible={false}
        importantForAccessibility="no-hide-descendants"
      >
        <TouchableOpacity
          style={styles.headerIdentity}
          onPress={handleAccountPress}
          accessible={false}
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
              @{actualPost.account.acct}
            </Text>
          </View>
        </TouchableOpacity>
        <Text
          style={[styles.timestamp, { color: theme.textSecondary }]}
          accessible={false}
          importantForAccessibility="no"
        >
          {timeAgo}
        </Text>
      </View>

      {/* Content warning, or the filter that matched */}
      {(hasContentWarning || warnFilter) && (
        <View
          style={[styles.cwContainer, { backgroundColor: theme.background, borderColor: theme.border }]}
          accessible={false}
          importantForAccessibility="no-hide-descendants"
        >
          <Text style={[styles.cwText, { color: theme.text }]} accessible={false}>
            {warningText}
          </Text>
          <TouchableOpacity
            onPress={toggleReveal}
            style={[styles.cwButton, { borderColor: theme.border }]}
            accessible={false}
          >
            <Text style={[styles.cwButtonText, { color: theme.primary }]} accessible={false}>
              {revealed ? 'Hide' : 'Show more'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Content */}
      {!bodyHidden && (
        <View accessible={false} importantForAccessibility="no-hide-descendants">
          <EmojiText
            text={displayContent}
            emojis={actualPost.emojis}
            style={[styles.content, { color: theme.text }]}
            size={16}
          />
          {translation ? (
            <Text style={[styles.translationNote, { color: theme.textSecondary }]} accessible={false}>
              {translation.detectedSourceLanguage
                ? `Translated from ${translation.detectedSourceLanguage.toUpperCase()}`
                : 'Translated'}
              {translation.provider ? ` by ${translation.provider}` : ''}
            </Text>
          ) : null}
        </View>
      )}

      {/* Link preview */}
      {!bodyHidden && card && card.url ? (
        <TouchableOpacity
          style={[styles.card, { borderColor: theme.border, backgroundColor: theme.background }]}
          onPress={handleCardPress}
          accessible={false}
          importantForAccessibility="no-hide-descendants"
        >
          {card.image ? (
            <Image
              source={{ uri: card.image }}
              style={[styles.cardImage, { backgroundColor: theme.card }]}
              accessible={false}
            />
          ) : null}
          <View style={styles.cardText} accessible={false}>
            {card.providerName ? (
              <Text
                style={[styles.cardProvider, { color: theme.textSecondary }]}
                numberOfLines={1}
                accessible={false}
              >
                {card.providerName}
              </Text>
            ) : null}
            <Text
              style={[styles.cardTitle, { color: theme.text }]}
              numberOfLines={2}
              accessible={false}
            >
              {card.title || card.url}
            </Text>
            {card.description ? (
              <Text
                style={[styles.cardDescription, { color: theme.textSecondary }]}
                numberOfLines={2}
                accessible={false}
              >
                {card.description}
              </Text>
            ) : null}
          </View>
        </TouchableOpacity>
      ) : null}

      {/* Poll */}
      {poll && !bodyHidden && (
        <View style={styles.pollContainer} importantForAccessibility="no-hide-descendants">
          {poll.options.map((option, index) => {
            const votes = option.votesCount ?? 0;
            const share = pollTotalVotes > 0 ? votes / pollTotalVotes : 0;
            const isOwnVote = poll.ownVotes?.includes(index);
            const isSelected = pollSelection.includes(index);

            return (
              <TouchableOpacity
                key={`${poll.id}-${index}`}
                style={[styles.pollOption, { borderColor: isSelected ? theme.primary : theme.border }]}
                onPress={() => handlePollOptionPress(index)}
                disabled={!pollVotable}
                accessible={false}
              >
                {pollShowsResults && (
                  <View
                    style={[
                      styles.pollBar,
                      { width: `${Math.round(share * 100)}%`, backgroundColor: theme.primary, opacity: 0.18 },
                    ]}
                    accessible={false}
                  />
                )}
                <View style={styles.pollOptionRow} accessible={false}>
                  {!pollShowsResults && (
                    <IconSymbol
                      ios_icon_name={
                        poll.multiple
                          ? (isSelected ? 'checkmark.square.fill' : 'square')
                          : (isSelected ? 'largecircle.fill.circle' : 'circle')
                      }
                      android_material_icon_name={
                        poll.multiple
                          ? (isSelected ? 'check-box' : 'check-box-outline-blank')
                          : (isSelected ? 'radio-button-checked' : 'radio-button-unchecked')
                      }
                      size={20}
                      color={isSelected ? theme.primary : theme.textSecondary}
                      accessible={false}
                    />
                  )}
                  <Text
                    style={[
                      styles.pollOptionText,
                      { color: theme.text, fontWeight: isOwnVote ? '700' : '400' },
                    ]}
                    accessible={false}
                  >
                    {option.title}
                  </Text>
                  {pollShowsResults && (
                    <Text style={[styles.pollPercent, { color: theme.textSecondary }]} accessible={false}>
                      {Math.round(share * 100)}%
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}

          {poll.multiple && pollVotable && (
            <TouchableOpacity
              style={[
                styles.pollVoteButton,
                { backgroundColor: theme.primary },
                pollSelection.length === 0 && styles.pollVoteButtonDisabled,
              ]}
              onPress={() => submitPollVote(pollSelection)}
              disabled={pollSelection.length === 0}
              accessible={false}
            >
              <Text style={styles.pollVoteButtonText} accessible={false}>Vote</Text>
            </TouchableOpacity>
          )}

          <View style={styles.pollFooter} accessible={false}>
            {pollSubmitting && <ActivityIndicator size="small" color={theme.textSecondary} />}
            <Text style={[styles.pollMeta, { color: theme.textSecondary }]} accessible={false}>
              {pollTotalVotes} {pollTotalVotes === 1 ? 'vote' : 'votes'}
              {pollExpired ? ' · Closed' : ''}
            </Text>
          </View>
        </View>
      )}

      {/* Media attachments */}
      {actualPost.mediaAttachments && actualPost.mediaAttachments.length > 0 && (
        mediaHidden ? (
          <TouchableOpacity
            style={[styles.sensitiveCover, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={toggleReveal}
            accessible={false}
            importantForAccessibility="no-hide-descendants"
          >
            <IconSymbol
              ios_icon_name="eye.slash"
              android_material_icon_name="visibility-off"
              size={26}
              color={theme.textSecondary}
              accessible={false}
            />
            <Text style={[styles.sensitiveCoverText, { color: theme.textSecondary }]} accessible={false}>
              {hasContentWarning ? 'Media hidden' : 'Sensitive content'}
            </Text>
            <Text style={[styles.sensitiveCoverHint, { color: theme.primary }]} accessible={false}>
              Tap to show
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.mediaContainer} importantForAccessibility="no-hide-descendants">
            {actualPost.mediaAttachments.slice(0, 4).map((media, index) => (
              media.type === 'video' || media.type === 'gifv' || media.type === 'audio' ? (
                <MediaPlayer key={media.id || index} attachment={media} />
              ) : (
                <Image
                  key={media.id || index}
                  source={resolveImageSource(media.url)}
                  style={styles.mediaImage}
                  accessible={false}
                />
              )
            ))}
          </View>
        )
      )}

      {/* Actions - hidden from accessibility tree, visual only */}
      <View
        style={styles.actions}
        accessible={false}
        importantForAccessibility="no-hide-descendants"
      >
        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleReply}
          accessible={false}
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
          accessible={false}
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
          accessible={false}
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
            accessible={false}
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
          onPress={handleShare}
          accessible={false}
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
    </TouchableOpacity>
  );
}

// Memoize to prevent re-renders when parent state changes but this post hasn't
export default memo(PostCard, (prevProps, nextProps) => {
  const prevPost = prevProps.post;
  const nextPost = nextProps.post;

  // Only re-render if the post data actually changed
  return (
    prevPost.id === nextPost.id &&
    prevPost.reblogged === nextPost.reblogged &&
    prevPost.favourited === nextPost.favourited &&
    prevPost.bookmarked === nextPost.bookmarked &&
    prevPost.reblogsCount === nextPost.reblogsCount &&
    prevPost.favouritesCount === nextPost.favouritesCount &&
    prevPost.content === nextPost.content &&
    prevPost.spoilerText === nextPost.spoilerText &&
    prevPost.sensitive === nextPost.sensitive &&
    prevProps.translation?.content === nextProps.translation?.content &&
    prevPost.poll?.id === nextPost.poll?.id &&
    prevPost.poll?.voted === nextPost.poll?.voted &&
    prevPost.poll?.votesCount === nextPost.poll?.votesCount &&
    prevPost.repliesCount === nextPost.repliesCount
  );
});

const styles = StyleSheet.create({
  cwContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  cwText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  cwButton: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  cwButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  sensitiveCover: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 28,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  sensitiveCoverText: {
    fontSize: 15,
    fontWeight: '600',
  },
  sensitiveCoverHint: {
    fontSize: 13,
    fontWeight: '600',
  },
  translationNote: { fontSize: 12, marginTop: 6, fontStyle: 'italic' },
  card: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  cardImage: { width: '100%', height: 150 },
  cardText: { padding: 12, gap: 3 },
  cardProvider: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  cardTitle: { fontSize: 15, fontWeight: '600', lineHeight: 20 },
  cardDescription: { fontSize: 13, lineHeight: 18 },
  pollContainer: {
    marginTop: 10,
    gap: 8,
  },
  pollOption: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
    justifyContent: 'center',
    minHeight: 42,
  },
  pollBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  pollOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pollOptionText: {
    flex: 1,
    fontSize: 15,
  },
  pollPercent: {
    fontSize: 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  pollVoteButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 16,
  },
  pollVoteButtonDisabled: {
    opacity: 0.5,
  },
  pollVoteButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  pollFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pollMeta: {
    fontSize: 13,
  },
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
  headerIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 0,
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
