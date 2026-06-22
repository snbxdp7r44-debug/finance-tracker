import React from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { useRouter } from 'expo-router';
import TransactionForm from '../../src/components/TransactionForm';

export default function TransactionAddScreen() {
  const router = useRouter();

  const handleSuccess = () => {
    // The store's addTransaction already reloads monthly data; just navigate home.
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
