import { View, Text, StyleSheet } from 'react-native';

export default function TransactionAddScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>记一笔</Text>
      <Text style={styles.subtitle}>添加收支记录</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 16,
    marginTop: 8,
    opacity: 0.6,
  },
});
