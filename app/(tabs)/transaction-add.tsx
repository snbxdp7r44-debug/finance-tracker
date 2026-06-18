import React from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { useSQLiteContext } from 'expo-sqlite';
import { useRouter } from 'expo-router';
import TransactionForm from '../../src/components/TransactionForm';
import { useTransactionStore } from '../../src/stores/transactionStore';

export default function TransactionAddScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { currentMonth, loadMonthlyData } = useTransactionStore();

  const handleSuccess = async () => {
    // Reload data for the current month after adding a transaction
    await loadMonthlyData(db, currentMonth);
    // Navigate to home screen
    router.navigate('/');
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.title}>记一笔</Text>
      </View>
      <TransactionForm onSuccess={handleSuccess} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
  },
});
