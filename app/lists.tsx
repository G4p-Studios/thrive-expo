
import React, { useState, useEffect, useCallback } from 'react';
import { Stack, useRouter } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  useColorScheme,
  RefreshControl,
  ActivityIndicator,
  Platform,
  Modal,
  TextInput,
} from 'react-native';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { getLists, createList, deleteList } from '@/lib/mastodon';
import { MastodonList } from '@/types/mastodon';

export default function ListsScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const [lists, setLists] = useState<MastodonList[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newListTitle, setNewListTitle] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [listToDelete, setListToDelete] = useState<string | null>(null);

  const isDark = colorScheme === 'dark';
  const theme = isDark ? colors.dark : colors.light;

  useEffect(() => {
    console.log('ListsScreen mounted, loading lists');
    loadLists();
  }, []);

  const loadLists = useCallback(async () => {
    try {
      console.log('Loading Mastodon lists');
      if (!refreshing) {
        setLoading(true);
      }
      const response = await getLists();
      console.log(`Loaded ${response.length} lists`);
      setLists(response);
    } catch (error: any) {
      console.error('Failed to load lists:', error);
      setErrorMessage(error.message || 'Failed to load lists');
      setErrorModalVisible(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshing]);

  const handleCreateList = async () => {
    const trimmedTitle = newListTitle.trim();
    if (!trimmedTitle) {
      setErrorMessage('Please enter a list name');
      setErrorModalVisible(true);
      return;
    }

    try {
      console.log('Creating new list:', trimmedTitle);
      const newList = await createList(trimmedTitle);
      console.log('List created successfully:', newList.id);
      setLists((prev) => [newList, ...prev]);
      setNewListTitle('');
      setCreateModalVisible(false);
    } catch (error: any) {
      console.error('Failed to create list:', error);
      setErrorMessage(error.message || 'Failed to create list');
      setErrorModalVisible(true);
    }
  };

  const handleDeleteConfirm = (listId: string) => {
    console.log('User requested to delete list:', listId);
    setListToDelete(listId);
    setDeleteConfirmVisible(true);
  };

  const handleDeleteList = async () => {
    if (!listToDelete) return;

    setDeleteConfirmVisible(false);

    try {
      console.log('Deleting list:', listToDelete);
      await deleteList(listToDelete);
      console.log('List deleted successfully');
      setLists((prev) => prev.filter((list) => list.id !== listToDelete));
      setListToDelete(null);
    } catch (error: any) {
      console.error('Failed to delete list:', error);
      setErrorMessage(error.message || 'Failed to delete list');
      setErrorModalVisible(true);
    }
  };

  const handleViewList = (listId: string, title: string) => {
    console.log('User tapped list:', listId, title);
    router.push(`/list/${listId}?title=${encodeURIComponent(title)}`);
  };

  const renderListItem = ({ item }: { item: MastodonList }) => {
    const listTitle = item.title;
    
    return (
      <View 
        style={[styles.listItem, { backgroundColor: theme.card, borderColor: theme.border }]}
        accessible={false}
        importantForAccessibility="no"
      >
        <TouchableOpacity
          style={styles.listContent}
          onPress={() => handleViewList(item.id, item.title)}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={`View list: ${listTitle}`}
          accessibilityHint="Double tap to view posts in this list"
        >
          <IconSymbol
            ios_icon_name="list.bullet"
            android_material_icon_name="list"
            size={24}
            color={theme.primary}
            style={{ marginRight: 16 }}
          />
          <Text style={[styles.listTitle, { color: theme.text }]}>
            {listTitle}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeleteConfirm(item.id)}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={`Delete list: ${listTitle}`}
          accessibilityHint="Double tap to delete this list"
        >
          <IconSymbol
            ios_icon_name="trash"
            android_material_icon_name="delete"
            size={20}
            color={theme.error}
          />
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Stack.Screen
          options={{
            title: 'Lists',
            headerShown: true,
            headerBackTitle: 'Back',
          }}
        />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.text} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          title: 'Lists',
          headerShown: true,
          headerBackTitle: 'Back',
        }}
      />

      <FlatList
        data={lists}
        keyExtractor={(item) => item.id}
        renderItem={renderListItem}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              console.log('User pulled to refresh');
              setRefreshing(true);
              loadLists();
            }}
            tintColor={theme.text}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <IconSymbol
              ios_icon_name="list.bullet"
              android_material_icon_name="list"
              size={64}
              color={theme.textSecondary}
              style={{ marginBottom: 16 }}
            />
            <Text style={[styles.emptyText, { color: theme.text }]}>
              No lists yet. Create a list to organize accounts you follow!
            </Text>
          </View>
        }
        contentContainerStyle={lists.length === 0 ? styles.emptyListContent : styles.listContent}
      />

      {/* Create List Button */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: theme.primary }]}
        onPress={() => setCreateModalVisible(true)}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel="Create new list"
        accessibilityHint="Double tap to create a new list"
      >
        <IconSymbol
          ios_icon_name="plus"
          android_material_icon_name="add"
          size={24}
          color="#fff"
        />
      </TouchableOpacity>

      {/* Create List Modal */}
      <Modal
        visible={createModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Create New List
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
              placeholder="List name"
              placeholderTextColor={theme.textSecondary}
              value={newListTitle}
              onChangeText={setNewListTitle}
              autoFocus
              accessible={true}
              accessibilityLabel="List name input"
              accessibilityHint="Enter a name for your new list"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel, { borderColor: theme.border }]}
                onPress={() => {
                  setCreateModalVisible(false);
                  setNewListTitle('');
                }}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
                accessibilityHint="Double tap to cancel"
              >
                <Text style={[styles.modalButtonTextCancel, { color: theme.text }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm, { backgroundColor: theme.primary }]}
                onPress={handleCreateList}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Create list"
                accessibilityHint="Double tap to create the list"
              >
                <Text style={styles.modalButtonTextConfirm}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={deleteConfirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteConfirmVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <IconSymbol
              ios_icon_name="exclamationmark.triangle"
              android_material_icon_name="warning"
              size={48}
              color={theme.warning}
              style={{ marginBottom: 16 }}
            />
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Delete List?
            </Text>
            <Text style={[styles.modalMessage, { color: theme.text }]}>
              Are you sure you want to delete this list? This action cannot be undone.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel, { borderColor: theme.border }]}
                onPress={() => {
                  setDeleteConfirmVisible(false);
                  setListToDelete(null);
                }}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
                accessibilityHint="Double tap to cancel deletion"
              >
                <Text style={[styles.modalButtonTextCancel, { color: theme.text }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm, { backgroundColor: theme.error }]}
                onPress={handleDeleteList}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Delete"
                accessibilityHint="Double tap to confirm deletion"
              >
                <Text style={styles.modalButtonTextConfirm}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Error Modal */}
      <Modal
        visible={errorModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setErrorModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <IconSymbol
              ios_icon_name="exclamationmark.triangle"
              android_material_icon_name="error"
              size={48}
              color={theme.error}
              style={{ marginBottom: 16 }}
            />
            <Text style={[styles.modalTitle, { color: theme.text }]}>Error</Text>
            <Text style={[styles.modalMessage, { color: theme.text }]}>
              {errorMessage}
            </Text>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonConfirm, { backgroundColor: theme.primary }]}
              onPress={() => setErrorModalVisible(false)}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="OK"
              accessibilityHint="Double tap to close"
            >
              <Text style={styles.modalButtonTextConfirm}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  listContent: {
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  listContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  listTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  deleteButton: {
    padding: 8,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    maxWidth: 400,
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  modalMessage: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  input: {
    width: '100%',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonCancel: {
    borderWidth: 1,
  },
  modalButtonTextCancel: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonConfirm: {
  },
  modalButtonTextConfirm: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
