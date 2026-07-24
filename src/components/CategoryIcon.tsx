import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface CategoryIconProps {
  iconName: string;
  color: string;
  size?: number;
  label?: string;
  showLabel?: boolean;
}

export default function CategoryIcon({ iconName, color, size = 24, label, showLabel = false }: CategoryIconProps) {
  return (
    <View style={styles.container}>
      <View style={[styles.iconWrapper, { backgroundColor: color + '20' }]}>
        <MaterialCommunityIcons name={iconName as any} size={size} color={color} />
      </View>
      {showLabel && label ? (
        <Text style={[styles.label, { color }]} numberOfLines={1}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 11,
    marginTop: 2,
    maxWidth: 60,
    textAlign: 'center',
  },
});
