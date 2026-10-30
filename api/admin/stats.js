module.exports = async function handler(req, res) {
res.setHeader("Cache-Control", "no-store");

if (req.method !== "GET") {
res.setHeader("Allow", "GET");
return res.status(405).json({
success: false,
message: "Method not allowed."
});
}

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !KEY) {
return res.status(500).json({
success: false,
message: "Admin service is not configured."
});
}

try {
// Verify administrator session.
const authHeader = req.headers.authorization || "";
const token = authHeader.startsWith("Bearer ")
? authHeader.slice(7)
: "";

if (!token) {
  return res.status(401).json({
    success: false,
    message: "Please log in."
  });
}

const userResponse = await fetch(URL + "/auth/v1/user", {
  headers: {
    apikey: KEY,
    Authorization: "Bearer " + token
  }
});

const user = await userResponse.json().catch(() => ({}));

if (!userResponse.ok || !user.id) {
  return res.status(401).json({
    success: false,
    message: "Invalid login session."
  });
}

const adminResponse = await fetch(
  URL + "/rest/v1/campusora_admins?user_id=eq." +
  encodeURIComponent(user.id) +
  "&select=user_id,admin_role",
  {
    headers: {
      apikey: KEY,
      Authorization: "Bearer " + KEY
    }
  }
);

if (!adminResponse.ok) {
  return res.status(500).json({
    success: false,
    message: "Could not verify administrator access."
  });
}

const admins = await adminResponse.json();
const admin = admins[0];

if (!admin || !["admin", "super_admin"].includes(admin.admin_role)) {
  return res.status(403).json({
    success: false,
    message: "Administrator access required."
  });
}

// Shared database request.
async function databaseRequest(path, options = {}) {
  const response = await fetch(URL + "/rest/v1/" + path, {
    ...options,
    headers: {
      apikey: KEY,
      Authorization: "Bearer " + KEY,
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Statistics database error:", errorText);
    throw new Error("A statistics database request failed.");
  }

  return response;
}

// Exact table count.
async function countRows(table, filters = "") {
  const response = await databaseRequest(
    table + "?select=*&" + filters,
    {
      method: "HEAD",
      headers: {
        Prefer: "count=exact",
        Range: "0-0"
      }
    }
  );

  const contentRange = response.headers.get("content-range");

  if (!contentRange) return null;

  const total = contentRange.split("/")[1];

  return total === "*" ? null : Number(total);
}

// Fetch all matching rows in manageable batches.
async function fetchAllRows(table, select, filters = "") {
  const allRows = [];
  const batchSize = 1000;
  const maximumRows = 50000;

  for (let offset = 0; offset < maximumRows; offset += batchSize) {
    const path =
      table +
      "?select=" + encodeURIComponent(select) +
      (filters ? "&" + filters : "") +
      "&limit=" + batchSize +
      "&offset=" + offset;

    const response = await databaseRequest(path);
    const rows = await response.json();

    allRows.push(...rows);

    if (rows.length < batchSize) {
      return {
        rows: allRows,
        complete: true
      };
    }
  }

  return {
    rows: allRows,
    complete: false
  };
}

// Only verified LIVE payments count as genuine platform payments.
async function paymentSummary(table) {
  const filters =
    "payment_verified=eq.true&payment_mode=eq.live";

  const count = await countRows(table, filters);

  const result = await fetchAllRows(
    table,
    "amount_kobo",
    filters
  );

  const revenueKobo = result.rows.reduce(
    (total, row) =>
      total + Number(row.amount_kobo || 0),
    0
  );

  return {
    count,
    revenue: revenueKobo / 100,
    complete: result.complete
  };
}

// Gift revenue: only Campusora's platform share.
// Join live, paid gift payments to the gift revenue ledger.
async function giftSummary() {
  const filters =
    "payment_mode=eq.live&paid_at=not.is.null";

  const count = await countRows(
    "campusora_gift_payments",
    filters
  );

  const payments = await fetchAllRows(
    "campusora_gift_payments",
    "id",
    filters
  );

  if (!payments.rows.length) {
    return {
      count,
      revenue: 0,
      complete: payments.complete
    };
  }

  const paymentIds = payments.rows.map(row => row.id);
  let platformRevenue = 0;
  let complete = payments.complete;

  // Keep each IN query small.
  for (let i = 0; i < paymentIds.length; i += 50) {
    const batch = paymentIds.slice(i, i + 50);
    const idList = batch.join(",");

    const result = await fetchAllRows(
      "campusora_gift_platform_revenue",
      "payment_id,platform_share",
      "payment_id=in.(" + idList + ")"
    );

    platformRevenue += result.rows.reduce(
      (total, row) =>
        total + Number(row.platform_share || 0),
      0
    );

    if (!result.complete) complete = false;
  }

  return {
    count,
    revenue: platformRevenue,
    complete
  };
}

// Platform activity and payment summaries.
const results = await Promise.all([
  countRows("profiles"),
  countRows("posts"),
  countRows("spotlight_videos"),
  countRows("communities"),
  countRows("events"),

  countRows(
    "sponsored_campaigns",
    "status=eq.active&payment_verified=eq.true&payment_mode=eq.live"
  ),

  countRows(
    "content_reports",
    "status=eq.pending"
  ),

  paymentSummary("premium_memberships"),
  paymentSummary("profile_ranks"),
  paymentSummary("sponsored_campaigns"),
  giftSummary()
]);

const [
  users,
  posts,
  videos,
  communities,
  events,
  campaigns,
  pendingReports,
  premium,
  ranks,
  sponsored,
  gifts
] = results;

const paymentCounts = [
  premium.count,
  ranks.count,
  sponsored.count,
  gifts.count
];

const payments = paymentCounts.some(value => value === null)
  ? null
  : paymentCounts.reduce((total, value) => total + value, 0);

const revenueComplete =
  premium.complete &&
  ranks.complete &&
  sponsored.complete &&
  gifts.complete;

const revenue = revenueComplete
  ? premium.revenue +
    ranks.revenue +
    sponsored.revenue +
    gifts.revenue
  : null;

return res.status(200).json({
  success: true,

  statistics: {
    users,
    posts,
    videos,
    communities,
    events,
    payments,
    revenue,
    campaigns,
    pendingReports
  },

  revenue_details: {
    premium: premium.revenue,
    profile_ranks: ranks.revenue,
    sponsored_campaigns: sponsored.revenue,
    gifts_platform_share: gifts.revenue,
    currency: "NGN",
    payment_filter: "Verified live payments only",
    complete: revenueComplete
  }
});

} catch (error) {
console.error("Admin statistics error:", error);

return res.status(500).json({
  success: false,
  message: error.message || "Could not load dashboard statistics."
});

}
};
