import { SQLiteDatabase } from 'expo-sqlite';

// Default category definitions with icons and colors
const DEFAULT_EXPENSE_CATEGORIES = [
  { name: '餐饮', icon: 'food', color: '#FF5722' },
  { name: '交通', icon: 'car', color: '#2196F3' },
  { name: '购物', icon: 'cart', color: '#E91E63' },
  { name: '娱乐', icon: 'gamepad-variant', color: '#9C27B0' },
  { name: '居住', icon: 'home', color: '#795548' },
  { name: '医疗', icon: 'medical-bag', color: '#F44336' },
  { name: '教育', icon: 'school', color: '#3F51B5' },
  { name: '通讯', icon: 'cellphone', color: '#00BCD4' },
  { name: '其他', icon: 'dots-horizontal', color: '#607D8B' },
];

const DEFAULT_INCOME_CATEGORIES = [
  { name: '工资', icon: 'cash', color: '#4CAF50' },
  { name: '奖金', icon: 'gift', color: '#8BC34A' },
  { name: '投资', icon: 'chart-line', color: '#009688' },
  { name: '兼职', icon: 'briefcase', color: '#CDDC39' },
  { name: '其他', icon: 'dots-horizontal', color: '#607D8B' },
];

// Default keyword rules for auto-categorization
const DEFAULT_CATEGORY_RULES: Record<string, string[]> = {
  '餐饮': ['早饭', '午饭', '晚饭', '早餐', '午餐', '晚餐', '咖啡', '奶茶', '外卖', '餐厅', '小吃', '夜宵', '水果', '饮料', '零食', '聚餐'],
  '交通': ['地铁', '公交', '打车', '出租车', '加油', '停车', '高铁', '火车', '飞机', '滴滴', '骑行', '单车'],
  '购物': ['超市', '淘宝', '京东', '拼多多', '商场', '网购', '快递', '买菜'],
  '娱乐': ['电影', '游戏', '唱歌', 'KTV', '旅游', '门票', '演出', '健身'],
  '居住': ['房租', '水电', '物业', '维修', '家具', '装修', '宽带', '燃气'],
  '医疗': ['医院', '药', '体检', '挂号', '看病', '诊所'],
  '教育': ['学费', '培训', '书', '课程', '考试'],
  '通讯': ['话费', '流量', '充值', '手机'],
};

const CURRENT_DB_VERSION = 2;

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  const userVersion = await db.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version'
  );
  const currentVersion = userVersion?.user_version ?? 0;

  if (currentVersion < 1) {
    await migrateV1(db);
  }

  if (currentVersion < 2) {
    await migrateV2(db);
  }
}

async function migrateV1(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      icon TEXT NOT NULL,
      color TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS category_rules (
      id INTEGER PRIMARY KEY NOT NULL,
      category_id INTEGER NOT NULL,
      keyword TEXT NOT NULL,
      priority INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_category_rules_keyword
      ON category_rules(keyword, category_id);
  `);

  // Seed default categories
  await seedDefaultCategories(db);

  // Seed default category rules
  await seedDefaultCategoryRules(db);

  // Update database version
  await db.runAsync(`PRAGMA user_version = ${1}`);
}

async function seedDefaultCategories(db: SQLiteDatabase): Promise<void> {
  // Check if categories already exist
  const existing = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM categories WHERE is_default = 1'
  );
  if (existing && existing.count > 0) return;

  // Insert expense categories
  for (const cat of DEFAULT_EXPENSE_CATEGORIES) {
    await db.runAsync(
      'INSERT INTO categories (name, icon, color, type, is_default) VALUES (?, ?, ?, ?, ?)',
      [cat.name, cat.icon, cat.color, 'expense', 1]
    );
  }

  // Insert income categories
  for (const cat of DEFAULT_INCOME_CATEGORIES) {
    await db.runAsync(
      'INSERT INTO categories (name, icon, color, type, is_default) VALUES (?, ?, ?, ?, ?)',
      [cat.name, cat.icon, cat.color, 'income', 1]
    );
  }
}

async function seedDefaultCategoryRules(db: SQLiteDatabase): Promise<void> {
  // Check if rules already exist
  const existing = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM category_rules'
  );
  if (existing && existing.count > 0) return;

  for (const [categoryName, keywords] of Object.entries(DEFAULT_CATEGORY_RULES)) {
    // Find the category id by name
    const category = await db.getFirstAsync<{ id: number }>(
      'SELECT id FROM categories WHERE name = ? AND is_default = 1',
      [categoryName]
    );
    if (!category) continue;

    for (const keyword of keywords) {
      await db.runAsync(
        'INSERT INTO category_rules (category_id, keyword, priority) VALUES (?, ?, ?)',
        [category.id, keyword, 0]
      );
    }
  }
}

async function migrateV2(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY NOT NULL,
      amount REAL NOT NULL CHECK(amount > 0),
      type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
      category_id INTEGER NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      date TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
    CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
  `);

  // Update database version
  await db.runAsync(`PRAGMA user_version = ${2}`);
}
