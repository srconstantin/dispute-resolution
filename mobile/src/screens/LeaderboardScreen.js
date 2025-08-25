import React from 'react';
import { View, Text, StyleSheet, FlatList, SafeAreaView, TouchableOpacity } from 'react-native';
import { theme } from '../styles/theme';

const MOCK_PLAYERS = [
  { id: '1', name: 'Alice', wins: 18, losses: 4 },
  { id: '2', name: 'Bob', wins: 15, losses: 7 },
  { id: '3', name: 'Charlie', wins: 12, losses: 9 },
  { id: '4', name: 'Dana', wins: 10, losses: 10 },
  { id: '5', name: 'Eve', wins: 9, losses: 12 },
];

const calculateWinRate = (wins, losses) => {
  const total = wins + losses;
  if (!total) return '—';
  return `${Math.round((wins / total) * 100)}%`;
};

export default function LeaderboardScreen({ onBack }) {
  const renderItem = ({ item, index }) => (
    <View style={[styles.row, index === 0 && styles.firstRow]}> 
      <Text style={[styles.cellRank]}>{index + 1}</Text>
      <Text style={[styles.cellName]} numberOfLines={1}>{item.name}</Text>
      <Text style={[styles.cellStat]}>{item.wins}</Text>
      <Text style={[styles.cellStat]}>{item.losses}</Text>
      <Text style={[styles.cellRate]}>{calculateWinRate(item.wins, item.losses)}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>RANKED COMPETITIVE FAIRENOUGH</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.tableHeader}>
          <Text style={[styles.hRank]}>#</Text>
          <Text style={[styles.hName]}>User</Text>
          <Text style={[styles.hStat]}>Wins</Text>
          <Text style={[styles.hStat]}>Losses</Text>
          <Text style={[styles.hRate]}>Win Rate</Text>
        </View>

        <FlatList
          data={MOCK_PLAYERS}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: theme.spacing.xl }}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingTop: 50,
    paddingHorizontal: theme.spacing.xl,
    paddingBottom: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    ...theme.shadows.small,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: theme.spacing.md,
  },
  backText: {
    color: theme.colors.primary,
    fontSize: 16,
    fontFamily: theme.fonts.headingRegular,
  },
  title: {
    fontSize: 22,
    color: theme.colors.text,
    fontFamily: theme.fonts.displayLarge,
  },
  card: {
    backgroundColor: theme.colors.surface,
    margin: theme.spacing.xl,
    borderRadius: theme.borderRadius.large,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.medium,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    marginBottom: theme.spacing.sm,
  },
  hRank: {
    width: 28,
    textAlign: 'center',
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.bodyBold,
  },
  hName: {
    flex: 1,
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.bodyBold,
  },
  hStat: {
    width: 60,
    textAlign: 'center',
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.bodyBold,
  },
  hRate: {
    width: 80,
    textAlign: 'center',
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.bodyBold,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  firstRow: {
    backgroundColor: '#FFF9E6',
    borderRadius: theme.borderRadius.small,
  },
  cellRank: {
    width: 28,
    textAlign: 'center',
    color: theme.colors.text,
    fontFamily: theme.fonts.bodyBold,
  },
  cellName: {
    flex: 1,
    color: theme.colors.text,
    fontFamily: theme.fonts.headingRegular,
  },
  cellStat: {
    width: 60,
    textAlign: 'center',
    color: theme.colors.text,
    fontFamily: theme.fonts.body,
  },
  cellRate: {
    width: 80,
    textAlign: 'center',
    color: theme.colors.text,
    fontFamily: theme.fonts.headingMedium,
  },
});


