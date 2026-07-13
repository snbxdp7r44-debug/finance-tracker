import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { LineChart, PieChart } from 'react-native-chart-kit';
import { Card } from 'react-native-paper';
import { useSQLiteContext } from 'expo-sqlite';
import { getMonthlyTrend, getMonthlyExpenseByCategory, MonthlyTrendPoint, CategoryExpenseTotal } from '../../src/database';

const TREND_MONTHS = 6;
const screenWidth = Dimensions.get('window').width;

function formatMonthLabel(month: string): string {
  const [, m] = month.split('-');
  return `${parseInt(m)}月`;
}

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export default function StatisticsScreen() {
  const db = useSQLiteContext();
  const [trendData, setTrendData] = useState<MonthlyTrendPoint[]>([]);
  const [categoryExpenses, setCategoryExpenses] = useState<CategoryExpenseTotal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const currentMonth = getCurrentMonth();

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [trend, expenses] = await Promise.all([
        getMonthlyTrend(db, TREND_MONTHS),
        getMonthlyExpenseByCategory(db, currentMonth),
      ]);
      setTrendData(trend);
      setCategoryExpenses(expenses);
    } catch {
      setError('加载数据失败，请检查数据库连接后重试');
    } finally {
      setLoading(false);
    }
  }, [db, currentMonth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.statusText}>加载中...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  const lineChartData = {
    labels: trendData.map((d) => formatMonthLabel(d.month)),
    datasets: [
      {
        data: trendData.map((d) => d.income),
        color: () => '#4CAF50',
        strokeWidth: 2,
      },
      {
        data: trendData.map((d) => d.expense),
        color: () => '#F44336',
        strokeWidth: 2,
      },
    ],
    legend: ['收入', '支出'],
  };

  const pieChartData = categoryExpenses.map((c) => ({
    name: c.category_name,
    amount: c.total,
    color: c.category_color,
    legendFontColor: '#333',
    legendFontSize: 12,
  }));

  const hasTrendData = trendData.some((d) => d.income > 0 || d.expense > 0);
  const hasPieData = categoryExpenses.length > 0;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>统计</Text>

      <Card style={styles.chartCard}>
        <Card.Content>
          <Text style={styles.chartTitle}>收支趋势（近{TREND_MONTHS}个月）</Text>
          {hasTrendData ? (
            <LineChart
              data={lineChartData}
              width={screenWidth - 64}
              height={220}
              yAxisLabel="¥"
              yAxisSuffix=""
              chartConfig={{
                backgroundColor: '#fff',
                backgroundGradientFrom: '#fff',
                backgroundGradientTo: '#fff',
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                labelColor: () => '#666',
                propsForDots: {
                  r: '4',
                  strokeWidth: '2',
                },
              }}
              bezier
              style={styles.chart}
            />
          ) : (
            <View style={styles.emptyChart}>
              <Text style={styles.emptyText}>暂无数据</Text>
            </View>
          )}
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#4CAF50' }]} />
              <Text style={styles.legendLabel}>收入</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#F44336' }]} />
              <Text style={styles.legendLabel}>支出</Text>
            </View>
          </View>
        </Card.Content>
      </Card>

      <Card style={styles.chartCard}>
        <Card.Content>
          <Text style={styles.chartTitle}>支出分类占比（{currentMonth}）</Text>
          {hasPieData ? (
            <PieChart
              data={pieChartData}
              width={screenWidth - 64}
              height={220}
              chartConfig={{
                color: () => '#333',
              }}
              accessor="amount"
              backgroundColor="transparent"
              paddingLeft="15"
              style={styles.chart}
            />
          ) : (
            <View style={styles.emptyChart}>
              <Text style={styles.emptyText}>本月暂无支出记录</Text>
            </View>
          )}
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 16,
    opacity: 0.5,
  },
  errorText: {
    fontSize: 16,
    color: '#F44336',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    padding: 16,
    paddingBottom: 8,
  },
  chartCard: {
    marginHorizontal: 16,
    marginTop: 12,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  chart: {
    borderRadius: 8,
  },
  emptyChart: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    opacity: 0.4,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginTop: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLabel: {
    fontSize: 13,
    color: '#666',
  },
});
