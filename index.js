const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const admin = require("firebase-admin");
const { Pool } = require("pg");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ---- ENV VARS ----
const {
  PORT = 8080,
  PG_CONNECTION_STRING,
  FIREBASE_SERVICE_ACCOUNT
} = process.env;

if (!PG_CONNECTION_STRING) {
  console.error("❌ Missing PG_CONNECTION_STRING");
  process.exit(1);
}

if (!FIREBASE_SERVICE_ACCOUNT) {
  console.error("❌ Missing FIREBASE_SERVICE_ACCOUNT");
  process.exit(1);
}

// ---- INIT FIREBASE ----
let serviceJson = JSON.parse(FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceJson)
});

// ---- INIT POSTGRES ----
const pool = new Pool({
  connectionString: PG_CONNECTION_STRING,
  max: 5
});

// ---- HELPERS ----
function getBearerToken(req) {
  const header = req.headers["authorization"];
  if (!header) return null;
  return header.replace("Bearer ", "");
}

// ---- ROUTES ----
app.get("/health", (_, res) => {
  res.json({ ok: true });
});

app.post("/profile_upsert", async (req, res) => {
  try {
    const token = getBearerToken(req);
    if (!token)
      return res.status(401).json({ error: "missing_token" });

    const decoded = await admin.auth().verifyIdToken(token);

    const uid = decoded.uid;
    const email = decoded.email || null;
    const displayName = req.body.display_name || decoded.name || null;
    const emailVerified = decoded.email_verified || false;
    const phoneNumber = decoded.phone_number || null;

    const lastSignIn = decoded.auth_time
      ? new Date(decoded.auth_time * 1000).toISOString()
      : null;

    const sql =
      "select * from upsert_user_from_claims($1,$2,$3,$4,$5,$6)";

    const params = [
      uid,
      email,
      displayName,
      emailVerified,
      phoneNumber,
      lastSignIn
    ];

    const result = await pool.query(sql, params);

    res.json({
      ok: true,
      user: result.rows[0]
    });
  } catch (error) {
    console.error("❌ ERROR in /profile_upsert", error);
    res.status(500).json({
      ok: false,
      error: error.toString()
    });
  }
});

// ---- START ----
app.listen(PORT, () =>
  console.log(`🚀 Backend running on port ${PORT}`)
);
