import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../styles/theme';
import { useSkillMatching } from '../hooks/useSkillMatching';
import { useSkills } from '../hooks/useSkills';
import SkillMatchCard from '../components/SkillMatchCard';
import SkillExchangeProposalModal from '../components/SkillExchangeProposalModal';

type TabType = 'all' | 'canTeach' | 'wantToLearn' | 'mutual';

export default function SkillMatchingScreen({ navigation }: any) {
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [selectedMatch, setSelectedMatch] = useState<any>(null);
  const [showProposalModal, setShowProposalModal] = useState(false);

  const {
    matches,
    canTeachMatches,
    wantToLearnMatches,
    mutualMatches,
    loading,
    refreshing,
    refresh,
  } = useSkillMatching();

  const { mySkills, mySkillWants } = useSkills();

  const getFilteredMatches = useCallback(() => {
    switch (activeTab) {
      case 'canTeach':
        return canTeachMatches;
      case 'wantToLearn':
        return wantToLearnMatches;
      case 'mutual':
        return mutualMatches;
      default:
        return matches;
    }
  }, [activeTab, matches, canTeachMatches, wantToLearnMatches, mutualMatches]);

  const handleViewProfile = (userId: string) => {
    navigation.navigate('UserProfile', { userId });
  };

  const handleProposeExchange = (match: any) => {
    setSelectedMatch(match);
    setShowProposalModal(true);
  };

  const renderEmptyState = () => {
    if (mySkills.length === 0 && mySkillWants.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconContainer}>
            <Ionicons name="school-outline" size={64} color={theme.colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>Add Your Skills First</Text>
          <Text style={styles.emptyText}>
            To find skill exchange partners, add skills you can teach and skills you want to learn on your profile.
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => navigation.navigate('Profile')}
          >
            <Ionicons name="person" size={20} color="white" />
            <Text style={styles.emptyButtonText}>Go to Profile</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="search-outline" size={64} color={theme.colors.textSecondary} />
        <Text style={styles.emptyTitle}>No Matches Found</Text>
        <Text style={styles.emptyText}>
          {activeTab === 'canTeach'
            ? "No one nearby can teach the skills you want to learn yet."
            : activeTab === 'wantToLearn'
            ? "No one nearby wants to learn the skills you can teach yet."
            : activeTab === 'mutual'
            ? "No mutual skill exchange matches found yet."
            : "No skill matches found in your area yet."
          }
        </Text>
        <TouchableOpacity style={styles.refreshButton} onPress={refresh}>
          <Ionicons name="refresh" size={20} color={theme.colors.primary} />
          <Text style={styles.refreshButtonText}>Refresh</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderMatch = ({ item }: any) => (
    <SkillMatchCard
      user={item.user}
      distance={item.distance}
      skillsCanTeach={item.skills_can_teach}
      skillsWantToLearn={item.skills_want_to_learn}
      isMutualMatch={item.is_mutual_match}
      matchingTeachSkillIds={item.matching_teach_skills}
      matchingLearnSkillIds={item.matching_learn_skills}
      onPress={() => handleViewProfile(item.user.id)}
      onProposeExchange={() => handleProposeExchange(item)}
    />
  );

  const tabs: { id: TabType; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: matches.length },
    { id: 'canTeach', label: 'Can Teach Me', count: canTeachMatches.length },
    { id: 'wantToLearn', label: 'Want to Learn', count: wantToLearnMatches.length },
    { id: 'mutual', label: 'Mutual', count: mutualMatches.length },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Skill Exchange</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <Ionicons name="information-circle" size={20} color={theme.colors.primary} />
        <Text style={styles.infoText}>
          Find people to exchange skills with! Teach what you know, learn what you want.
        </Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === tab.id && styles.tabTextActive,
              ]}
            >
              {tab.label}
            </Text>
            {tab.count > 0 && (
              <View
                style={[
                  styles.tabBadge,
                  activeTab === tab.id && styles.tabBadgeActive,
                ]}
              >
                <Text
                  style={[
                    styles.tabBadgeText,
                    activeTab === tab.id && styles.tabBadgeTextActive,
                  ]}
                >
                  {tab.count}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Finding skill matches...</Text>
        </View>
      ) : (
        <FlatList
          data={getFilteredMatches()}
          renderItem={renderMatch}
          keyExtractor={(item) => item.user.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor={theme.colors.primary}
            />
          }
        />
      )}

      {/* Proposal Modal */}
      <SkillExchangeProposalModal
        visible={showProposalModal}
        onClose={() => {
          setShowProposalModal(false);
          setSelectedMatch(null);
        }}
        receiver={selectedMatch?.user}
        receiverSkills={selectedMatch?.skills_can_teach || []}
        mySkills={mySkills}
        onProposed={() => {
          setShowProposalModal(false);
          setSelectedMatch(null);
          refresh();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    padding: theme.spacing.xs,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
  },
  headerRight: {
    width: 32,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary + '10',
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: theme.colors.primary,
    lineHeight: 18,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    gap: 4,
  },
  tabActive: {
    backgroundColor: theme.colors.primary,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.colors.textSecondary,
  },
  tabTextActive: {
    color: 'white',
  },
  tabBadge: {
    backgroundColor: theme.colors.gray[300],
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
  },
  tabBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.colors.text,
  },
  tabBadgeTextActive: {
    color: 'white',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  loadingText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  listContent: {
    padding: theme.spacing.md,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.xl * 2,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: theme.colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: theme.spacing.lg,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    gap: 8,
  },
  refreshButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.primary,
  },
});
