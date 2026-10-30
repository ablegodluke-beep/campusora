const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const TABLES = {
users: {
table: "profiles",
select: "id,username,full_name,bio,school,role,avatar_url,created_at",
filter: "created_at"
},
reports: {
table: "content_reports",
select: "",
filter: "created_at"
},
deletions: {
table: "account_lifecycle",
select: "",
filter: "updated_at"
},
applications: {
table: "creator_reward_applications",
select: "",
filter: "created_at"
},
creatorEarnings: {
table: "creator_reward_earnings",
select: "",
filter: "created_at"
},
creatorPayouts: {
table: "creator_reward_payouts",
select: "",
filter: "created_at"
},
giftPayouts: {
table: "campusora_gift_payout_requests",
select: "",
filter: "requested_at"
},
premium: {
table: "premium_memberships",
select: "",
filter: "created_at"
},
ranks: {
table: "profile_ranks",
select: "",
filter: "created_at"
},
campaigns: {
table: "sponsored_campaigns",
select: "",
filter: "created_at"
},
promotions: {
table: "campusora_business_promotions",
select: "",
filter: "created_at"
},
communities: {
table: "communities",
select: "",
filter: "created_at"
},
events: {
table: "events",
select: "",
filter: "created_at"
},
products: {
table: "products",
select: "",
filter: "created_at"
},
listings: {
table: "marketplace_listings",
select: "",
filter: "created_at"
},
marketplaceReports: {
table: "marketplace_reports",
select: "",
filter: "created_at"
},
activity: {
table: "campusora_admin_activity",
select: "",
filter: "created_at"
},
restrictions: {
table: "campusora_account_restrictions",
select: "*",
filter: "created_at"
}
};

const EDITABLE = {
reports: ["status", "admin_note", "reviewed_by", "reviewed_at"],
applications: ["application_status", "review_notes", "reviewed_by", "reviewed_at"],
creatorPayouts: ["payout_status", "admin_notes", "payout_reference", "paid_at"],
giftPayouts: [
"status", "admin_note", "payment_reference",
"processed_at", "reviewed_at", "reviewed_by",
"rejection_reason", "external_transfer_reference"
],
campaigns: [
"status", "admin_note", "moderation_note",
"moderated_at", "moderated_by", "starts_at",
"ends_at", "expires_at"
],
promotions: ["status", "start_at", "end_at", "priority"],
communities: ["name", "description", "school"],
events: ["status"],
products: ["status"],
listings: ["status"],
marketplaceReports: ["status"],
restrictions: ["is_active", "ends_at", "lifted_by", "lifted_at"],
deletions: ["status", "delete_after"]
};

async function rest(path, options = {}) {
const response = await fetch("${URL}/rest/v1/${path}", {
...options,
headers: {
apikey: KEY,
Authorization: "Bearer ${KEY}",
"Content-Type": "application/json",
...(options.headers || {})
}
});

const body = await response.text();

if (!response.ok) {
throw new Error(body || "Database request failed.");
}

return body ? JSON.parse(body) : [];
}

async function verifyAdmin(req) {
const auth = req.headers.authorization || "";
const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

if (!token) {
const error = new Error("Please log in.");
error.status = 401;
throw error;
}

const response = await fetch("${URL}/auth/v1/user", {
headers: {
apikey: KEY,
Authorization: "Bearer ${token}"
}
});

const user = await response.json().catch(() => ({}));

if (!response.ok || !user.id) {
const error = new Error("Your session is invalid.");
error.status = 401;
throw error;
}

const admins = await rest(
"campusora_admins?user_id=eq.${encodeURIComponent(user.id)}&select=user_id,admin_role"
);

if (!admins.length || !["admin", "super_admin"].includes(admins[0].admin_role)) {
const error = new Error("Administrator access required.");
error.status = 403;
throw error;
}

return user;
}

async function audit(userId, action, table, id, details = {}) {
try {
await rest("campusora_admin_activity", {
method: "POST",
headers: { Prefer: "return=minimal" },
body: JSON.stringify({
admin_id: userId,
action,
target_type: table,
target_id: String(id || ""),
details
})
});
} catch (error) {
console.error("Admin audit log error:", error.message);
}
}

module.exports = async function handler(req, res) {
res.setHeader("Cache-Control", "no-store");

if (!URL || !KEY) {
return res.status(500).json({
success: false,
message: "Admin service is not configured."
});
}

try {
const admin = await verifyAdmin(req);

if (req.method === "GET") {
  const section = String(req.query.section || "");
  const config = TABLES[section];

  if (!config) {
    return res.status(400).json({
      success: false,
      message: "Unknown management section."
    });
  }

  const limit = Math.min(
    100,
    Math.max(1, Number(req.query.limit) || 50)
  );

  const offset = Math.max(0, Number(req.query.offset) || 0);

  const rows = await rest(
    `${config.table}?select=${encodeURIComponent(config.select)}&order=${config.filter}.desc&limit=${limit}&offset=${offset}`
  );

  return res.status(200).json({
    success: true,
    section,
    count: rows.length,
    data: rows
  });
}

if (req.method === "POST") {
  const body = typeof req.body === "string"
    ? JSON.parse(req.body || "{}")
    : req.body || {};

  const section = String(body.section || "");
  const operation = String(body.operation || "");
  const id = String(body.id || "");
  const config = TABLES[section];

  if (!config) {
    return res.status(400).json({
      success: false,
      message: "Unknown management section."
    });
  }

  if (operation === "update") {
    const allowed = EDITABLE[section];

    if (!allowed || !id || !body.changes || typeof body.changes !== "object") {
      return res.status(400).json({
        success: false,
        message: "Invalid update request."
      });
    }

    const changes = {};

    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(body.changes, key)) {
        changes[key] = body.changes[key];
      }
    }

    if (!Object.keys(changes).length) {
      return res.status(400).json({
        success: false,
        message: "No permitted fields were supplied."
      });
    }

    const rows = await rest(
      `${config.table}?id=eq.${encodeURIComponent(id)}&select=*`,
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(changes)
      }
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Record not found."
      });
    }

    await audit(admin.id, "update", config.table, id, changes);

    return res.status(200).json({
      success: true,
      message: "Record updated.",
      data: rows[0]
    });
  }

  if (operation === "restrict_user" && section === "users") {
    const userId = id;
    const restrictionType = String(body.restriction_type || "");
    const reason = String(body.reason || "").trim();
    const endsAt = body.ends_at || null;

    if (!userId || !["warning", "temporary", "permanent"].includes(restrictionType) || !reason) {
      return res.status(400).json({
        success: false,
        message: "Provide a valid restriction type and reason."
      });
    }

    const rows = await rest("campusora_account_restrictions", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        user_id: userId,
        restriction_type: restrictionType,
        reason,
        starts_at: new Date().toISOString(),
        ends_at: endsAt,
        is_active: true,
        created_by: admin.id
      })
    });

    await audit(admin.id, "restrict_user", "profiles", userId, {
      restriction_type: restrictionType,
      reason
    });

    return res.status(200).json({
      success: true,
      message: "Account restriction recorded.",
      data: rows[0]
    });
  }

  if (operation === "lift_restriction" && section === "restrictions") {
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Restriction ID is required."
      });
    }

    const rows = await rest(
      `campusora_account_restrictions?id=eq.${encodeURIComponent(id)}&select=*`,
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          is_active: false,
          lifted_by: admin.id,
          lifted_at: new Date().toISOString()
        })
      }
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Restriction not found."
      });
    }

    await audit(admin.id, "lift_restriction", "campusora_account_restrictions", id);

    return res.status(200).json({
      success: true,
      message: "Restriction lifted."
    });
  }

  return res.status(400).json({
    success: false,
    message: "Unsupported management operation."
  });
}

res.setHeader("Allow", "GET, POST");

return res.status(405).json({
  success: false,
  message: "Method not allowed."
});

} catch (error) {
console.error("Admin management API error:", error);

return res.status(error.status || 500).json({
  success: false,
  message: error.status ? error.message : "Admin request failed."
});

}
};
