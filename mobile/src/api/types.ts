/**
 * The API's JSON exactly as backend/docs/api-contract.md defines it (snake_case,
 * money as decimal strings, times as UTC ISO strings). Services map these to the
 * app's own models; nothing else should import them.
 */

export type Money = string;

export type CategoryGroup = 'spending' | 'money_in' | 'own_money';

export type ApiCategoryRef = { id: string; name: string; group: CategoryGroup };

export type CounterpartyKind =
  | 'person'
  | 'merchant'
  | 'agent'
  | 'telco'
  | 'bank'
  | 'own_wallet'
  | 'unknown';

export type ApiCounterpartyRef = { id: string; name: string; kind: CounterpartyKind };

export type ApiPage<T> = { items: T[]; next_cursor: string | null };

export type ApiPeriod = { from: string; to: string; days?: number };

/** `GET /v1/summary` */
export type ApiSummary = {
  period: ApiPeriod;
  currency: string;
  money_out: Money;
  money_in: Money;
  net: Money;
  fees: Money;
  avg_daily_spend: Money;
  spending_transactions: number;
  compare: {
    period: ApiPeriod;
    money_out: Money;
    money_out_change: string | null;
    money_in_change: string | null;
  };
  top_category: { id: string; name: string; share: string } | null;
  recurring_monthly_cost: Money;
  includes_provisional: boolean;
};

/** `GET /v1/summary/categories` */
export type ApiCategorySummary = {
  period: ApiPeriod;
  total: Money;
  items: {
    category: ApiCategoryRef;
    amount: Money;
    share: string;
    transactions: number;
    budget: { limit: Money; used: string } | null;
  }[];
};

/** `GET /v1/summary/trend` */
export type ApiTrend = {
  granularity: 'day' | 'week' | 'month';
  items: { period: string; money_out: Money; money_in: Money; fees: Money }[];
};

/** `GET /v1/balances` */
export type ApiBalances = {
  total: Money;
  items: { wallet_id: string; provider: string; balance: Money; as_of: string }[];
};

/** `GET /v1/wallets` */
export type ApiWallet = {
  id: string;
  provider: string;
  phone_number: string;
  account_name: string;
  label: string | null;
  latest_balance: Money | null;
  balance_as_of: string | null;
  created_at: string;
};

/** `GET /v1/insights` */
export type ApiInsight = {
  id: string;
  severity: 'info' | 'tip' | 'warning';
  title: string;
  body: string;
  link: string | null;
};

/** `GET /v1/recurring` */
export type ApiRecurringList = {
  monthly_cost: Money;
  items: {
    id: string;
    label: string;
    counterparty: ApiCounterpartyRef;
    category: ApiCategoryRef;
    rhythm: string;
    interval_days: number;
    typical_amount: Money;
    payments: number;
    first_paid_at: string;
    last_paid_at: string;
    status: 'active' | 'stopped';
    monthly_cost: Money;
    user_state: 'expected' | 'cancel_planned' | 'not_recurring' | null;
  }[];
};

/** `GET /v1/budgets` */
export type ApiBudgets = {
  month: string;
  items: {
    id: string;
    category: ApiCategoryRef;
    limit: Money;
    spent: Money;
    remaining: Money;
    used: string;
    projected: Money;
    state: 'on_track' | 'warning' | 'over';
    alert_thresholds: string[];
  }[];
};

export type TransactionType =
  | 'transfer'
  | 'airtime'
  | 'cashout'
  | 'cashin'
  | 'merchant'
  | 'bank_transfer'
  | 'refund'
  | 'interest'
  | 'savings'
  | 'reversal';

/** One item of `GET /v1/transactions`. */
export type ApiTransaction = {
  id: string;
  status: 'final' | 'provisional';
  occurred_at: string;
  provider: string;
  wallet_id: string | null;
  type: TransactionType;
  direction: 'in' | 'out';
  amount: Money;
  fee: Money;
  tax: Money;
  total_cost: Money;
  balance_after: Money | null;
  currency: string;
  category: ApiCategoryRef;
  category_source: 'rule' | 'user' | 'counterparty_default';
  counterparty: ApiCounterpartyRef;
  reference: string | null;
  note: string | null;
  is_own_transfer: boolean;
  recurring_id: string | null;
  flags: ('balance_gap' | 'duplicate_sms_merged')[];
};

/** `GET /v1/transactions/{id}` */
export type ApiTransactionDetail = ApiTransaction & {
  sms_text: string;
  sms_count: number;
  category_explanation: string | null;
  provider_txn_id: string | null;
};

/** `PATCH /v1/transactions/{id}` body. */
export type ApiTransactionPatch = {
  category?: string | null;
  note?: string | null;
  apply_to_counterparty?: boolean;
};

/** `GET /v1/categories` */
export type ApiCategories = {
  items: (ApiCategoryRef & { user_selectable: boolean })[];
};

/** `GET /v1/sync/status` */
export type ApiSyncStatus = {
  latest_date_ms: string | null;
  last_upload_at: string | null;
  pending_messages: number;
  provisional_transactions: number;
  last_pipeline_run: { status: 'succeeded' | 'failed' | 'running'; finished_at: string | null } | null;
  data_through: string | null;
};

export type NotificationKind =
  | 'budget_warning'
  | 'budget_over'
  | 'low_balance'
  | 'new_recurring'
  | 'recurring_still_charging'
  | 'weekly_digest'
  | 'data_ready'
  | 'sync_problem';

/** `GET /v1/notifications` */
export type ApiNotifications = {
  unread: number;
  items: {
    id: string;
    kind: NotificationKind;
    title: string;
    body: string;
    created_at: string;
    read_at: string | null;
    link: string | null;
  }[];
  next_cursor?: string | null;
};

/** RFC 9457 problem details, the body of every error response. */
export type ApiProblem = {
  type?: string;
  title?: string;
  status: number;
  code: string;
  detail?: string;
  errors?: { field: string; message: string }[];
};
