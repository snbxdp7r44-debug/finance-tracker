import React from 'react';
import { SQLiteProvider } from 'expo-sqlite';
import { runMigrations } from './migrations';

interface DatabaseProviderProps {
  children: React.ReactNode;
}

export default function DatabaseProvider({ children }: DatabaseProviderProps) {
  return (
    <SQLiteProvider
      databaseName="finance.db"
      onInit={runMigrations}
      options={{ enableChangeListener: true }}
    >
      {children}
    </SQLiteProvider>
  );
}
