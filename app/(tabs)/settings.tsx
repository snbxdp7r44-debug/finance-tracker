import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { List, Divider, Switch, Text } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'react-native';

export default function SettingsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>设置</Text>
      </View>

      <List.Section>
        <List.Subheader>数据管理</List.Subheader>
        <List.Item
          title="分类管理"
          description="管理收支分类和关键词规则"
          left={(props) => <List.Icon {...props} icon="tag-multiple" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => router.push('/category-management')}
        />
      </List.Section>

      <Divider />

      <List.Section>
        <List.Subheader>外观</List.Subheader>
        <List.Item
          title="深色模式"
          description="跟随系统设置"
          left={(props) => <List.Icon {...props} icon="theme-light-dark" />}
          right={() => (
            <Switch value={isDark} disabled />
          )}
        />
      </List.Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
});
