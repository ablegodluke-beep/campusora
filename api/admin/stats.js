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
        table + "?select=id" + (filters ? "&" + filters : ""),
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

    // Fetch matching rows in manageable batches.
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

        if (!Array.isArray(rows)) {
          throw new Error("Unexpected database response.");
        }

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

      const [count, result] = await Promise.all([
        countRows(table, filters),
        fetchAllRows(table, "amount_kobo", filters)
      ]);

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

    // Gift revenue: count only paid LIVE payments
    // and include only Campusora's platform share.
    async function giftSummary() {
      const filters =
        "status=eq.paid&paid_at=not.is.null&payment_mode=eq.live";

      const [count, payments] = await Promise.all([
        countRows("campusora_gift_payments", filters),
        fetchAllRows(
          "campusora_gift_payments",
          "id,amount_kobo",
          filters
        )
      ]);

      let platformRevenue = 0;
      let ledgerRecords = 0;
      let missingRevenueRecords = 0;
      let amountMismatches = 0;
      let complete = payments.complete;

      const paymentMap = new Map(
        payments.rows.map(payment => [
          payment.id,
          Number(payment.amount_kobo) / 100
        ])
      );

      const paymentIds = payments.rows.map(payment => payment.id);

      // Fetch the linked revenue ledger in small batches.
      for (let i = 0; i < paymentIds.length; i += 50) {
        const batch = paymentIds.slice(i, i + 50);
        const idList = batch.join(",");

        const result = await fetchAllRows(
          "campusora_gift_platform_revenue",
          "payment_id,gift_value,platform_share",
          "payment_id=in.(" + idList + ")"
        );

        if (!result.complete) {
          complete = false;
        }

        ledgerRecords += result.rows.length;

        const matchedIds = new Set();

        for (const row of result.rows) {
          const paymentAmount = paymentMap.get(row.payment_id);

          if (paymentAmount === undefined) {
            continue;
          }

          matchedIds.add(row.payment_id);

          const giftValue = Number(row.gift_value);
          const platformShare = Number(row.platform_share);

          if (
            !Number.isFinite(giftValue) ||
            !Number.isFinite(platformShare)
          ) {
            complete = false;
            continue;
          }

          if (Math.round(paymentAmount * 100) !==
              Math.round(giftValue * 100)) {
            amountMismatches++;
            complete = false;
            continue;
          }

          platformRevenue += platformShare;
        }

        for (const paymentId of batch) {
          if (!matchedIds.has(paymentId)) {
            missingRevenueRecords++;
          }
        }
      }

      if (missingRevenueRecords > 0 || amountMismatches > 0) {
        complete = false;
      }

      return {
        count,
        revenue: platformRevenue,
        ledgerRecords,
        missingRevenueRecords,
        amountMismatches,
        complete
      };
    }

    // Load platform statistics.
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

        gift_audit: {
          paid_live_gift_payments: gifts.count,
          revenue_ledger_records: gifts.ledgerRecords,
          missing_revenue_records: gifts.missingRevenueRecords,
          amount_mismatches: gifts.amountMismatches,
          complete: gifts.complete
        },

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
