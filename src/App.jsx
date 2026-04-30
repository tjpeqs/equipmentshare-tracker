import { useState, useMemo, useRef, useEffect, useCallback } from "react";

// ── Supabase Auth helpers ─────────────────────────────────────
const SUPABASE_URL = "https://tcnknguceotzqmfhzxzo.supabase.co";
const SUPABASE_KEY = "sb_publishable_3hBluPXIJRhbY6s1ol3L3Q_JmZkJsiA";

async function supabaseRequest(path, options = {}) {
  const session = JSON.parse(localStorage.getItem("sb_session") || "null");
  const headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": `Bearer ${session?.access_token || SUPABASE_KEY}`,
    "Content-Type": "application/json",
    ...(options.headers || {})
  };
  return fetch(`${SUPABASE_URL}${path}`, { ...options, headers });
}

async function signInWithGoogle() {
  const redirectTo = encodeURIComponent(window.location.origin);
  window.location.href = `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${redirectTo}`;
}

async function signOut() {
  const session = JSON.parse(localStorage.getItem("sb_session") || "null");
  if (session?.access_token) {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: "POST",
      headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${session.access_token}` }
    });
  }
  localStorage.removeItem("sb_session");
  window.location.reload();
}

function getUserId() {
  const session = JSON.parse(localStorage.getItem("sb_session") || "null");
  if (!session?.access_token) return null;
  try {
    const payload = JSON.parse(atob(session.access_token.split('.')[1]));
    return payload.sub;
  } catch { return null; }
}

function getSession() {
  // Check URL hash for token (after Google redirect)
  const hash = window.location.hash;
  if (hash && hash.includes("access_token")) {
    const params = new URLSearchParams(hash.replace("#", ""));
    const session = {
      access_token:   params.get("access_token"),
      refresh_token:  params.get("refresh_token"),
      expires_in:     params.get("expires_in"),
      provider_token: params.get("provider_token"), // Google OAuth token for Calendar API
    };
    localStorage.setItem("sb_session", JSON.stringify(session));
    window.location.hash = "";
    return session;
  }
  return JSON.parse(localStorage.getItem("sb_session") || "null");
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  BID TRACKER  (Supabase-wired)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ── Supabase config (defined at top of file) ─────────────────────────────────

async function sbFetch(path, options = {}) {
  const session = JSON.parse(localStorage.getItem("sb_session") || "null");
  const token = session?.access_token || SUPABASE_KEY;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "Prefer": options.prefer || "return=representation",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase error: ${res.status} ${err}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// Convert DB snake_case → app camelCase
function fromDB(r) {
  return {
    id:         r.id,
    project:    r.project    || "",
    owner:      r.owner      || "",
    gc:         r.gc         || "TBD",
    awardedTo:  r.awarded_to || "",
    value:      r.value      || 0,
    type:       r.type       || "Commercial",
    county:     r.county     || "Litchfield",
    state:      r.state      || "CT",
    town:       r.town       || "",
    bidDate:    r.bid_date   || "",
    awardDate:  r.award_date || "",
    status:     r.status     || "Not Contacted",
    priority:   r.priority   || "Medium",
    notes:      r.notes      || "",
    source:     r.source     || "Dodge",
  };
}

// Convert app camelCase → DB snake_case
function toDB(b) {
  return {
    user_id:    getUserId(),
    project:    b.project,
    owner:      b.owner,
    gc:         b.gc,
    awarded_to: b.awardedTo,
    value:      Number(b.value) || 0,
    type:       b.type,
    county:     b.county,
    state:      b.state || "CT",
    town:       b.town,
    bid_date:   b.bidDate   || null,
    award_date: b.awardDate || null,
    status:     b.status,
    priority:   b.priority,
    notes:      b.notes,
    source:     b.source,
  };
}

const SEED_DATA = [{"project":"Waterbury Mixed-Use Development","owner":"Anchor Development Group","gc":"O&G Industries","awarded_to":"","value":4200000,"type":"Commercial","county":"New Haven","state":"CT","town":"Waterbury","bid_date":"2026-04-02","award_date":null,"status":"Not Contacted","priority":"High","notes":"Large earthwork scope \u2014 confirm excavation contractor","source":"eSEARCH"},{"project":"Danbury Corporate Campus Phase 2","owner":"Ridgeline Properties LLC","gc":"Dimeo Construction","awarded_to":"","value":7500000,"type":"Commercial","county":"Fairfield","state":"CT","town":"Danbury","bid_date":"2026-04-15","award_date":null,"status":"In Progress","priority":"High","notes":"Competing with United Rentals. T3 fleet visibility is our edge.","source":"LinkedIn"},{"project":"Brookside Avenue Bridge Rehabilitation","owner":"","gc":"TBD","awarded_to":"","value":573000,"type":"Municipal","county":"Litchfield","state":"CT","town":"New Milford","bid_date":"2026-03-19","award_date":null,"status":"Awarded \u2014 Contact Now","priority":"Low","notes":"Stage: Bid Results | Types: Bridge","source":"Dodge"},{"project":"Chip Seal Surface Treatment","owner":"","gc":"TBD","awarded_to":"","value":1999999,"type":"Municipal","county":"Litchfield","state":"CT","town":"Morris","bid_date":"2026-04-16","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Types: Paving","source":"Dodge"},{"project":"Torrington Middle-High School New Auxiliary Building","owner":"","gc":"TBD","awarded_to":"","value":1999999,"type":"Commercial","county":"Litchfield","state":"CT","town":"Torrington","bid_date":"2026-04-08","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: GC Bidding | Types: Middle/Senior High School","source":"Dodge"},{"project":"NMPS NMHS Culinary Renovation","owner":"","gc":"TBD","awarded_to":"","value":3999999,"type":"Commercial","county":"Litchfield","state":"CT","town":"New Milford","bid_date":"2025-12-12","award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Types: Middle/Senior High School","source":"Dodge"},{"project":"Sharon Housing Trust - Residential Construction","owner":"","gc":"TBD","awarded_to":"","value":150000,"type":"Residential","county":"Litchfield","state":"CT","town":"Sharon","bid_date":"2026-03-05","award_date":null,"status":"Awarded \u2014 Contact Now","priority":"Low","notes":"Stage: Bid Results | Types: Sale/Spec Homes","source":"Dodge"},{"project":"New Milford (CT) Walmart 3546-1005 CAPXHVAC - 1","owner":"","gc":"TBD","awarded_to":"","value":249999,"type":"Commercial","county":"Litchfield","state":"CT","town":"New Milford","bid_date":"2026-03-11","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Construction Documents | Types: Retail (Other)","source":"Dodge"},{"project":"Camp Shower Building- North","owner":"","gc":"TBD","awarded_to":"","value":1227000,"type":"Commercial","county":"Litchfield","state":"CT","town":"Barkhamsted","bid_date":"2026-03-11","award_date":null,"status":"Awarded \u2014 Contact Now","priority":"Low","notes":"Stage: Bid Results | Types: Miscellaneous Recreational","source":"Dodge"},{"project":"RFP/DB: Fall Arrest Systems Installation","owner":"","gc":"TBD","awarded_to":"","value":624999,"type":"Commercial","county":"Litchfield","state":"CT","town":"Watertown","bid_date":"2026-03-06","award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Pre-Design | Types: Passenger Terminal (Other)","source":"Dodge"},{"project":"Faith Church Sanctuary and Classroom Expansion","owner":"","gc":"TBD","awarded_to":"","value":1000000,"type":"Commercial","county":"Litchfield","state":"CT","town":"New Milford","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Types: Primary School Middle/Senior High School Worship Facility","source":"Dodge"},{"project":"RFPQ/AE: Zeller Assessment Project","owner":"","gc":"TBD","awarded_to":"","value":1999999,"type":"Commercial","county":"Litchfield","state":"CT","town":"Torrington","bid_date":"2026-04-08","award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Request for Proposals | Types: Hazardous Waste Disposal Site Development","source":"Dodge"},{"project":"Torrington (CT) Walmart 2144-276 RM","owner":"","gc":"TBD","awarded_to":"","value":900000,"type":"Commercial","county":"Litchfield","state":"CT","town":"Torrington","bid_date":"2026-04-14","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: GC Bidding-Invitation | Types: Retail (Other)","source":"Dodge"},{"project":"Local Flood Protection Routine Maintenance","owner":"","gc":"TBD","awarded_to":"","value":1999999,"type":"Municipal","county":"Litchfield","state":"CT","town":"Torrington","bid_date":"2026-03-17","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Types: Flood Control","source":"Dodge"},{"project":"Plan of Conservation and Development Consultant","owner":"","gc":"TBD","awarded_to":"","value":120000,"type":"Commercial","county":"Litchfield","state":"CT","town":"Torrington","bid_date":"2026-04-09","award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Request for Proposals | Types: Office","source":"Dodge"},{"project":"East Street Housing Site Infrastructure","owner":"","gc":"TBD","awarded_to":"","value":3999999,"type":"Residential","county":"Litchfield","state":"CT","town":"Morris","bid_date":"2026-03-25","award_date":null,"status":"Not Contacted","priority":"High","notes":"Stage: GC Bidding | Types: Apartments/Condominiums 1-3 Stories","source":"Dodge"},{"project":"Vineyard Sky Solar Farm","owner":"","gc":"TBD","awarded_to":"","value":3999999,"type":"Commercial","county":"Litchfield","state":"CT","town":"Winsted","bid_date":null,"award_date":null,"status":"Lost","priority":"Low","notes":"Stage: Delayed | Types: Power Plant (Other)","source":"Dodge"},{"project":"Laurel City Performing Arts Center (Conversion from church)","owner":"","gc":"TBD","awarded_to":"","value":3999999,"type":"Commercial","county":"Litchfield","state":"CT","town":"Winsted","bid_date":null,"award_date":null,"status":"Lost","priority":"Low","notes":"Stage: Delayed | Types: Theater/Auditorium Miscellaneous Recreational","source":"Dodge"},{"project":"Radiant Meadows Solar Array 4.625 MW - Woodbury CT","owner":"","gc":"TBD","awarded_to":"","value":8367254,"type":"Commercial","county":"New Haven","state":"CT","town":"Woodbury","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Construction | Types: Power Plant (Other)","source":"Dodge"},{"project":"Affordable Housing (Batcheller School Redevelopment)","owner":"","gc":"TBD","awarded_to":"","value":18000000,"type":"Residential","county":"Litchfield","state":"CT","town":"Winchester","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"High","notes":"Stage: Design Development | Types: Apartments/Condominiums 4+ Stories","source":"Dodge"},{"project":"CT/DOT: Shepaug River Bridge Replacement","owner":"","gc":"TBD","awarded_to":"","value":12499999,"type":"Municipal","county":"Litchfield","state":"CT","town":"Roxbury","bid_date":"2025-07-17","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Planning Schematics | Types: Bridge","source":"Dodge"},{"project":"JPCC Sidewalk Access Phase II REBID","owner":"","gc":"TBD","awarded_to":"","value":1999999,"type":"Municipal","county":"Litchfield","state":"CT","town":"New Milford","bid_date":"2026-03-26","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Types: Paving Sidewalk/Parking Lot","source":"Dodge"},{"project":"Roxbury Town - Existing Fire House Addition REBID","owner":"","gc":"TBD","awarded_to":"","value":1999999,"type":"Commercial","county":"Litchfield","state":"CT","town":"Roxbury","bid_date":"2024-07-19","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: GC Bidding | Types: Fire/Police Station","source":"Dodge"},{"project":"Wigwam Road Reconstruction Phase 1","owner":"","gc":"TBD","awarded_to":"","value":1999999,"type":"Municipal","county":"Litchfield","state":"CT","town":"Litchfield","bid_date":"2026-03-11","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Types: Paving Storm Sewer","source":"Dodge"},{"project":"Town Gazebo Roof Replacement","owner":"","gc":"TBD","awarded_to":"","value":349999,"type":"Commercial","county":"Litchfield","state":"CT","town":"Bethlehem","bid_date":"2026-03-16","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Types: Office","source":"Dodge"},{"project":"John Trumbull Primary School - HVAC","owner":"","gc":"TBD","awarded_to":"","value":1398845,"type":"Commercial","county":"Litchfield","state":"CT","town":"Watertown","bid_date":"2025-07-01","award_date":null,"status":"Awarded \u2014 Contact Now","priority":"Low","notes":"Stage: Bid Results | Types: Primary School","source":"Dodge"},{"project":"Activate Main Street BAR Planning Study","owner":"","gc":"TBD","awarded_to":"","value":1999999,"type":"Municipal","county":"Litchfield","state":"CT","town":"Torrington","bid_date":"2026-04-02","award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Request for Qualifications | Types: Paving Sidewalk/Parking Lot Site Development","source":"Dodge"},{"project":"Self Storage and Warehouse Buildings","owner":"","gc":"TBD","awarded_to":"","value":12499999,"type":"Commercial","county":"Litchfield","state":"CT","town":"New Milford","bid_date":null,"award_date":null,"status":"Lost","priority":"Medium","notes":"Stage: Abandoned | Types: Warehouse","source":"Dodge"},{"project":"Manufacturing Facility (Conversion from warehouse)","owner":"","gc":"TBD","awarded_to":"","value":300000,"type":"Commercial","county":"Litchfield","state":"CT","town":"New Milford","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Types: Manufacturing Building","source":"Dodge"},{"project":"Moose Creek Lodge & Cabins - Pool","owner":"","gc":"TBD","awarded_to":"","value":12499999,"type":"Residential","county":"Litchfield","state":"CT","town":"Litchfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Planning Schematics | Types: Sale/Spec Homes Food/Beverage Service Swimming Pool Miscellaneous Recreational Hotel/Motel Park/Playground","source":"Dodge"},{"project":"Gas Station & Convenience Store & Restaurant","owner":"","gc":"TBD","awarded_to":"","value":1200000,"type":"Commercial","county":"Litchfield","state":"CT","town":"New Milford","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Types: Food/Beverage Service Supermarket/Convenience Store Retail (Other) Vehicle Sales/Service","source":"Dodge"},{"project":"7 Brew Drive-Thru Coffee Shop (Conversion from bank)","owner":"","gc":"TBD","awarded_to":"","value":250000,"type":"Commercial","county":"Litchfield","state":"CT","town":"New Milford","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Types: Food/Beverage Service","source":"Dodge"},{"project":"Steele Brook Greenway Improvements","owner":"","gc":"TBD","awarded_to":"","value":1953816,"type":"Municipal","county":"Litchfield","state":"CT","town":"Watertown","bid_date":"2025-12-23","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Start | Types: Paving Bridge Sidewalk/Parking Lot Storm Sewer","source":"Dodge"},{"project":"High Profile Cannabis Shop Fit-Out","owner":"","gc":"TBD","awarded_to":"","value":624999,"type":"Commercial","county":"Litchfield","state":"CT","town":"Thomaston","bid_date":null,"award_date":null,"status":"Lost","priority":"Low","notes":"Stage: Notice of Completion | Types: Retail (Other)","source":"Dodge"},{"project":"Wake Robin Inn Redevelopment","owner":"","gc":"TBD","awarded_to":"","value":7499999,"type":"Commercial","county":"Litchfield","state":"CT","town":"Salisbury","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"High","notes":"Stage: Construction Documents | Types: Miscellaneous Recreational Hotel/Motel","source":"Dodge"},{"project":"Colebrook River Lake - Roof Replacement","owner":"","gc":"TBD","awarded_to":"","value":42050,"type":"Commercial","county":"Litchfield","state":"CT","town":"Colebrook","bid_date":"2025-10-31","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Start | Types: Capitol/ Courthouse/City Hall Military Facility","source":"Dodge"},{"project":"CT/DOT: CT 263 Bridge Replacements","owner":"","gc":"TBD","awarded_to":"","value":3749999,"type":"Municipal","county":"Litchfield","state":"CT","town":"Winchestr Ctr","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Types: Bridge","source":"Dodge"},{"project":"RFP/AE: Northville Elementary School Roof Replacement","owner":"","gc":"TBD","awarded_to":"","value":1999999,"type":"Commercial","county":"Litchfield","state":"CT","town":"New Milford","bid_date":"2026-03-12","award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Request for Proposals | Types: Primary School","source":"Dodge"},{"project":"RFP/AE: Green Manor Improvements","owner":"","gc":"TBD","awarded_to":"","value":3999999,"type":"Residential","county":"Litchfield","state":"CT","town":"Thomaston","bid_date":"2024-09-24","award_date":null,"status":"Lost","priority":"Low","notes":"Stage: Delayed | Types: Apartments/Condominiums 1-3 Stories Apartments/Condominiums 4+ Stories","source":"Dodge"},{"project":"CT/DOT: Catenary Improvements","owner":"","gc":"TBD","awarded_to":"","value":3700000,"type":"Commercial","county":"Litchfield","state":"CT","town":"Goshen","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Types: Passenger Terminal (Other)","source":"Dodge"},{"project":"Lime Rock Park Pavilion","owner":"","gc":"TBD","awarded_to":"","value":249999,"type":"Commercial","county":"Litchfield","state":"CT","town":"Salisbury","bid_date":null,"award_date":null,"status":"Lost","priority":"Low","notes":"Stage: Notice of Completion | Types: Miscellaneous Recreational","source":"Dodge"},{"project":"Commercial Building","owner":"","gc":"TBD","awarded_to":"","value":449999,"type":"Commercial","county":"Litchfield","state":"CT","town":"New Milford","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Types: Office Retail (Other) Warehouse","source":"Dodge"},{"project":"River Road Homes","owner":"","gc":"TBD","awarded_to":"","value":3999999,"type":"Residential","county":"Litchfield","state":"CT","town":"Canaan","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Types: Apartments/Condominiums 1-3 Stories","source":"Dodge"},{"project":"Warner Theatre Interior Renovations","owner":"","gc":"TBD","awarded_to":"","value":1999999,"type":"Commercial","county":"Litchfield","state":"CT","town":"Torrington","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Types: Theater/Auditorium","source":"Dodge"},{"project":"2026 Town Wide Pipe Lining","owner":"","gc":"TBD","awarded_to":"","value":332140,"type":"Municipal","county":"Litchfield","state":"CT","town":"Watertown","bid_date":"2026-01-13","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Start | Types: Water Line","source":"Dodge"},{"project":"Wellers Bridge Road Over Shepaug River Replacement","owner":"","gc":"TBD","awarded_to":"","value":1999999,"type":"Municipal","county":"Litchfield","state":"CT","town":"Roxbury","bid_date":"2026-02-18","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Types: Bridge","source":"Dodge"},{"project":"Senior Center Floor Renovation","owner":"","gc":"TBD","awarded_to":"","value":47760,"type":"Commercial","county":"Litchfield","state":"CT","town":"New Milford","bid_date":"2026-01-08","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Start | Types: Social Club Miscellaneous Recreational","source":"Dodge"},{"project":"64 Albany Street Torrington","owner":"","gc":"TBD","awarded_to":"","value":34700,"type":"Residential","county":"Litchfield","state":"CT","town":"Torrington","bid_date":"2026-01-06","award_date":null,"status":"Awarded \u2014 Contact Now","priority":"Low","notes":"Stage: Bid Results | Types: Custom Homes","source":"Dodge"},{"project":"Dresser Woods Affordable Housing Development","owner":"","gc":"TBD","awarded_to":"","value":7499999,"type":"Residential","county":"Litchfield","state":"CT","town":"Salisbury","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Planning Schematics | Types: Sale/Spec Homes Apartments/Condominiums 1-3 Stories","source":"Dodge"},{"project":"CT Northwestern CC Greenwoods Hall Alteration & Renovation","owner":"","gc":"TBD","awarded_to":"","value":2685817,"type":"Commercial","county":"Litchfield","state":"CT","town":"Winchester","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Types: College/University","source":"Dodge"},{"project":"RFP/AE: Northville Elementary School Fire Hydrants","owner":"","gc":"TBD","awarded_to":"","value":1999999,"type":"Commercial","county":"Litchfield","state":"CT","town":"New Milford","bid_date":"2026-04-27","award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Request for Proposals | Types: Primary School","source":"Dodge"},{"project":"New Hartford - PMA Sanitary Sewer & Pump Station Improvement","owner":"","gc":"TBD","awarded_to":"","value":5715000,"type":"Commercial","county":"Litchfield","state":"CT","town":"New Hartford","bid_date":"2025-10-01","award_date":null,"status":"Awarded \u2014 Contact Now","priority":"Medium","notes":"Stage: Bid Results | Types: Sewage Treatment Plant","source":"Dodge"},{"project":"Mountain Road Bridge No. 06926 Replacement","owner":"","gc":"TBD","awarded_to":"","value":1749999,"type":"Municipal","county":"Litchfield","state":"CT","town":"Norfolk","bid_date":"2025-10-30","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Start | Types: Bridge","source":"Dodge"},{"project":"Grounds Maintenance Services IQC","owner":"","gc":"TBD","awarded_to":"","value":110073,"type":"Municipal","county":"Litchfield","state":"CT","town":"Colebrook","bid_date":"2025-12-19","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Start | Types: Unclassified","source":"Dodge"},{"project":"CT/DOT: Bridge Rehabilitation","owner":"","gc":"TBD","awarded_to":"","value":1749999,"type":"Municipal","county":"Litchfield","state":"CT","town":"Watertown","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Types: Bridge Site Development","source":"Dodge"},{"project":"Slaiby Village Affordable Housing Development","owner":"","gc":"TBD","awarded_to":"","value":20000000,"type":"Residential","county":"Litchfield","state":"CT","town":"Torrington","bid_date":null,"award_date":null,"status":"Lost","priority":"Medium","notes":"Stage: Delayed | Types: Apartments/Condominiums 1-3 Stories Apartments/Condominiums 4+ Stories","source":"Dodge"},{"project":"Kent Memorial Library Expansion & Renovation REBID","owner":"","gc":"TBD","awarded_to":"","value":5775100,"type":"Commercial","county":"Litchfield","state":"CT","town":"Kent","bid_date":"2025-12-09","award_date":null,"status":"Not Contacted","priority":"High","notes":"Stage: Start | Types: Library","source":"Dodge"},{"project":"CT/DOT: Network Infrastructure Upgrade Phase 4","owner":"","gc":"TBD","awarded_to":"","value":34300000,"type":"Commercial","county":"Litchfield","state":"CT","town":"Watertown","bid_date":"2023-12-04","award_date":null,"status":"Not Contacted","priority":"High","notes":"Stage: Construction Documents | Types: Communication Lines Railroad","source":"Dodge"},{"project":"Kent Center School Pavement Replacement","owner":"","gc":"TBD","awarded_to":"","value":1999999,"type":"Municipal","county":"Litchfield","state":"CT","town":"Kent","bid_date":"2026-02-03","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Types: Paving","source":"Dodge"},{"project":"Northeast Building & Home Retail Store","owner":"","gc":"TBD","awarded_to":"","value":1999999,"type":"Commercial","county":"Litchfield","state":"CT","town":"Cornwall","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Start | Types: Office Retail (Other) Warehouse","source":"Dodge"},{"project":"Community Field Lakeville Reconstruction","owner":"","gc":"TBD","awarded_to":"","value":1999999,"type":"Municipal","county":"Litchfield","state":"CT","town":"Salisbury","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Pre-Design | Types: Park/Playground","source":"Dodge"},{"project":"New Housing Units at Holley Place","owner":"","gc":"TBD","awarded_to":"","value":3999999,"type":"Residential","county":"Litchfield","state":"CT","town":"Salisbury","bid_date":"2024-01-17","award_date":null,"status":"Not Contacted","priority":"High","notes":"Stage: Construction Documents | Types: Apartments/Condominiums 1-3 Stories Parking Garage","source":"Dodge"},{"project":"Lakeville Train Station Relocation","owner":"","gc":"TBD","awarded_to":"","value":731480,"type":"Commercial","county":"Litchfield","state":"CT","town":"Salisbury","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Types: Passenger Terminal (Other)","source":"Dodge"},{"project":"Sharon Road Connectivity & Safety Improvement","owner":"","gc":"TBD","awarded_to":"","value":800000,"type":"Municipal","county":"Litchfield","state":"CT","town":"Salisbury","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Types: Paving Sidewalk/Parking Lot","source":"Dodge"},{"project":"RFQ/AE: Naugatuck River Greenway Bogue Rd To Thomaston Rd","owner":"","gc":"TBD","awarded_to":"","value":220000,"type":"Municipal","county":"Litchfield","state":"CT","town":"Watertown","bid_date":"2026-02-27","award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Request for Qualifications | Types: Paving Sidewalk/Parking Lot Park/Playground","source":"Dodge"},{"project":"Sullivan Farm Agro-Education Campus Barn","owner":"","gc":"TBD","awarded_to":"","value":645000,"type":"Commercial","county":"Litchfield","state":"CT","town":"New Milford","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Types: Office Food/Beverage Service Retail (Other) Miscellaneous Education Building Testing/Research/Development Lab Animal/Plant/Fish Facility","source":"Dodge"},{"project":"Crunch Fitness Fit-Out (Torrington CT)","owner":"","gc":"TBD","awarded_to":"","value":1999999,"type":"Commercial","county":"Litchfield","state":"CT","town":"Torrington","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Construction Documents | Types: Athletic Facility","source":"Dodge"},{"project":"Battery Storage Facility","owner":"","gc":"TBD","awarded_to":"","value":50000000,"type":"Commercial","county":"Litchfield","state":"CT","town":"Torrington","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Planning Schematics | Types: Power Plant (Other)","source":"Dodge"},{"project":"Dymax Industrial Building Addition","owner":"","gc":"TBD","awarded_to":"","value":7499999,"type":"Commercial","county":"Litchfield","state":"CT","town":"Torrington","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Planning Schematics | Types: Warehouse Manufacturing Building","source":"Dodge"},{"project":"CT/DOT: Bituminous Concrete Materials","owner":"","gc":"TBD","awarded_to":"","value":0,"type":"Municipal","county":"Hartford","state":"CT","town":"Hartford","bid_date":"2026-02-04","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Types: Unclassified","source":"Dodge"},{"project":"RSD7 Facility Conditions Assessment","owner":"","gc":"TBD","awarded_to":"","value":0,"type":"Commercial","county":"Litchfield","state":"CT","town":"Winsted","bid_date":"2026-01-28","award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Request for Proposals | Types: Miscellaneous Education Building","source":"Dodge"},{"project":"New Raquet Sports Facility","owner":"","gc":"TBD","awarded_to":"","value":1999999,"type":"Commercial","county":"Litchfield","state":"CT","town":"Washington","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Types: Athletic Facility Miscellaneous Recreational","source":"Dodge"},{"project":"Alltown Fresh Retail Center and Gas Station","owner":"","gc":"TBD","awarded_to":"","value":6250258,"type":"Commercial","county":"Litchfield","state":"CT","town":"New Milford","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Construction | Types: Supermarket/Convenience Store Vehicle Sales/Service","source":"Dodge"},{"project":"Berkshire Estate Age-Restricted Housing","owner":"","gc":"TBD","awarded_to":"","value":1999999,"type":"Residential","county":"Litchfield","state":"CT","town":"Watertown","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Types: Apartments/Condominiums 1-3 Stories","source":"Dodge"},{"project":"Mallory View Affordable Apartments","owner":"","gc":"TBD","awarded_to":"","value":1999999,"type":"Residential","county":"Litchfield","state":"CT","town":"Barkhamsted","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Construction Documents | Types: Apartments/Condominiums 1-3 Stories","source":"Dodge"},{"project":"Ware River Secondary Track & ROW Rehabilitation","owner":"","gc":"TBD","awarded_to":"","value":3300000,"type":"Municipal","county":"Hampden","state":"MA","town":"Palmer","bid_date":"2026-04-17","award_date":null,"status":"Not Contacted","priority":"High","notes":"Stage: Bidding | Railroad Site Development","source":"Dodge"},{"project":"MA/DOT: I-291 Traffic Sign Replacement","owner":"","gc":"TBD","awarded_to":"","value":1883334,"type":"Municipal","county":"Hampden","state":"MA","town":"Springfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"High","notes":"Stage: Design Development | Highway Signs/Guardrails","source":"Dodge"},{"project":"Fiber Optic Underground Conduit Installation Services","owner":"","gc":"TBD","awarded_to":"","value":7499999,"type":"Industrial","county":"Hampden","state":"MA","town":"Chicopee","bid_date":"2026-04-02","award_date":null,"status":"Not Contacted","priority":"High","notes":"Stage: Bidding | Power Lines","source":"Dodge"},{"project":"Gulfstream-Westfield Training Room Building","owner":"","gc":"TBD","awarded_to":"","value":116500,"type":"Industrial","county":"Hampden","state":"MA","town":"Westfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Start | Manufacturing Building","source":"Dodge"},{"project":"Berkshire Natural Resources Property Exploration Wells","owner":"","gc":"TBD","awarded_to":"","value":582899,"type":"Commercial","county":"Berkshire","state":"MA","town":"Great Barrington","bid_date":"2026-01-28","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Start | Site Development Shoreline Maintenance","source":"Dodge"},{"project":"MA/DOT: Route 7 Intersection Improvements","owner":"","gc":"TBD","awarded_to":"","value":7082597,"type":"Municipal","county":"Berkshire","state":"MA","town":"Great Barrington","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Paving","source":"Dodge"},{"project":"Paving & Catch Basin Repair","owner":"","gc":"TBD","awarded_to":"","value":54076,"type":"Municipal","county":"Hampden","state":"MA","town":"Blandford","bid_date":"2026-03-25","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Paving Storm Sewer","source":"Dodge"},{"project":"Greenleaf Park Soccer Field Lighting Improvements","owner":"","gc":"TBD","awarded_to":"","value":70000,"type":"Commercial","county":"Hampden","state":"MA","town":"Springfield","bid_date":"2026-04-08","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Athletic Lighting","source":"Dodge"},{"project":"Cobble Mountain Hydrostation Penstock Lining","owner":"","gc":"TBD","awarded_to":"","value":11100000,"type":"Commercial","county":"Hampden","state":"MA","town":"Westfield","bid_date":"2026-05-06","award_date":null,"status":"Not Contacted","priority":"High","notes":"Stage: GC Bidding | Hydroelectric Plant","source":"Dodge"},{"project":"Paving IQC","owner":"","gc":"TBD","awarded_to":"","value":297818,"type":"Municipal","county":"Berkshire","state":"MA","town":"Pittsfield","bid_date":"2026-04-02","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Paving","source":"Dodge"},{"project":"Fy27-04 Culverts Products","owner":"","gc":"TBD","awarded_to":"","value":61440,"type":"Commercial","county":"Berkshire","state":"MA","town":"Pittsfield","bid_date":"2026-04-02","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Unclassified","source":"Dodge"},{"project":"Main Street Corridor Safety Improvements","owner":"","gc":"TBD","awarded_to":"","value":2000000,"type":"Municipal","county":"Hampden","state":"MA","town":"West Springfield","bid_date":"2026-04-03","award_date":null,"status":"Not Contacted","priority":"High","notes":"Stage: Bidding | Paving Sidewalk/Parking Lot Storm Sewer Sanitary Sewer","source":"Dodge"},{"project":"Mountain Road Culvert Improvements","owner":"","gc":"TBD","awarded_to":"","value":4700000,"type":"Municipal","county":"Berkshire","state":"MA","town":"Pittsfield","bid_date":"2026-04-30","award_date":null,"status":"Not Contacted","priority":"High","notes":"Stage: Bidding | Paving Site Development Storm Sewer","source":"Dodge"},{"project":"Yvonne Drive Headwall Replacement","owner":"","gc":"TBD","awarded_to":"","value":275575,"type":"Municipal","county":"Berkshire","state":"MA","town":"Dalton","bid_date":"2026-04-09","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Storm Sewer Sanitary Sewer","source":"Dodge"},{"project":"FSB Pittsfield State Office Building HVAC Upgrades","owner":"","gc":"TBD","awarded_to":"","value":1272587,"type":"Industrial","county":"Berkshire","state":"MA","town":"Pittsfield","bid_date":"2026-04-02","award_date":null,"status":"Not Contacted","priority":"High","notes":"Stage: GC Bidding | Office","source":"Dodge"},{"project":"FSB Hiram L. Dorman Elementary School AC Upgrades","owner":"","gc":"TBD","awarded_to":"","value":520000,"type":"Commercial","county":"Hampden","state":"MA","town":"Springfield","bid_date":"2026-04-22","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Primary School","source":"Dodge"},{"project":"Aerie #2745 Holyoke Mall at Ingleside","owner":"","gc":"TBD","awarded_to":"","value":250000,"type":"Commercial","county":"Hampden","state":"MA","town":"Holyoke","bid_date":"2026-03-19","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: GC Bidding-Invitation | Regional Shopping Mall","source":"Dodge"},{"project":"Cobble Mountain Hydrostation Crane Replacement","owner":"","gc":"TBD","awarded_to":"","value":149999,"type":"Commercial","county":"Hampden","state":"MA","town":"Westfield","bid_date":"2026-05-07","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Hydroelectric Plant","source":"Dodge"},{"project":"RFQ/GC: Cobble Mountain Unit 3 Turbine Generator Rehab","owner":"","gc":"TBD","awarded_to":"","value":300000,"type":"Commercial","county":"Hampden","state":"MA","town":"Westfield","bid_date":"2026-04-15","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding Request for Qualifications | Hydroelectric Plant","source":"Dodge"},{"project":"MA/DOT: Chicopee - Hugh Scott Streiber ES Improvements","owner":"","gc":"TBD","awarded_to":"","value":2650000,"type":"Municipal","county":"Hampden","state":"MA","town":"Chicopee","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Paving Sidewalk/Parking Lot","source":"Dodge"},{"project":"Town Hall Renovation","owner":"","gc":"TBD","awarded_to":"","value":1999999,"type":"Commercial","county":"Berkshire","state":"MA","town":"Mill River","bid_date":"2026-04-17","award_date":null,"status":"Not Contacted","priority":"High","notes":"Stage: GC Bidding | Capitol/ Courthouse/City Hall","source":"Dodge"},{"project":"FSB Westfield New Police Station","owner":"","gc":"TBD","awarded_to":"","value":34500000,"type":"Commercial","county":"Hampden","state":"MA","town":"Westfield","bid_date":"2026-03-10","award_date":null,"status":"Awarded \u2014 Contact Now","priority":"Medium","notes":"Stage: Bid Results | Fire/Police Station","source":"Dodge"},{"project":"Repair Airfield Pavement Crack Seal","owner":"","gc":"TBD","awarded_to":"","value":350000,"type":"Municipal","county":"Hampden","state":"MA","town":"Chicopee","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Paving Runway/Taxiway","source":"Dodge"},{"project":"Fy27-09 Chip Seal","owner":"","gc":"TBD","awarded_to":"","value":874999,"type":"Municipal","county":"Berkshire","state":"MA","town":"Pittsfield","bid_date":"2026-04-02","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Paving","source":"Dodge"},{"project":"Wastewater Treatment Facility & Avery Lane PS Upgrades","owner":"","gc":"TBD","awarded_to":"","value":33871800,"type":"Commercial","county":"Berkshire","state":"MA","town":"Great Barrington","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Pre-Design | Sewage Treatment Plant","source":"Dodge"},{"project":"MA/DOT: County Rd Superstructure Replacement","owner":"","gc":"TBD","awarded_to":"","value":1692715,"type":"Municipal","county":"Berkshire","state":"MA","town":"Sheffield","bid_date":"2026-03-17","award_date":null,"status":"Awarded \u2014 Contact Now","priority":"Low","notes":"Stage: Bid Results | Bridge","source":"Dodge"},{"project":"FSB Vacancy Renovations Phase 1","owner":"","gc":"TBD","awarded_to":"","value":632128,"type":"Residential","county":"Hampden","state":"MA","town":"Chicopee","bid_date":"2026-03-20","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: GC Bidding | Apartments/Condominiums 1-3 Stories Apartments/Condominiums 4+ Stories","source":"Dodge"},{"project":"Westover Air Reserve Barrel Roof Hangar 3 Repair REBID","owner":"","gc":"TBD","awarded_to":"","value":3000000,"type":"Industrial","county":"Hampden","state":"MA","town":"Chicopee","bid_date":"2026-04-28","award_date":null,"status":"Not Contacted","priority":"High","notes":"Stage: Bidding | Airline Terminal Military Facility","source":"Dodge"},{"project":"Housing, Arts & Community Space (Sullivan Sch Redevelopment)","owner":"","gc":"TBD","awarded_to":"","value":14500000,"type":"Residential","county":"Berkshire","state":"MA","town":"North Adams","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Planning Schematics | Sale/Spec Homes Apartments/Condominiums 1-3 Stories Food/Beverage Service Miscellaneous Recreational","source":"Dodge"},{"project":"MA/DOT: SR 116 Bridge Replacements","owner":"","gc":"TBD","awarded_to":"","value":14588000,"type":"Municipal","county":"Berkshire","state":"MA","town":"Savoy","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Planning Schematics | Bridge","source":"Dodge"},{"project":"MA/DOT: Dalton Ave Rail Trail Improvements","owner":"","gc":"TBD","awarded_to":"","value":11631613,"type":"Municipal","county":"Berkshire","state":"MA","town":"Pittsfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Planning Schematics | Sidewalk/Parking Lot Park/Playground","source":"Dodge"},{"project":"Springfield Central High School Lighting Upgrades","owner":"","gc":"TBD","awarded_to":"","value":300000,"type":"Commercial","county":"Hampden","state":"MA","town":"Springfield","bid_date":"2026-04-08","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Middle/Senior High School","source":"Dodge"},{"project":"MA/DOT: US-20 W Bridge Preservation","owner":"","gc":"TBD","awarded_to":"","value":3625000,"type":"Municipal","county":"Hampden","state":"MA","town":"Chester","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Bridge","source":"Dodge"},{"project":"Driveway Extension","owner":"","gc":"TBD","awarded_to":"","value":25000,"type":"Municipal","county":"Hampden","state":"MA","town":"Hampden","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Construction Documents | Paving Sidewalk/Parking Lot Site Development","source":"Dodge"},{"project":"MA/DOT: Armory St Bridge Replacement","owner":"","gc":"TBD","awarded_to":"","value":51303970,"type":"Municipal","county":"Hampden","state":"MA","town":"Springfield","bid_date":"2026-03-31","award_date":null,"status":"Not Contacted","priority":"High","notes":"Stage: Bidding | Bridge","source":"Dodge"},{"project":"Greenhouses & Processing Building","owner":"","gc":"TBD","awarded_to":"","value":1999999,"type":"Industrial","county":"Hampden","state":"MA","town":"Southwick","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Warehouse Animal/Plant/Fish Facility","source":"Dodge"},{"project":"Trash Compactor Replacement REBID","owner":"","gc":"TBD","awarded_to":"","value":349999,"type":"Commercial","county":"Hampden","state":"MA","town":"Southwick","bid_date":"2026-03-17","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Dry Waste Treatment Plant","source":"Dodge"},{"project":"East Longmeadow Public Library Flooring","owner":"","gc":"TBD","awarded_to":"","value":25342,"type":"Commercial","county":"Hampden","state":"MA","town":"East Longmeadow","bid_date":"2026-02-05","award_date":null,"status":"Awarded \u2014 Contact Now","priority":"Low","notes":"Stage: Bid Results | Library","source":"Dodge"},{"project":"MA/DOT: Bridge Replacement","owner":"","gc":"TBD","awarded_to":"","value":3409095,"type":"Municipal","county":"Hampden","state":"MA","town":"Monson","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Bridge","source":"Dodge"},{"project":"FY27-06 Guard Rail Products Installed IQC","owner":"","gc":"TBD","awarded_to":"","value":40114,"type":"Municipal","county":"Berkshire","state":"MA","town":"Pittsfield","bid_date":"2026-04-02","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Highway Signs/Guardrails","source":"Dodge"},{"project":"Medical Office Building","owner":"","gc":"TBD","awarded_to":"","value":2500000,"type":"Commercial","county":"Hampden","state":"MA","town":"Springfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Clinic/Medical Office","source":"Dodge"},{"project":"FSB Commerce High School Roof Replacement","owner":"","gc":"TBD","awarded_to":"","value":13035000,"type":"Commercial","county":"Hampden","state":"MA","town":"Springfield","bid_date":"2026-03-23","award_date":null,"status":"Not Contacted","priority":"High","notes":"Stage: Bidding | Middle/Senior High School","source":"Dodge"},{"project":"Brodie Mountain Ski Resort Redevelopment","owner":"","gc":"TBD","awarded_to":"","value":37499999,"type":"Residential","county":"Berkshire","state":"MA","town":"New Ashford","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Pre-Design | Apartments/Condominiums 1-3 Stories Food/Beverage Service Retail (Other) Miscellaneous Recreational Hotel/Motel","source":"Dodge"},{"project":"HVAC Removal and Replace","owner":"","gc":"TBD","awarded_to":"","value":624999,"type":"Commercial","county":"Hampden","state":"MA","town":"Monson","bid_date":"2026-04-01","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Museum","source":"Dodge"},{"project":"Westford Ave and Gunn Square South Water Main Replacement","owner":"","gc":"TBD","awarded_to":"","value":1313450,"type":"Municipal","county":"Hampden","state":"MA","town":"Agawam","bid_date":"2026-03-12","award_date":null,"status":"Awarded \u2014 Contact Now","priority":"Low","notes":"Stage: Bid Results | Water Line","source":"Dodge"},{"project":"RFP/DEV: Great Barrington Affordable Housing","owner":"","gc":"TBD","awarded_to":"","value":1999999,"type":"Residential","county":"Berkshire","state":"MA","town":"Great Barrington","bid_date":"2026-05-30","award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Request for Proposals | Sale/Spec Homes Apartments/Condominiums 1-3 Stories","source":"Dodge"},{"project":"RFQ/AE: Professional Engineering Services IQC","owner":"","gc":"TBD","awarded_to":"","value":1999999,"type":"Municipal","county":"Hampden","state":"MA","town":"Agawam","bid_date":"2026-03-12","award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Request for Qualifications | Water Line","source":"Dodge"},{"project":"2026 Roadway Safety Improvements IQC","owner":"","gc":"TBD","awarded_to":"","value":733049,"type":"Municipal","county":"Hampden","state":"MA","town":"Springfield","bid_date":"2026-02-20","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Start | Paving Sidewalk/Parking Lot Highway Signs/Guardrails","source":"Dodge"},{"project":"FY27-08 Pavement Preservation Services","owner":"","gc":"TBD","awarded_to":"","value":1748500,"type":"Municipal","county":"Berkshire","state":"MA","town":"Pittsfield","bid_date":"2026-04-02","award_date":null,"status":"Not Contacted","priority":"High","notes":"Stage: Bidding | Paving","source":"Dodge"},{"project":"FSB Glenwood Elementary School AC Upgrades","owner":"","gc":"TBD","awarded_to":"","value":400000,"type":"Commercial","county":"Hampden","state":"MA","town":"Springfield","bid_date":"2026-04-09","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Primary School","source":"Dodge"},{"project":"Squadron Operations Facility Building 7087 Repairs REBID","owner":"","gc":"TBD","awarded_to":"","value":15243840,"type":"Industrial","county":"Hampden","state":"MA","town":"Chicopee","bid_date":"2025-12-15","award_date":null,"status":"Not Contacted","priority":"High","notes":"Stage: Start | Office Miscellaneous Education Building Military Facility","source":"Dodge"},{"project":"Bathroom Partition Replacement at Rebecca Johnson ES","owner":"","gc":"TBD","awarded_to":"","value":100000,"type":"Commercial","county":"Hampden","state":"MA","town":"Springfield","bid_date":"2026-03-30","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Primary School","source":"Dodge"},{"project":"Dickinson Street Tree Planting Strip","owner":"","gc":"TBD","awarded_to":"","value":75000,"type":"Commercial","county":"Hampden","state":"MA","town":"Springfield","bid_date":"2026-03-31","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Unclassified","source":"Dodge"},{"project":"Indian Orchard Elementary School Flooring Installation","owner":"","gc":"TBD","awarded_to":"","value":150000,"type":"Commercial","county":"Hampden","state":"MA","town":"Indian Orchard","bid_date":"2026-03-27","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Primary School","source":"Dodge"},{"project":"Oxford Place Elderly Housing Exterior Door Replacement","owner":"","gc":"TBD","awarded_to":"","value":323329,"type":"Residential","county":"Hampden","state":"MA","town":"West Springfield","bid_date":"2026-04-01","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Apartments/Condominiums 1-3 Stories","source":"Dodge"},{"project":"FSB New Lee Public Safety Building HVAC REBID","owner":"","gc":"TBD","awarded_to":"","value":24407000,"type":"Commercial","county":"Berkshire","state":"MA","town":"Lee","bid_date":"2024-08-19","award_date":null,"status":"Not Contacted","priority":"High","notes":"Stage: Start | Fire/Police Station","source":"Dodge"},{"project":"Old Meeting House Repainting","owner":"","gc":"TBD","awarded_to":"","value":110000,"type":"Commercial","county":"Hampden","state":"MA","town":"Wilbraham","bid_date":"2026-03-26","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Museum","source":"Dodge"},{"project":"FSB Heating Systems Upgrades","owner":"","gc":"TBD","awarded_to":"","value":312179,"type":"Residential","county":"Berkshire","state":"MA","town":"Dalton","bid_date":"2026-04-01","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Apartments/Condominiums 1-3 Stories Elderly/Assisted Living","source":"Dodge"},{"project":"Two Air Compressors and Receiver Tank","owner":"","gc":"TBD","awarded_to":"","value":874999,"type":"Industrial","county":"Hampden","state":"MA","town":"Chicopee","bid_date":"2026-03-31","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Military Facility","source":"Dodge"},{"project":"Fy27 Highway Products & Services","owner":"","gc":"TBD","awarded_to":"","value":1230240,"type":"Municipal","county":"Hampden","state":"MA","town":"Berkshire","bid_date":"2026-04-02","award_date":null,"status":"Not Contacted","priority":"High","notes":"Stage: Bidding | Paving Highway Signs/Guardrails Landscaping Storm Sewer","source":"Dodge"},{"project":"MA/DOT: Dalton Avenue Bridge Replacement","owner":"","gc":"TBD","awarded_to":"","value":9546600,"type":"Municipal","county":"Berkshire","state":"MA","town":"Pittsfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Bridge","source":"Dodge"},{"project":"Regional Painting Services REBID IQC","owner":"","gc":"TBD","awarded_to":"","value":40000,"type":"Residential","county":"Hampden","state":"MA","town":"Taunton","bid_date":"2026-04-01","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Custom Homes","source":"Dodge"},{"project":"Brush Hill Road Culvert Replacement","owner":"","gc":"TBD","awarded_to":"","value":777500,"type":"Municipal","county":"Berkshire","state":"MA","town":"Great Barrington","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Pre-Design | Paving Storm Sewer","source":"Dodge"},{"project":"Shaw Bridge - Division St over Williams River Rehabilitation","owner":"","gc":"TBD","awarded_to":"","value":1603000,"type":"Municipal","county":"Berkshire","state":"MA","town":"Great Barrington","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Pre-Design | Paving Bridge","source":"Dodge"},{"project":"MA/DOT: Mill Street Bridge Replacement","owner":"","gc":"TBD","awarded_to":"","value":8572200,"type":"Municipal","county":"Berkshire","state":"MA","town":"Adams","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Bridge","source":"Dodge"},{"project":"2026 Complete Streets & Related Work","owner":"","gc":"TBD","awarded_to":"","value":111813,"type":"Municipal","county":"Berkshire","state":"MA","town":"West Stockbridge","bid_date":"2026-04-02","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Paving Sidewalk/Parking Lot Site Development","source":"Dodge"},{"project":"Fire Station Renovation & Expansion","owner":"","gc":"TBD","awarded_to":"","value":8300000,"type":"Commercial","county":"Hampden","state":"MA","town":"Hampden","bid_date":"2025-09-11","award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Fire/Police Station","source":"Dodge"},{"project":"Gas System Corrosion Control Services","owner":"","gc":"TBD","awarded_to":"","value":1999999,"type":"Commercial","county":"Hampden","state":"MA","town":"Westfield","bid_date":"2026-03-26","award_date":null,"status":"Not Contacted","priority":"High","notes":"Stage: Bidding | Fuel/Chemical Line","source":"Dodge"},{"project":"FAC 124 - Roger Reed Electrical Switches","owner":"","gc":"TBD","awarded_to":"","value":0,"type":"Commercial","county":"Hampden","state":"MA","town":"Palmer","bid_date":"2026-03-10","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Unclassified","source":"Dodge"},{"project":"Sprinkler System Repairs REBID","owner":"","gc":"TBD","awarded_to":"","value":487000,"type":"Industrial","county":"Berkshire","state":"MA","town":"Pittsfield","bid_date":"2026-02-25","award_date":null,"status":"Awarded \u2014 Contact Now","priority":"Low","notes":"Stage: Bid Results | Office Capitol/ Courthouse/City Hall","source":"Dodge"},{"project":"Durable Epoxy Floor Installation","owner":"","gc":"TBD","awarded_to":"","value":38420,"type":"Commercial","county":"Hampden","state":"MA","town":"Palmer","bid_date":"2026-03-10","award_date":null,"status":"Awarded \u2014 Contact Now","priority":"Low","notes":"Stage: Bid Results | Office Middle/Senior High School Vocational School","source":"Dodge"},{"project":"Commercial Building","owner":"","gc":"TBD","awarded_to":"","value":249999,"type":"Industrial","county":"Berkshire","state":"MA","town":"Williamstown","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Office Food/Beverage Service Retail (Other)","source":"Dodge"},{"project":"Vanderbilt Berkshires Estate / Elm Court Hotel/Condos/Spa","owner":"","gc":"TBD","awarded_to":"","value":75000000,"type":"Residential","county":"Berkshire","state":"MA","town":"Lenox","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Planning Schematics | Apartments/Condominiums 1-3 Stories Food/Beverage Service Miscellaneous Recreational Hotel/Motel","source":"Dodge"},{"project":"Becket Highway Facility Feasibility Study","owner":"","gc":"TBD","awarded_to":"","value":874999,"type":"Municipal","county":"Berkshire","state":"MA","town":"Becket","bid_date":"2026-03-31","award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Request for Qualifications | Paving","source":"Dodge"},{"project":"Wahconah Park Grandstand Demolition","owner":"","gc":"TBD","awarded_to":"","value":415789,"type":"Commercial","county":"Berkshire","state":"MA","town":"Pittsfield","bid_date":"2026-03-05","award_date":null,"status":"Awarded \u2014 Contact Now","priority":"Low","notes":"Stage: Bid Results | Unclassified","source":"Dodge"},{"project":"Pittsfield Road Complete Site-Work","owner":"","gc":"TBD","awarded_to":"","value":1999999,"type":"Commercial","county":"Berkshire","state":"MA","town":"Pittsfield","bid_date":"2026-03-31","award_date":null,"status":"Not Contacted","priority":"High","notes":"Stage: Bidding | Site Development","source":"Dodge"},{"project":"MA/DOT: Hampden Bridge Replacement","owner":"","gc":"TBD","awarded_to":"","value":4053500,"type":"Municipal","county":"Hampden","state":"MA","town":"Hampden","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Bridge","source":"Dodge"},{"project":"MA/DOT: District 2 Bridge Deck and Joint Repairs","owner":"","gc":"TBD","awarded_to":"","value":1280396,"type":"Municipal","county":"Hampden","state":"MA","town":"Boston","bid_date":"2026-03-10","award_date":null,"status":"Awarded \u2014 Contact Now","priority":"Low","notes":"Stage: Bid Results | Bridge","source":"Dodge"},{"project":"Blandford Russell Stage Road Improvements","owner":"","gc":"TBD","awarded_to":"","value":54076,"type":"Municipal","county":"Hampden","state":"MA","town":"Blandford","bid_date":"2026-03-25","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Paving","source":"Dodge"},{"project":"FSB Well 2 Pumping Station Rehabilitation","owner":"","gc":"TBD","awarded_to":"","value":1100000,"type":"Municipal","county":"Berkshire","state":"MA","town":"Williamstown","bid_date":"2026-04-15","award_date":null,"status":"Not Contacted","priority":"High","notes":"Stage: GC Bidding | Water Treatment Plant","source":"Dodge"},{"project":"The Hillside at Providence Place Affordable Housing Phase 3","owner":"","gc":"TBD","awarded_to":"","value":3999999,"type":"Residential","county":"Hampden","state":"MA","town":"West Springfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Apartments/Condominiums 1-3 Stories","source":"Dodge"},{"project":"City Wide Small Area Pavement Repairs","owner":"","gc":"TBD","awarded_to":"","value":50000,"type":"Municipal","county":"Berkshire","state":"MA","town":"Pittsfield","bid_date":"2026-03-18","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Paving","source":"Dodge"},{"project":"Tree Trimming and Removal Service","owner":"","gc":"TBD","awarded_to":"","value":0,"type":"Commercial","county":"Hampden","state":"MA","town":"Agawam","bid_date":"2026-03-26","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Unclassified","source":"Dodge"},{"project":"Slope Stabilization to Remove a Large Roadside Rock","owner":"","gc":"TBD","awarded_to":"","value":59000,"type":"Commercial","county":"Hampden","state":"MA","town":"Granville","bid_date":"2026-02-04","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Start | Site Development","source":"Dodge"},{"project":"MA/DOT: Rt 147 Bridge Rehabilitation","owner":"","gc":"TBD","awarded_to":"","value":19711612,"type":"Municipal","county":"Hampden","state":"MA","town":"West Springfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Planning Schematics | Bridge","source":"Dodge"},{"project":"Town Hall Roof Renovations","owner":"","gc":"TBD","awarded_to":"","value":600000,"type":"Commercial","county":"Berkshire","state":"MA","town":"Otis","bid_date":"2026-05-13","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Capitol/ Courthouse/City Hall","source":"Dodge"},{"project":"Sabic Building Alteration","owner":"","gc":"TBD","awarded_to":"","value":92000,"type":"Industrial","county":"Berkshire","state":"MA","town":"Pittsfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Start | Manufacturing Building","source":"Dodge"},{"project":"Water Wastewater & DPW Chemicals","owner":"","gc":"TBD","awarded_to":"","value":0,"type":"Commercial","county":"Hampden","state":"MA","town":"Westfield","bid_date":"2026-03-31","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Unclassified","source":"Dodge"},{"project":"Site Prep & Lawn Installation","owner":"","gc":"TBD","awarded_to":"","value":624999,"type":"Municipal","county":"Hampden","state":"MA","town":"Springfield","bid_date":"2026-03-12","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Sidewalk/Parking Lot Landscaping","source":"Dodge"},{"project":"FSB Ultraviolet Disinfection System & WWTP Upgrades REBID","owner":"","gc":"TBD","awarded_to":"","value":29224671,"type":"Commercial","county":"Berkshire","state":"MA","town":"Lenox","bid_date":"2025-07-02","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Construction | Sewage Treatment Plant","source":"Dodge"},{"project":"MA/DOT: Route 7 Road Reconstruction","owner":"","gc":"TBD","awarded_to":"","value":13850000,"type":"Municipal","county":"Berkshire","state":"MA","town":"Great Barrington","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Planning Schematics | Roadway Lighting Paving Sidewalk/Parking Lot Highway Signs/Guardrails Storm Sewer","source":"Dodge"},{"project":"Granville - Slope Stabilization","owner":"","gc":"TBD","awarded_to":"","value":59000,"type":"Commercial","county":"Hampden","state":"MA","town":"Granville","bid_date":"2026-02-04","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Start | Site Development","source":"Dodge"},{"project":"West Springfield Fire Department Strategic Plan","owner":"","gc":"TBD","awarded_to":"","value":0,"type":"Commercial","county":"Hampden","state":"MA","town":"West Springfield","bid_date":"2026-04-03","award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Request for Proposals | Fire/Police Station","source":"Dodge"},{"project":"FSB Glickman Elementary School Kitchen Renovation","owner":"","gc":"TBD","awarded_to":"","value":1485000,"type":"Commercial","county":"Hampden","state":"MA","town":"Springfield","bid_date":"2026-03-20","award_date":null,"status":"Not Contacted","priority":"High","notes":"Stage: GC Bidding | Primary School","source":"Dodge"},{"project":"Great Barrington Fire District Interconnection With HWWC","owner":"","gc":"TBD","awarded_to":"","value":7499999,"type":"Commercial","county":"Berkshire","state":"MA","town":"Great Barrington","bid_date":"2026-02-25","award_date":null,"status":"Awarded \u2014 Contact Now","priority":"Low","notes":"Stage: Bid Results | Fire/Police Station","source":"Dodge"},{"project":"Moxon & Kathryne Jones Apartments Window Replacement","owner":"","gc":"TBD","awarded_to":"","value":1999999,"type":"Residential","county":"Hampden","state":"MA","town":"Springfield","bid_date":"2026-03-27","award_date":null,"status":"Not Contacted","priority":"High","notes":"Stage: Bidding | Apartments/Condominiums 1-3 Stories","source":"Dodge"},{"project":"MA/DOT: SR 19 Pavement Preservation","owner":"","gc":"TBD","awarded_to":"","value":4199143,"type":"Municipal","county":"Hampden","state":"MA","town":"Wales","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Paving","source":"Dodge"},{"project":"MA/DOT: I-91 Pavement Preservation","owner":"","gc":"TBD","awarded_to":"","value":1999999,"type":"Municipal","county":"Hampden","state":"MA","town":"Longmeadow","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Paving","source":"Dodge"},{"project":"MA/DOT: SR 20 Pavement Preservation","owner":"","gc":"TBD","awarded_to":"","value":2220700,"type":"Municipal","county":"Hampden","state":"MA","town":"Palmer","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Paving","source":"Dodge"},{"project":"MA/DOT: US 20 Pavement Preservation","owner":"","gc":"TBD","awarded_to":"","value":4765965,"type":"Municipal","county":"Hampden","state":"MA","town":"Westfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Paving","source":"Dodge"},{"project":"MA/DOT: I-84 Pavement Preservation","owner":"","gc":"TBD","awarded_to":"","value":22076782,"type":"Municipal","county":"Hampden","state":"MA","town":"Holland","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Planning Schematics | Paving","source":"Dodge"},{"project":"MA/DOT: US 5 Pavement Preservation","owner":"","gc":"TBD","awarded_to":"","value":6933719,"type":"Municipal","county":"Hampden","state":"MA","town":"Holyoke","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Paving","source":"Dodge"},{"project":"RFQ/AE: Historic Heritage State Park Exterior Improvements","owner":"","gc":"TBD","awarded_to":"","value":250000,"type":"Commercial","county":"Berkshire","state":"MA","town":"North Adams","bid_date":"2026-03-31","award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Request for Qualifications | Park/Playground Site Development","source":"Dodge"},{"project":"MA/DOT: US 20 Pavement Preservation","owner":"","gc":"TBD","awarded_to":"","value":3622071,"type":"Municipal","county":"Berkshire","state":"MA","town":"Lee","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Paving","source":"Dodge"},{"project":"MA/DOT: I-291 Pavement Preservation","owner":"","gc":"TBD","awarded_to":"","value":5782658,"type":"Municipal","county":"Hampden","state":"MA","town":"Chicopee","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Paving","source":"Dodge"},{"project":"MA/DOT: SR 23 Pavement Preservation","owner":"","gc":"TBD","awarded_to":"","value":4852619,"type":"Municipal","county":"Hampden","state":"MA","town":"Blandford","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Paving","source":"Dodge"},{"project":"MA/DOT: US 20 Pavement Preservation","owner":"","gc":"TBD","awarded_to":"","value":5326576,"type":"Municipal","county":"Berkshire","state":"MA","town":"Pittsfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Paving","source":"Dodge"},{"project":"MA/DOT: US 5 Pavement Preservation","owner":"","gc":"TBD","awarded_to":"","value":7254152,"type":"Municipal","county":"Hampden","state":"MA","town":"West Springfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Paving","source":"Dodge"},{"project":"MA/DOT: SR 9 Pavement Preservation","owner":"","gc":"TBD","awarded_to":"","value":3652509,"type":"Municipal","county":"Berkshire","state":"MA","town":"Dalton","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Paving","source":"Dodge"},{"project":"MA/DOT: SR 23 Pavement Preservation","owner":"","gc":"TBD","awarded_to":"","value":4852619,"type":"Municipal","county":"Hampden","state":"MA","town":"Blandford","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Paving","source":"Dodge"},{"project":"Restoration of Manhole No 28","owner":"","gc":"TBD","awarded_to":"","value":69500,"type":"Municipal","county":"Hampden","state":"MA","town":"Holyoke","bid_date":"2026-03-03","award_date":null,"status":"Awarded \u2014 Contact Now","priority":"Low","notes":"Stage: Bid Results | Sanitary Sewer","source":"Dodge"},{"project":"Twiss Street Landfill Cap Repair","owner":"","gc":"TBD","awarded_to":"","value":155720,"type":"Commercial","county":"Hampden","state":"MA","town":"Westfield","bid_date":"2025-09-16","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Start | Site Development","source":"Dodge"},{"project":"Westfield Technical Academy Toilet Room Renovations","owner":"","gc":"TBD","awarded_to":"","value":579810,"type":"Commercial","county":"Hampden","state":"MA","town":"Westfield","bid_date":"2026-01-28","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Start | Middle/Senior High School Miscellaneous Education Building","source":"Dodge"},{"project":"FSB Highway Garage Complex Renovation & Const","owner":"","gc":"TBD","awarded_to":"","value":4275800,"type":"Commercial","county":"Berkshire","state":"MA","town":"Sheffield","bid_date":"2024-09-04","award_date":null,"status":"Awarded \u2014 Contact Now","priority":"Low","notes":"Stage: Bid Results | Vehicle Sales/Service Parking Garage","source":"Dodge"},{"project":"Westfield St 15KV Spacer Cable Installation","owner":"","gc":"TBD","awarded_to":"","value":391381,"type":"Industrial","county":"Hampden","state":"MA","town":"Holyoke","bid_date":"2026-03-03","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Start | Power Lines","source":"Dodge"},{"project":"WTP Sludge Disposal","owner":"","gc":"TBD","awarded_to":"","value":869753,"type":"Commercial","county":"Berkshire","state":"MA","town":"Pittsfield","bid_date":"2026-03-04","award_date":null,"status":"Awarded \u2014 Contact Now","priority":"Low","notes":"Stage: Bid Results | Dredging","source":"Dodge"},{"project":"Vehicle Exhaust system Upgrade and Replacement","owner":"","gc":"TBD","awarded_to":"","value":62130,"type":"Commercial","county":"Hampden","state":"MA","town":"Longmeadow","bid_date":"2026-03-06","award_date":null,"status":"Awarded \u2014 Contact Now","priority":"Low","notes":"Stage: Bid Results | Fire/Police Station","source":"Dodge"},{"project":"Kitchen Cabinet Replacement","owner":"","gc":"TBD","awarded_to":"","value":50000,"type":"Industrial","county":"Berkshire","state":"MA","town":"Pittsfield","bid_date":"2026-03-19","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Office","source":"Dodge"},{"project":"Business Service Buildings","owner":"","gc":"TBD","awarded_to":"","value":2500000,"type":"Industrial","county":"Hampden","state":"MA","town":"Chicopee","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Office Warehouse","source":"Dodge"},{"project":"Wastewater Treatment Plant Upgrades Phase 1","owner":"","gc":"TBD","awarded_to":"","value":35000000,"type":"Commercial","county":"Hampden","state":"MA","town":"Chicopee","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Pre-Design | Sewage Treatment Plant","source":"Dodge"},{"project":"West Springfield WCF FSA Expansion 5 9 10 15 & 50","owner":"","gc":"TBD","awarded_to":"","value":1999999,"type":"Commercial","county":"Hampden","state":"MA","town":"Westfield","bid_date":"2026-03-19","award_date":null,"status":"Not Contacted","priority":"High","notes":"Stage: Bidding | Communication Lines","source":"Dodge"},{"project":"Volvo New Car Showroom","owner":"","gc":"TBD","awarded_to":"","value":3999999,"type":"Commercial","county":"Hampden","state":"MA","town":"West Springfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"High","notes":"Stage: Start | Vehicle Sales/Service","source":"Dodge"},{"project":"Maintain Pavement Markings","owner":"","gc":"TBD","awarded_to":"","value":349999,"type":"Commercial","county":"Hampden","state":"MA","town":"Chicopee","bid_date":"2026-04-08","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Runway/Taxiway","source":"Dodge"},{"project":"Prefabricated Dugouts Installation","owner":"","gc":"TBD","awarded_to":"","value":29900,"type":"Commercial","county":"Hampden","state":"MA","town":"Westfield","bid_date":"2026-02-18","award_date":null,"status":"Awarded \u2014 Contact Now","priority":"Low","notes":"Stage: Bid Results | Stadium","source":"Dodge"},{"project":"Southwick Road Multi Modal Improvements","owner":"","gc":"TBD","awarded_to":"","value":848000,"type":"Municipal","county":"Hampden","state":"MA","town":"Westfield","bid_date":"2026-03-26","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Paving Sidewalk/Parking Lot Storm Sewer","source":"Dodge"},{"project":"Self Storage Facility","owner":"","gc":"TBD","awarded_to":"","value":3999999,"type":"Industrial","county":"Hampden","state":"MA","town":"West Springfield","bid_date":null,"award_date":null,"status":"Lost","priority":"Low","notes":"Stage: Notice of Completion | Warehouse","source":"Dodge"},{"project":"Norfolk Road Reconstruction & Related Work","owner":"","gc":"TBD","awarded_to":"","value":948852,"type":"Municipal","county":"Berkshire","state":"MA","town":"New Marlborough","bid_date":"2026-03-12","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Paving Highway Signs/Guardrails Storm Sewer","source":"Dodge"},{"project":"FSB Unit Modifications - Phase 3 - Toepfert Apartments","owner":"","gc":"TBD","awarded_to":"","value":690000,"type":"Residential","county":"Hampden","state":"MA","town":"Holyoke","bid_date":"2026-04-15","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: GC Bidding | Apartments/Condominiums 1-3 Stories Apartments/Condominiums 4+ Stories","source":"Dodge"},{"project":"B7 & 28 Lightning Protection Repairs","owner":"","gc":"TBD","awarded_to":"","value":37000,"type":"Commercial","county":"Hampden","state":"MA","town":"Springfield","bid_date":"2026-03-11","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | College/University","source":"Dodge"},{"project":"FSB Southwick Wellfield Dehumidification REBID","owner":"","gc":"TBD","awarded_to":"","value":366521,"type":"Municipal","county":"Hampden","state":"MA","town":"Westfield","bid_date":"2026-02-20","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Start | Water Treatment Plant","source":"Dodge"},{"project":"23kv Distribution System Reclosers","owner":"","gc":"TBD","awarded_to":"","value":0,"type":"Commercial","county":"Hampden","state":"MA","town":"Westfield","bid_date":"2026-03-17","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Unclassified","source":"Dodge"},{"project":"MA/DOT: (Lee) Rte 20 Road Resurfacing","owner":"","gc":"TBD","awarded_to":"","value":3831500,"type":"Municipal","county":"Berkshire","state":"MA","town":"Lee","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Paving","source":"Dodge"},{"project":"Pierce Street Water Main Improvements","owner":"","gc":"TBD","awarded_to":"","value":568258,"type":"Municipal","county":"Hampden","state":"MA","town":"West Springfield","bid_date":"2026-01-30","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Start | Paving Water Line","source":"Dodge"},{"project":"Becker Pond Dam Removal","owner":"","gc":"TBD","awarded_to":"","value":750000,"type":"Municipal","county":"Berkshire","state":"MA","town":"Mount Washington","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Construction | Flood Control","source":"Dodge"},{"project":"Busy Bee Preschool and Child Care Center","owner":"","gc":"TBD","awarded_to":"","value":8000000,"type":"Commercial","county":"Berkshire","state":"MA","town":"Lee","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Miscellaneous Education Building Pre-School","source":"Dodge"},{"project":"Assisted Living and Memory Care Facility","owner":"","gc":"TBD","awarded_to":"","value":7499999,"type":"Residential","county":"Hampden","state":"MA","town":"East Longmeadow","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"High","notes":"Stage: Construction Documents | Elderly/Assisted Living","source":"Dodge"},{"project":"2026 Water Pump Stations Mechanical Service","owner":"","gc":"TBD","awarded_to":"","value":75000,"type":"Commercial","county":"Hampden","state":"MA","town":"Wilbraham","bid_date":"2026-01-29","award_date":null,"status":"Awarded \u2014 Contact Now","priority":"Low","notes":"Stage: Bid Results | Sewage Treatment Plant","source":"Dodge"},{"project":"Durant Park New Splash Pad Install","owner":"","gc":"TBD","awarded_to":"","value":194904,"type":"Commercial","county":"Berkshire","state":"MA","town":"Pittsfield","bid_date":"2026-02-26","award_date":null,"status":"Awarded \u2014 Contact Now","priority":"Low","notes":"Stage: Bid Results | Swimming Pool","source":"Dodge"},{"project":"MA/DOT: Intersection and Safety Improvements","owner":"","gc":"TBD","awarded_to":"","value":16317082,"type":"Municipal","county":"Hampden","state":"MA","town":"Springfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Planning Schematics | Roadway Lighting Paving Sidewalk/Parking Lot Highway Signs/Guardrails Storm Sewer","source":"Dodge"},{"project":"Frank H. Freedman Elementary School Abatement REBID","owner":"","gc":"TBD","awarded_to":"","value":50000,"type":"Commercial","county":"Hampden","state":"MA","town":"Springfield","bid_date":"2026-03-05","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Primary School","source":"Dodge"},{"project":"Palmer Healthcare Center Addition","owner":"","gc":"TBD","awarded_to":"","value":3999999,"type":"Commercial","county":"Hampden","state":"MA","town":"Palmer","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Nursing/Convalescent Center","source":"Dodge"},{"project":"Old Town Hall Apartments Renovations","owner":"","gc":"TBD","awarded_to":"","value":8200000,"type":"Residential","county":"Hampden","state":"MA","town":"Westfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"High","notes":"Stage: Construction Documents | Apartments/Condominiums 1-3 Stories","source":"Dodge"},{"project":"W.E.B. Du Bois Center for Freedom and Democracy Restoration","owner":"","gc":"TBD","awarded_to":"","value":1999999,"type":"Commercial","county":"Berkshire","state":"MA","town":"Great Barrington","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Miscellaneous Education Building Museum","source":"Dodge"},{"project":"RFQ/GC: Longmeadow Middle School Building","owner":"","gc":"TBD","awarded_to":"","value":118900000,"type":"Commercial","county":"Hampden","state":"MA","town":"Longmeadow","bid_date":"2025-04-10","award_date":null,"status":"Not Contacted","priority":"High","notes":"Stage: GC Bidding Planning Schematics | Middle/Senior High School","source":"Dodge"},{"project":"RFP/AE: 432 Hillside Ave Development","owner":"","gc":"TBD","awarded_to":"","value":218500,"type":"Commercial","county":"Hampden","state":"MA","town":"Holyoke","bid_date":"2026-03-31","award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Request for Proposals | Site Development","source":"Dodge"},{"project":"Liquid Phosphoric Acid Purchase and Delivery IQC","owner":"","gc":"TBD","awarded_to":"","value":0,"type":"Commercial","county":"Hampden","state":"MA","town":"Agawam","bid_date":"2026-03-16","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Unclassified","source":"Dodge"},{"project":"MA/DOT: Route 7 Resurfacing","owner":"","gc":"TBD","awarded_to":"","value":6000000,"type":"Municipal","county":"Berkshire","state":"MA","town":"Sheffield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Paving","source":"Dodge"},{"project":"Pittsfield - East St Sewer Line Replace","owner":"","gc":"TBD","awarded_to":"","value":50000,"type":"Municipal","county":"Berkshire","state":"MA","town":"Pittsfield","bid_date":"2025-11-19","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Start | Sanitary Sewer","source":"Dodge"},{"project":"Springfield DPW Fueling Depot Renovation","owner":"","gc":"TBD","awarded_to":"","value":1234400,"type":"Commercial","county":"Hampden","state":"MA","town":"Springfield","bid_date":"2025-11-26","award_date":null,"status":"Not Contacted","priority":"High","notes":"Stage: Start | Vehicle Sales/Service","source":"Dodge"},{"project":"Holyoke Floodwall Stoplog 7 Repair","owner":"","gc":"TBD","awarded_to":"","value":345000,"type":"Municipal","county":"Hampden","state":"MA","town":"Holyoke","bid_date":"2026-03-26","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Flood Control Site Development","source":"Dodge"},{"project":"Flooring Repairs/Refinishing And Carpet Installation","owner":"","gc":"TBD","awarded_to":"","value":50000,"type":"Commercial","county":"Hampden","state":"MA","town":"Holyoke","bid_date":"2026-03-06","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Capitol/ Courthouse/City Hall","source":"Dodge"},{"project":"Proposed Bridge Superstructure Replacement","owner":"","gc":"TBD","awarded_to":"","value":620861,"type":"Municipal","county":"Hampden","state":"MA","town":"Hampden","bid_date":"2026-03-05","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Bridge","source":"Dodge"},{"project":"West Springfield WCF Underground Construction","owner":"","gc":"TBD","awarded_to":"","value":147503,"type":"Commercial","county":"Hampden","state":"MA","town":"Westfield","bid_date":"2026-03-19","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Communication Lines","source":"Dodge"},{"project":"Gymnasium Equipment Installation","owner":"","gc":"TBD","awarded_to":"","value":35000,"type":"Commercial","county":"Hampden","state":"MA","town":"Agawam","bid_date":"2026-03-11","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Miscellaneous Education Building","source":"Dodge"},{"project":"Dalton Police Department New Building","owner":"","gc":"TBD","awarded_to":"","value":37499999,"type":"Commercial","county":"Berkshire","state":"MA","town":"Dalton","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Planning Schematics | Fire/Police Station","source":"Dodge"},{"project":"Whip City Fiber General Construction","owner":"","gc":"TBD","awarded_to":"","value":1999999,"type":"Commercial","county":"Hampden","state":"MA","town":"Westfield","bid_date":"2026-03-19","award_date":null,"status":"Not Contacted","priority":"High","notes":"Stage: Bidding | Communication Lines","source":"Dodge"},{"project":"Central Fire Station Window Replacement","owner":"","gc":"TBD","awarded_to":"","value":450000,"type":"Commercial","county":"Berkshire","state":"MA","town":"Pittsfield","bid_date":"2026-03-12","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Fire/Police Station","source":"Dodge"},{"project":"FSB Greylock Elementary School Improvements","owner":"","gc":"TBD","awarded_to":"","value":50498544,"type":"Commercial","county":"Berkshire","state":"MA","town":"North Adams","bid_date":"2026-01-23","award_date":null,"status":"Not Contacted","priority":"High","notes":"Stage: Start | Primary School","source":"Dodge"},{"project":"Mary Walsh ES Flooring Installation","owner":"","gc":"TBD","awarded_to":"","value":100000,"type":"Commercial","county":"Hampden","state":"MA","town":"Springfield","bid_date":"2026-03-03","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Primary School","source":"Dodge"},{"project":"Holyoke Public School Roof Replacement","owner":"","gc":"TBD","awarded_to":"","value":5243850,"type":"Commercial","county":"Hampden","state":"MA","town":"Holyoke","bid_date":"2026-01-13","award_date":null,"status":"Not Contacted","priority":"High","notes":"Stage: Construction Documents | Primary School Middle/Senior High School Pre-School","source":"Dodge"},{"project":"Springfield Symphony Hall IT Upgrades","owner":"","gc":"TBD","awarded_to":"","value":100000,"type":"Commercial","county":"Hampden","state":"MA","town":"Springfield","bid_date":"2026-03-04","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Theater/Auditorium","source":"Dodge"},{"project":"Demolition of 2 Residential Properties","owner":"","gc":"TBD","awarded_to":"","value":150000,"type":"Commercial","county":"Berkshire","state":"MA","town":"Pittsfield","bid_date":"2026-03-12","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Unclassified","source":"Dodge"},{"project":"RFP/DEV: Sale & Redevelopment of 241 Main Street","owner":"","gc":"TBD","awarded_to":"","value":449999,"type":"Commercial","county":"Hampden","state":"MA","town":"Springfield","bid_date":"2026-04-15","award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Request for Proposals | Site Development","source":"Dodge"},{"project":"MA/DOT: Williamstown - Route 43 Reconstruction","owner":"","gc":"TBD","awarded_to":"","value":18336200,"type":"Municipal","county":"Berkshire","state":"MA","town":"Williamstown","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Planning Schematics | Paving","source":"Dodge"},{"project":"Raymond M. Sullivan Public Safety Complex Roof Replace","owner":"","gc":"TBD","awarded_to":"","value":500000,"type":"Industrial","county":"Hampden","state":"MA","town":"Springfield","bid_date":"2026-03-05","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Office Fire/Police Station","source":"Dodge"},{"project":"Farm in the Woods Outdoor Learning Playscape","owner":"","gc":"TBD","awarded_to":"","value":426331,"type":"Commercial","county":"Hampden","state":"MA","town":"Westfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Miscellaneous Recreational Park/Playground","source":"Dodge"},{"project":"24-34 North Park Square Residences (Conv of historic bank)","owner":"","gc":"TBD","awarded_to":"","value":15000000,"type":"Residential","county":"Berkshire","state":"MA","town":"Pittsfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Planning Schematics | Apartments/Condominiums 4+ Stories","source":"Dodge"},{"project":"Chapel Road Culvert Replacement Over Chickley River","owner":"","gc":"TBD","awarded_to":"","value":1487000,"type":"Municipal","county":"Berkshire","state":"MA","town":"Savoy","bid_date":"2025-11-18","award_date":null,"status":"Not Contacted","priority":"High","notes":"Stage: Start | Paving Site Development Storm Sewer","source":"Dodge"},{"project":"RFP/AE: BWD Drinking Water System","owner":"","gc":"TBD","awarded_to":"","value":556800,"type":"Municipal","county":"Berkshire","state":"MA","town":"Clarksburg","bid_date":"2026-03-23","award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Request for Proposals | Water Treatment Plant","source":"Dodge"},{"project":"Wolf Swamp Road Elementary School Entry Vestibule","owner":"","gc":"TBD","awarded_to":"","value":241000,"type":"Commercial","county":"Hampden","state":"MA","town":"Longmeadow","bid_date":"2026-03-06","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: GC Bidding | Primary School","source":"Dodge"},{"project":"MA/DOT: Lee - Mill Street Bridge Replacement","owner":"","gc":"TBD","awarded_to":"","value":8248499,"type":"Municipal","county":"Berkshire","state":"MA","town":"Lee","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Bridge","source":"Dodge"},{"project":"Stations 2 & 3 Overhead Door Replacements","owner":"","gc":"TBD","awarded_to":"","value":67950,"type":"Commercial","county":"Hampden","state":"MA","town":"West Springfield","bid_date":"2026-01-21","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Start | Fire/Police Station","source":"Dodge"},{"project":"MA/DOT: West Springfield - Brush Hill Over I-91 Deck Replace","owner":"","gc":"TBD","awarded_to":"","value":22187412,"type":"Municipal","county":"Hampden","state":"MA","town":"West Springfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Planning Schematics | Bridge","source":"Dodge"},{"project":"RFQ/DB: MA/DOT: Chicopee - Bridge Replacement","owner":"","gc":"TBD","awarded_to":"","value":148581581,"type":"Municipal","county":"Hampden","state":"MA","town":"Chicopee","bid_date":"2026-02-10","award_date":null,"status":"Awarded \u2014 Contact Now","priority":"Medium","notes":"Stage: Bid Results Pre-Design | Bridge","source":"Dodge"},{"project":"RFP/AE: Herberg Middle School Roof Replacement","owner":"","gc":"TBD","awarded_to":"","value":874999,"type":"Commercial","county":"Berkshire","state":"MA","town":"Pittsfield","bid_date":"2026-03-04","award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Request for Proposals | Middle/Senior High School","source":"Dodge"},{"project":"RFQ/AE: Combined Sewer Separation Project","owner":"","gc":"TBD","awarded_to":"","value":450000,"type":"Municipal","county":"Hampden","state":"MA","town":"Holyoke","bid_date":"2026-03-24","award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Request for Qualifications | Storm Sewer Sanitary Sewer","source":"Dodge"},{"project":"FSB Paratransit Facility Facade Repairs","owner":"","gc":"TBD","awarded_to":"","value":624999,"type":"Commercial","county":"Hampden","state":"MA","town":"Springfield","bid_date":"2026-03-05","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Vehicle Sales/Service","source":"Dodge"},{"project":"Potassium Permanganate","owner":"","gc":"TBD","awarded_to":"","value":0,"type":"Commercial","county":"Hampden","state":"MA","town":"Chicopee","bid_date":"2026-03-03","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Unclassified","source":"Dodge"},{"project":"MA/DOT: Pioneer Valley Railroad Grade Crossing Improvements","owner":"","gc":"TBD","awarded_to":"","value":1500000,"type":"Municipal","county":"Hampden","state":"MA","town":"Longmeadow","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Railroad","source":"Dodge"},{"project":"Pv Maintenance and Upgrades","owner":"","gc":"TBD","awarded_to":"","value":1377665,"type":"Industrial","county":"Hampden","state":"MA","town":"Boston","bid_date":"2026-01-22","award_date":null,"status":"Not Contacted","priority":"High","notes":"Stage: Start | Office Vehicle Sales/Service Miscellaneous Recreational","source":"Dodge"},{"project":"Waste Water Operations Center Building","owner":"","gc":"TBD","awarded_to":"","value":5000000,"type":"Industrial","county":"Hampden","state":"MA","town":"Westfield","bid_date":"2024-07-18","award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Pre-Design | Office","source":"Dodge"},{"project":"Theater Space (Conversion from dining hall)","owner":"","gc":"TBD","awarded_to":"","value":7499999,"type":"Commercial","county":"Hampden","state":"MA","town":"Wilbraham","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Primary School Theater/Auditorium","source":"Dodge"},{"project":"MA/DOT: Route 8 Rock Stabilization","owner":"","gc":"TBD","awarded_to":"","value":14654000,"type":"Commercial","county":"Berkshire","state":"MA","town":"Sandisfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Planning Schematics | Site Development","source":"Dodge"},{"project":"MA/DOT: Stockbridge - Route 7 Culvert Replacement","owner":"","gc":"TBD","awarded_to":"","value":3077210,"type":"Municipal","county":"Berkshire","state":"MA","town":"Stockbridge","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Storm Sewer","source":"Dodge"},{"project":"MA/DOT: Savoy - Black Brook Rd Bridge Replacement","owner":"","gc":"TBD","awarded_to":"","value":8241415,"type":"Municipal","county":"Berkshire","state":"MA","town":"Savoy","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Bridge","source":"Dodge"},{"project":"FSB Window and Door Replacement at Central HS","owner":"","gc":"TBD","awarded_to":"","value":3214321,"type":"Commercial","county":"Hampden","state":"MA","town":"Springfield","bid_date":"2025-11-10","award_date":null,"status":"Not Contacted","priority":"High","notes":"Stage: Start | Middle/Senior High School","source":"Dodge"},{"project":"MA/DOT: Pontoosuc Ave Bridge Replacement","owner":"","gc":"TBD","awarded_to":"","value":10690000,"type":"Municipal","county":"Berkshire","state":"MA","town":"Pittsfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Planning Schematics | Paving Bridge Sidewalk/Parking Lot Highway Signs/Guardrails","source":"Dodge"},{"project":"MA/DOT: Springfield - James Avenue Bridge Replacement","owner":"","gc":"TBD","awarded_to":"","value":9609490,"type":"Municipal","county":"Hampden","state":"MA","town":"Springfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Bridge","source":"Dodge"},{"project":"MA/DOT: Sheffield - Kelsey Road Bridge Replacement","owner":"","gc":"TBD","awarded_to":"","value":4400000,"type":"Municipal","county":"Berkshire","state":"MA","town":"Sheffield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Paving Bridge Highway Signs/Guardrails","source":"Dodge"},{"project":"MA/DOT: Westfield Barnes Airport Const Engine Run-up Pad","owner":"","gc":"TBD","awarded_to":"","value":3960000,"type":"Commercial","county":"Hampden","state":"MA","town":"Westfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Runway/Taxiway","source":"Dodge"},{"project":"MA/DOT:Pittsfield Municipal Airport Taxiway A Reconstruction","owner":"","gc":"TBD","awarded_to":"","value":6590000,"type":"Commercial","county":"Berkshire","state":"MA","town":"Pittsfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Runway/Taxiway","source":"Dodge"},{"project":"Stearns Square Park Lighting Improvements REBID","owner":"","gc":"TBD","awarded_to":"","value":62450,"type":"Municipal","county":"Hampden","state":"MA","town":"Springfield","bid_date":"2026-01-14","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Start | Roadway Lighting","source":"Dodge"},{"project":"Roadway Safety Improvements","owner":"","gc":"TBD","awarded_to":"","value":832750,"type":"Municipal","county":"Hampden","state":"MA","town":"Springfield","bid_date":"2026-02-20","award_date":null,"status":"Awarded \u2014 Contact Now","priority":"Low","notes":"Stage: Bid Results | Roadway Lighting Paving Sidewalk/Parking Lot Highway Signs/Guardrails","source":"Dodge"},{"project":"Conant Brook Dam Grounds Maintenance Service IQC","owner":"","gc":"TBD","awarded_to":"","value":0,"type":"Commercial","county":"Hampden","state":"MA","town":"Monson","bid_date":"2026-03-04","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Unclassified","source":"Dodge"},{"project":"FSB Green River Pump Station UV Disinfection","owner":"","gc":"TBD","awarded_to":"","value":334900,"type":"Commercial","county":"Berkshire","state":"MA","town":"Great Barrington","bid_date":"2026-02-17","award_date":null,"status":"Awarded \u2014 Contact Now","priority":"Low","notes":"Stage: Bid Results | Sewage Treatment Plant","source":"Dodge"},{"project":"FSB Indian Orchard Elementary School Roof Replacement","owner":"","gc":"TBD","awarded_to":"","value":2246000,"type":"Commercial","county":"Hampden","state":"MA","town":"Springfield","bid_date":"2026-02-13","award_date":null,"status":"Not Contacted","priority":"High","notes":"Stage: Start | Primary School","source":"Dodge"},{"project":"Camp Shepard Bathhouse- Welcome Center & Pavilion","owner":"","gc":"TBD","awarded_to":"","value":2558500,"type":"Commercial","county":"Hampden","state":"MA","town":"Westfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Miscellaneous Recreational","source":"Dodge"},{"project":"Cobble Mountain Unit 3 Valve Replacements","owner":"","gc":"TBD","awarded_to":"","value":2500000,"type":"Municipal","county":"Hampden","state":"MA","town":"Agawam","bid_date":"2026-05-08","award_date":null,"status":"Not Contacted","priority":"High","notes":"Stage: Bidding | Water Treatment Plant","source":"Dodge"},{"project":"MA/DOT: Washington - Lower Valley Road Bridge Replacement","owner":"","gc":"TBD","awarded_to":"","value":3741725,"type":"Municipal","county":"Hampden","state":"MA","town":"Washington","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Bridge","source":"Dodge"},{"project":"MA/DOT: Westfield - Southampton Rd Intersection Improvements","owner":"","gc":"TBD","awarded_to":"","value":8953144,"type":"Municipal","county":"Hampden","state":"MA","town":"Westfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Paving","source":"Dodge"},{"project":"MA/DOT: Tyringham - Jerusalem Road Bridge Replacement","owner":"","gc":"TBD","awarded_to":"","value":4513418,"type":"Municipal","county":"Berkshire","state":"MA","town":"Tyringham","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Bridge","source":"Dodge"},{"project":"Longmeadow -2025 Street Road Resurfacing","owner":"","gc":"TBD","awarded_to":"","value":921139,"type":"Municipal","county":"Hampden","state":"MA","town":"Longmeadow","bid_date":"2025-10-02","award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Construction | Paving Sidewalk/Parking Lot Storm Sewer","source":"Dodge"},{"project":"West Springfield - Sewer Main Repair & Replacement","owner":"","gc":"TBD","awarded_to":"","value":3500000,"type":"Municipal","county":"Hampden","state":"MA","town":"West Springfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Pre-Design | Sanitary Sewer","source":"Dodge"},{"project":"Shaker Rd Water Treatment Facility Upgrades","owner":"","gc":"TBD","awarded_to":"","value":1500000,"type":"Municipal","county":"Hampden","state":"MA","town":"Westfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Pre-Design | Water Treatment Plant","source":"Dodge"},{"project":"West Springfield - Amostown Road Water Main","owner":"","gc":"TBD","awarded_to":"","value":550000,"type":"Municipal","county":"Hampden","state":"MA","town":"West Springfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Pre-Design | Water Line","source":"Dodge"},{"project":"West Springfield - Hillcrest Water Main","owner":"","gc":"TBD","awarded_to":"","value":1500000,"type":"Municipal","county":"Hampden","state":"MA","town":"West Springfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Pre-Design | Water Line","source":"Dodge"},{"project":"West Springfield - Birnie Avenue Sidewalk Construction","owner":"","gc":"TBD","awarded_to":"","value":1000000,"type":"Municipal","county":"Hampden","state":"MA","town":"West Springfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Pre-Design | Paving Sidewalk/Parking Lot","source":"Dodge"},{"project":"West Springfield - Bear Hole Dam","owner":"","gc":"TBD","awarded_to":"","value":2500000,"type":"Municipal","county":"Hampden","state":"MA","town":"West Springfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Pre-Design | Water Supply","source":"Dodge"},{"project":"West Springfield - Vets Field Updates","owner":"","gc":"TBD","awarded_to":"","value":750000,"type":"Commercial","county":"Hampden","state":"MA","town":"West Springfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Pre-Design | Park/Playground","source":"Dodge"},{"project":"West Springfield Public Library Upgrades","owner":"","gc":"TBD","awarded_to":"","value":500000,"type":"Commercial","county":"Hampden","state":"MA","town":"West Springfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Pre-Design | Library","source":"Dodge"},{"project":"West Springfield - Sanitary Sewer Main Repair & Replace","owner":"","gc":"TBD","awarded_to":"","value":750000,"type":"Municipal","county":"Hampden","state":"MA","town":"West Springfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Sanitary Sewer","source":"Dodge"},{"project":"Piper Rd & Amostown Rd Intersection Reconstruction","owner":"","gc":"TBD","awarded_to":"","value":1500000,"type":"Municipal","county":"Hampden","state":"MA","town":"West Springfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Paving","source":"Dodge"},{"project":"Dix Street - Baldwin CSX Sewer Main Repairs","owner":"","gc":"TBD","awarded_to":"","value":500000,"type":"Municipal","county":"Hampden","state":"MA","town":"West Springfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Pre-Design | Sanitary Sewer","source":"Dodge"},{"project":"Jaime Ulloa Park Improvements","owner":"","gc":"TBD","awarded_to":"","value":350000,"type":"Commercial","county":"Hampden","state":"MA","town":"Springfield","bid_date":"2025-10-30","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Construction Documents | Park/Playground","source":"Dodge"},{"project":"Chilson - Sibley Sewer Main Improvements","owner":"","gc":"TBD","awarded_to":"","value":2750000,"type":"Municipal","county":"Hampden","state":"MA","town":"West Springfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Pre-Design | Sanitary Sewer","source":"Dodge"},{"project":"New Riverdale St (Elm - East Elm) Water Main Replacement","owner":"","gc":"TBD","awarded_to":"","value":7920000,"type":"Municipal","county":"Hampden","state":"MA","town":"West Springfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Pre-Design | Water Line","source":"Dodge"},{"project":"Pierce / Craig / Bradford / Morgan Water Main Replacement","owner":"","gc":"TBD","awarded_to":"","value":2500000,"type":"Municipal","county":"Hampden","state":"MA","town":"West Springfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Pre-Design | Water Line","source":"Dodge"},{"project":"Chestnut Street Permeable Paving","owner":"","gc":"TBD","awarded_to":"","value":79977,"type":"Municipal","county":"Hampden","state":"MA","town":"Springfield","bid_date":"2026-01-09","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Start | Paving","source":"Dodge"},{"project":"Springfield PS On Call Kitchen Refrigeration Repai IQC","owner":"","gc":"TBD","awarded_to":"","value":100000,"type":"Commercial","county":"Hampden","state":"MA","town":"Springfield","bid_date":"2025-09-11","award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Pre-Design | Primary School Middle/Senior High School","source":"Dodge"},{"project":"Downtown Vacant Block Comprehensive Plan IDIQ","owner":"","gc":"TBD","awarded_to":"","value":0,"type":"Commercial","county":"Hampden","state":"MA","town":"Holyoke","bid_date":"2026-03-25","award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Request for Qualifications | Site Development","source":"Dodge"},{"project":"Angie Florian Park Master Plan","owner":"","gc":"TBD","awarded_to":"","value":35000,"type":"Commercial","county":"Hampden","state":"MA","town":"Springfield","bid_date":"2025-11-12","award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Pre-Design | Park/Playground","source":"Dodge"},{"project":"Professional Architectural Services IQC","owner":"","gc":"TBD","awarded_to":"","value":1999999,"type":"Industrial","county":"Hampden","state":"MA","town":"Springfield","bid_date":"2025-09-25","award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Office","source":"Dodge"},{"project":"Professional Engineering Services IQC","owner":"","gc":"TBD","awarded_to":"","value":750000,"type":"Municipal","county":"Hampden","state":"MA","town":"Springfield","bid_date":"2025-09-25","award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Paving","source":"Dodge"},{"project":"Polymer - City of Chicopee IQC","owner":"","gc":"TBD","awarded_to":"","value":0,"type":"Commercial","county":"Hampden","state":"MA","town":"Chicopee","bid_date":"2026-04-17","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Unclassified","source":"Dodge"},{"project":"Window Replacement","owner":"","gc":"TBD","awarded_to":"","value":249999,"type":"Commercial","county":"Berkshire","state":"MA","town":"Pittsfield","bid_date":"2026-03-12","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Fire/Police Station","source":"Dodge"},{"project":"YWCA Western Massachusetts Parking Lot Repairs","owner":"","gc":"TBD","awarded_to":"","value":624999,"type":"Municipal","county":"Hampden","state":"MA","town":"Springfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Sidewalk/Parking Lot","source":"Dodge"},{"project":"FSB Repairs & Maintenance of the Columbus Center Garage IQC","owner":"","gc":"TBD","awarded_to":"","value":1999999,"type":"Commercial","county":"Hampden","state":"MA","town":"Springfield","bid_date":"2026-03-10","award_date":null,"status":"Not Contacted","priority":"High","notes":"Stage: Bidding | Parking Garage","source":"Dodge"},{"project":"MA/DOT: Palmer - Shearer Street Deck Replacement","owner":"","gc":"TBD","awarded_to":"","value":7870000,"type":"Municipal","county":"Hampden","state":"MA","town":"Palmer","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Bridge","source":"Dodge"},{"project":"MA/DOT: I-90 Deck Replacement","owner":"","gc":"TBD","awarded_to":"","value":3590000,"type":"Municipal","county":"Hampden","state":"MA","town":"Brimfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Bridge","source":"Dodge"},{"project":"MA/DOT: Holyoke Pavement Preservation","owner":"","gc":"TBD","awarded_to":"","value":14400000,"type":"Municipal","county":"Hampden","state":"MA","town":"West Springfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Planning Schematics | Paving","source":"Dodge"},{"project":"MA/DOT: Stafford Hollow Rd Bridge Replacement","owner":"","gc":"TBD","awarded_to":"","value":9531200,"type":"Municipal","county":"Hampden","state":"MA","town":"Monson","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Bridge","source":"Dodge"},{"project":"MA/DOT: Wahconah Street Bridge Replacement","owner":"","gc":"TBD","awarded_to":"","value":5540647,"type":"Municipal","county":"Berkshire","state":"MA","town":"Pittsfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Bridge","source":"Dodge"},{"project":"MA/DOT: Palmer - Flynt Street Over I - 90 Bridge Replacement","owner":"","gc":"TBD","awarded_to":"","value":8720000,"type":"Municipal","county":"Hampden","state":"MA","town":"Palmer","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Bridge","source":"Dodge"},{"project":"RFP/AE: Egremont Middle School Roof Replacement","owner":"","gc":"TBD","awarded_to":"","value":874999,"type":"Commercial","county":"Berkshire","state":"MA","town":"Pittsfield","bid_date":"2026-03-04","award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Request for Proposals | Middle/Senior High School","source":"Dodge"},{"project":"Linda Petrella Park Improvements","owner":"","gc":"TBD","awarded_to":"","value":107264,"type":"Commercial","county":"Hampden","state":"MA","town":"Springfield","bid_date":"2026-01-16","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Start | Park/Playground Site Development Landscaping","source":"Dodge"},{"project":"MA/DOT: Montgomery St & Granby Rd Intersection Improvements","owner":"","gc":"TBD","awarded_to":"","value":12344629,"type":"Municipal","county":"Hampden","state":"MA","town":"Chicopee","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"High","notes":"Stage: Design Development | Paving Sidewalk/Parking Lot Highway Signs/Guardrails","source":"Dodge"},{"project":"MA/DOT: Westover Airport Reconstruct Taxiway \"S\" & \"P","owner":"","gc":"TBD","awarded_to":"","value":6430000,"type":"Commercial","county":"Hampden","state":"MA","town":"Chicopee","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Airport Lighting Runway/Taxiway","source":"Dodge"},{"project":"MA/DOT: Pittsfield Municipal Airport Expand Terminal Apron","owner":"","gc":"TBD","awarded_to":"","value":8650000,"type":"Commercial","county":"Berkshire","state":"MA","town":"Pittsfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Runway/Taxiway","source":"Dodge"},{"project":"FSB John J. Lyons Administration Building","owner":"","gc":"TBD","awarded_to":"","value":2500000,"type":"Industrial","county":"Hampden","state":"MA","town":"Westfield","bid_date":"2026-05-08","award_date":null,"status":"Not Contacted","priority":"High","notes":"Stage: GC Bidding | Office","source":"Dodge"},{"project":"MA/DOT: Monson - Route 32 Main Street Resurfacing","owner":"","gc":"TBD","awarded_to":"","value":15061959,"type":"Municipal","county":"Hampden","state":"MA","town":"Monson","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Planning Schematics | Paving","source":"Dodge"},{"project":"MA/DOT: Longmeadow Street - Route 5 Resurfacing Phase 1","owner":"","gc":"TBD","awarded_to":"","value":10926977,"type":"Municipal","county":"Hampden","state":"MA","town":"Longmeadow","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Planning Schematics | Roadway Lighting Paving Sidewalk/Parking Lot Highway Signs/Guardrails","source":"Dodge"},{"project":"MA/DOT: Adams Ashuwillticook Rail Trail Extension to Rte 8A","owner":"","gc":"TBD","awarded_to":"","value":19840441,"type":"Commercial","county":"Berkshire","state":"MA","town":"North Adams","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Planning Schematics | Park/Playground","source":"Dodge"},{"project":"MA/DOT: Westfield Barnes Airport New Taxiway To NE Quadrant","owner":"","gc":"TBD","awarded_to":"","value":4400000,"type":"Commercial","county":"Hampden","state":"MA","town":"Westfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Runway/Taxiway","source":"Dodge"},{"project":"MA/DOT: Monterey - Curtis Road Bridge Replacement","owner":"","gc":"TBD","awarded_to":"","value":5800000,"type":"Municipal","county":"Berkshire","state":"MA","town":"Monterey","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Bridge","source":"Dodge"},{"project":"MA/DOT: Rte23 Culvert Replacements","owner":"","gc":"TBD","awarded_to":"","value":3439420,"type":"Municipal","county":"Berkshire","state":"MA","town":"Great Barrington","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Storm Sewer","source":"Dodge"},{"project":"MA/DOT: Howland Avenue Improvements","owner":"","gc":"TBD","awarded_to":"","value":17919975,"type":"Municipal","county":"Berkshire","state":"MA","town":"Adams","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Planning Schematics | Paving Sidewalk/Parking Lot Site Development Landscaping Storm Sewer","source":"Dodge"},{"project":"MA/DOT: Hungerford Street Bridge Replacement","owner":"","gc":"TBD","awarded_to":"","value":3411009,"type":"Municipal","county":"Berkshire","state":"MA","town":"Pittsfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Bridge","source":"Dodge"},{"project":"MA/DOT: Holyoke - High & Maple Streets Corridor Improvements","owner":"","gc":"TBD","awarded_to":"","value":14870000,"type":"Municipal","county":"Hampden","state":"MA","town":"Holyoke","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Planning Schematics | Paving","source":"Dodge"},{"project":"Southwick Pickleball Courts Improve","owner":"","gc":"TBD","awarded_to":"","value":670000,"type":"Commercial","county":"Hampden","state":"MA","town":"Southwick","bid_date":"2026-02-24","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Park/Playground","source":"Dodge"},{"project":"Electrical Improvements","owner":"","gc":"TBD","awarded_to":"","value":403204,"type":"Commercial","county":"Berkshire","state":"MA","town":"Pittsfield","bid_date":"2026-01-14","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Start | Airport Lighting","source":"Dodge"},{"project":"Whip City Fiber - Underground Service Drops","owner":"","gc":"TBD","awarded_to":"","value":874999,"type":"Commercial","county":"Hampden","state":"MA","town":"Westfield","bid_date":"2026-03-03","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Communication Lines","source":"Dodge"},{"project":"Cannabis Retail Store (Conv from church)","owner":"","gc":"TBD","awarded_to":"","value":624999,"type":"Industrial","county":"Hampden","state":"MA","town":"Southwick","bid_date":null,"award_date":null,"status":"Lost","priority":"Low","notes":"Stage: Notice of Completion | Retail (Other)","source":"Dodge"},{"project":"Western Dr Neighborhood Sewer & Storm Drain Improvement","owner":"","gc":"TBD","awarded_to":"","value":1999999,"type":"Municipal","county":"Hampden","state":"MA","town":"Longmeadow","bid_date":"2025-11-06","award_date":null,"status":"Not Contacted","priority":"High","notes":"Stage: Start | Storm Sewer Sanitary Sewer","source":"Dodge"},{"project":"Mary A Dryden Veteran Memorial Automated Logic Control","owner":"","gc":"TBD","awarded_to":"","value":90000,"type":"Commercial","county":"Hampden","state":"MA","town":"Springfield","bid_date":"2026-02-27","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Primary School","source":"Dodge"},{"project":"MA/DOT: Grade Crossing MP 72.80 -MP 86.55 Repairs","owner":"","gc":"TBD","awarded_to":"","value":4950000,"type":"Municipal","county":"Hampden","state":"MA","town":"N/A","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Railroad","source":"Dodge"},{"project":"MA/DOT: Harriman & West Airport Rehabilitate Runway 11-29","owner":"","gc":"TBD","awarded_to":"","value":4300000,"type":"Commercial","county":"Berkshire","state":"MA","town":"North Adams","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Runway/Taxiway","source":"Dodge"},{"project":"MA/DOT: East Longmeadow- Resurfacing","owner":"","gc":"TBD","awarded_to":"","value":8834350,"type":"Municipal","county":"Hampden","state":"MA","town":"East Longmeadow","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Paving Site Development","source":"Dodge"},{"project":"MA/DOT: Montgomery Street Deck Replacement","owner":"","gc":"TBD","awarded_to":"","value":7840000,"type":"Municipal","county":"Hampden","state":"MA","town":"Chicopee","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Bridge","source":"Dodge"},{"project":"MA/DOT: Springfield - Tapley Street Bridge Replacement","owner":"","gc":"TBD","awarded_to":"","value":20420000,"type":"Municipal","county":"Hampden","state":"MA","town":"Springfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Planning Schematics | Paving Bridge","source":"Dodge"},{"project":"FY25 Community Development Block Grant","owner":"","gc":"TBD","awarded_to":"","value":182000,"type":"Residential","county":"Berkshire","state":"MA","town":"Great Barrington","bid_date":"2026-03-04","award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Request for Proposals | Custom Homes","source":"Dodge"},{"project":"FSB Glenwood Elementary School Roof Replacement","owner":"","gc":"TBD","awarded_to":"","value":597365,"type":"Commercial","county":"Hampden","state":"MA","town":"Springfield","bid_date":"2026-02-12","award_date":null,"status":"Awarded \u2014 Contact Now","priority":"Low","notes":"Stage: Bid Results | Primary School","source":"Dodge"},{"project":"Springfield On-Call Floor Finishing and Screening IQC","owner":"","gc":"TBD","awarded_to":"","value":450000,"type":"Industrial","county":"Hampden","state":"MA","town":"Springfield","bid_date":"2025-07-30","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Start | Office","source":"Dodge"},{"project":"Mill River Slabworks Fit-Out","owner":"","gc":"TBD","awarded_to":"","value":624999,"type":"Industrial","county":"Hampden","state":"MA","town":"Westfield","bid_date":null,"award_date":null,"status":"Lost","priority":"Low","notes":"Stage: Notice of Completion | Retail (Other) Warehouse","source":"Dodge"},{"project":"Fairview Hospital Expansion/Renovation","owner":"","gc":"TBD","awarded_to":"","value":70000000,"type":"Commercial","county":"Berkshire","state":"MA","town":"Great Barrington","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"High","notes":"Stage: Start | Hospital","source":"Dodge"},{"project":"East Longmeadow High School Building Project","owner":"","gc":"TBD","awarded_to":"","value":50000,"type":"Commercial","county":"Hampden","state":"MA","town":"East Longmeadow","bid_date":"2026-03-09","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Unclassified","source":"Dodge"},{"project":"Western District Office Exterior Restoration","owner":"","gc":"TBD","awarded_to":"","value":30000,"type":"Industrial","county":"Berkshire","state":"MA","town":"Dalton","bid_date":"2026-03-27","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: GC Bidding | Office","source":"Dodge"},{"project":"Chicopee WWTP Nitrogen Removal Improvements Phase 2","owner":"","gc":"TBD","awarded_to":"","value":7499999,"type":"Commercial","county":"Hampden","state":"MA","town":"Chicopee","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Pre-Design | Sewage Treatment Plant","source":"Dodge"},{"project":"Mary Walsh Elementary School Abatement","owner":"","gc":"TBD","awarded_to":"","value":150000,"type":"Commercial","county":"Hampden","state":"MA","town":"Springfield","bid_date":"2026-02-27","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Primary School","source":"Dodge"},{"project":"Berkshire St & Sargeant St Traffic Signal Improvement","owner":"","gc":"TBD","awarded_to":"","value":373163,"type":"Municipal","county":"Hampden","state":"MA","town":"Holyoke","bid_date":"2026-03-03","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Roadway Lighting Highway Signs/Guardrails","source":"Dodge"},{"project":"Roderick Ireland Courthouse - Aerco Boiler Repairs","owner":"","gc":"TBD","awarded_to":"","value":349999,"type":"Commercial","county":"Hampden","state":"MA","town":"Springfield","bid_date":"2026-02-18","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Capitol/ Courthouse/City Hall","source":"Dodge"},{"project":"MA/DOT: Dalton Division Road Reconstruction","owner":"","gc":"TBD","awarded_to":"","value":17170589,"type":"Municipal","county":"Berkshire","state":"MA","town":"Dalton","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Planning Schematics | Paving","source":"Dodge"},{"project":"Landscaping & Lawn Services IQC","owner":"","gc":"TBD","awarded_to":"","value":0,"type":"Commercial","county":"Hampden","state":"MA","town":"Westfield","bid_date":"2026-02-27","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Unclassified","source":"Dodge"},{"project":"Replace Doors Windows and Remediate Lead Materials","owner":"","gc":"TBD","awarded_to":"","value":81800,"type":"Residential","county":"Hampden","state":"MA","town":"Monson","bid_date":"2026-02-27","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Apartments/Condominiums 1-3 Stories","source":"Dodge"},{"project":"Westfield Gas and Electric Building Renovations","owner":"","gc":"TBD","awarded_to":"","value":13000000,"type":"Industrial","county":"Hampden","state":"MA","town":"Westfield","bid_date":"2026-02-25","award_date":null,"status":"Not Contacted","priority":"High","notes":"Stage: Start | Office Warehouse","source":"Dodge"},{"project":"RFQ/AE: May Brook Road Infrastructure","owner":"","gc":"TBD","awarded_to":"","value":1999999,"type":"Municipal","county":"Hampden","state":"MA","town":"Holland","bid_date":"2026-02-27","award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Request for Qualifications | Paving Storm Sewer","source":"Dodge"},{"project":"Home 2 / Hampton Inn Hotel","owner":"","gc":"TBD","awarded_to":"","value":3999999,"type":"Commercial","county":"Hampden","state":"MA","town":"West Springfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"High","notes":"Stage: Design Development | Hotel/Motel","source":"Dodge"},{"project":"MA/DOT: Springfield/West Springfield Bridge Replacement","owner":"","gc":"TBD","awarded_to":"","value":365868652,"type":"Municipal","county":"Hampden","state":"MA","town":"West Springfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Planning Schematics | Bridge","source":"Dodge"},{"project":"MA/DOT: Park Avenue Bridge Rehabilitation","owner":"","gc":"TBD","awarded_to":"","value":3719240,"type":"Municipal","county":"Hampden","state":"MA","town":"West Springfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Bridge","source":"Dodge"},{"project":"MA/DOT: Hartford and Boston Rail Line Improvements","owner":"","gc":"TBD","awarded_to":"","value":135000000,"type":"Municipal","county":"Hampden","state":"MA","town":"Holyoke","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Planning Schematics | Railroad","source":"Dodge"},{"project":"MA/DOT: (HOLYOKE) Traffic Signal Improvements","owner":"","gc":"TBD","awarded_to":"","value":9811762,"type":"Municipal","county":"Hampden","state":"MA","town":"Holyoke","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Roadway Lighting Paving Sidewalk/Parking Lot Highway Signs/Guardrails","source":"Dodge"},{"project":"MA/DOT: Pittsfield Municipal Airport Reconstruct Apron 01","owner":"","gc":"TBD","awarded_to":"","value":3630000,"type":"Commercial","county":"Berkshire","state":"MA","town":"Pittsfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Runway/Taxiway","source":"Dodge"},{"project":"MA/DOT: Glendale Middle Road Bridge Replacement","owner":"","gc":"TBD","awarded_to":"","value":1999999,"type":"Municipal","county":"Berkshire","state":"MA","town":"Stockbridge","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Bridge","source":"Dodge"},{"project":"MA/DOT: Route 20 Road Resurfacing","owner":"","gc":"TBD","awarded_to":"","value":9950000,"type":"Municipal","county":"Berkshire","state":"MA","town":"Lee","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Paving","source":"Dodge"},{"project":"RFQ/AE: Architecture & Engineering Services IQC","owner":"","gc":"TBD","awarded_to":"","value":1999999,"type":"Residential","county":"Hampden","state":"MA","town":"Holyoke","bid_date":"2026-03-11","award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Request for Qualifications | Custom Homes Apartments/Condominiums 1-3 Stories Apartments/Condominiums 4+ Stories Sidewalk/Parking Lot Landscaping","source":"Dodge"},{"project":"RFQ/AE: Comprehensive Modernization professional Service","owner":"","gc":"TBD","awarded_to":"","value":1999999,"type":"Residential","county":"Hampden","state":"MA","town":"Springfield","bid_date":"2026-03-10","award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Request for Qualifications | Custom Homes Sale/Spec Homes Apartments/Condominiums 1-3 Stories Apartments/Condominiums 4+ Stories","source":"Dodge"},{"project":"Old Stockbridge Rd Exterior Door Replacement - Phase 2","owner":"","gc":"TBD","awarded_to":"","value":39900,"type":"Residential","county":"Berkshire","state":"MA","town":"Lenox","bid_date":"2025-11-19","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Start | Custom Homes","source":"Dodge"},{"project":"RFQ/AE: Roosevelt Ave Corridor Improvements","owner":"","gc":"TBD","awarded_to":"","value":2327143,"type":"Municipal","county":"Hampden","state":"MA","town":"Springfield","bid_date":"2026-03-20","award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Request for Qualifications | Paving Bridge","source":"Dodge"},{"project":"Westfield Carpentry & Painting Services IQC","owner":"","gc":"TBD","awarded_to":"","value":70183,"type":"Industrial","county":"Hampden","state":"MA","town":"Westfield","bid_date":"2026-01-07","award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Pre-Design | Office","source":"Dodge"},{"project":"MA/DOT: Great Barrington - Brookside Rd Bridge Replacement","owner":"","gc":"TBD","awarded_to":"","value":62690000,"type":"Municipal","county":"Berkshire","state":"MA","town":"Great Barrington","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Planning Schematics | Bridge","source":"Dodge"},{"project":"MA/DOT: Pittsfield Bridge Replacement","owner":"","gc":"TBD","awarded_to":"","value":23566140,"type":"Municipal","county":"Berkshire","state":"MA","town":"Pittsfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Planning Schematics | Bridge","source":"Dodge"},{"project":"Chicopee Water Pollution Control Facility Upgrade","owner":"","gc":"TBD","awarded_to":"","value":3000000,"type":"Municipal","county":"Hampden","state":"MA","town":"Chicopee","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Pre-Design | Water Treatment Plant","source":"Dodge"},{"project":"MCLA Early Education Center Renovation","owner":"","gc":"TBD","awarded_to":"","value":1200000,"type":"Commercial","county":"Berkshire","state":"MA","town":"North Adams","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Pre-Design | Miscellaneous Education Building","source":"Dodge"},{"project":"MA/DOT: James Ave I - 291 Bridge Replacement","owner":"","gc":"TBD","awarded_to":"","value":144979200,"type":"Municipal","county":"Hampden","state":"MA","town":"Springfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Planning Schematics | Bridge","source":"Dodge"},{"project":"SSFA Transportation Safety Action Plan","owner":"","gc":"TBD","awarded_to":"","value":0,"type":"Municipal","county":"Hampden","state":"MA","town":"Holyoke","bid_date":"2026-02-24","award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Request for Proposals | Paving","source":"Dodge"},{"project":"MA/DOT: McKnight Trail","owner":"","gc":"TBD","awarded_to":"","value":10782200,"type":"Municipal","county":"Hampden","state":"MA","town":"Springfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Planning Schematics | Paving Highway Signs/Guardrails Park/Playground","source":"Dodge"},{"project":"West Mountain Rd Culvert Strengthening","owner":"","gc":"TBD","awarded_to":"","value":520735,"type":"Municipal","county":"Berkshire","state":"MA","town":"Cheshire","bid_date":"2026-02-17","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Storm Sewer","source":"Dodge"},{"project":"MA/DOT: Barker Road Bridge Replacement","owner":"","gc":"TBD","awarded_to":"","value":3194223,"type":"Municipal","county":"Berkshire","state":"MA","town":"Pittsfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Bridge","source":"Dodge"},{"project":"MA/DOT: Cook Street Bridge Replacement","owner":"","gc":"TBD","awarded_to":"","value":6310400,"type":"Municipal","county":"Berkshire","state":"MA","town":"Adams","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Bridge","source":"Dodge"},{"project":"Berkshire Community College New Trades Academy","owner":"","gc":"TBD","awarded_to":"","value":995000,"type":"Commercial","county":"Berkshire","state":"MA","town":"Pittsfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Pre-Design | College/University Miscellaneous Education Building","source":"Dodge"},{"project":"Multi-Family Housing (Conversion from nursing home)","owner":"","gc":"TBD","awarded_to":"","value":7499999,"type":"Residential","county":"Hampden","state":"MA","town":"West Springfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Apartments/Condominiums 1-3 Stories","source":"Dodge"},{"project":"Bliss Park Playscape Installation","owner":"","gc":"TBD","awarded_to":"","value":149999,"type":"Commercial","county":"Hampden","state":"MA","town":"Longmeadow","bid_date":"2026-02-18","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Park/Playground","source":"Dodge"},{"project":"New Bunkhouse Building","owner":"","gc":"TBD","awarded_to":"","value":115000,"type":"Commercial","county":"Berkshire","state":"MA","town":"Pittsfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Construction | Dormitory","source":"Dodge"},{"project":"MA/DOT: Bus Bay Lateral Upgrade","owner":"","gc":"TBD","awarded_to":"","value":25888631,"type":"Municipal","county":"Hampden","state":"MA","town":"Springfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Planning Schematics | Passenger Terminal (Other) Paving","source":"Dodge"},{"project":"Hoosac Cotton Mill Redevelopment","owner":"","gc":"TBD","awarded_to":"","value":7499999,"type":"Residential","county":"Berkshire","state":"MA","town":"North Adams","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Apartments/Condominiums 1-3 Stories Apartments/Condominiums 4+ Stories Office Food/Beverage Service Retail (Other)","source":"Dodge"},{"project":"Berkshire Pulse Dance and Creative Arts Center Renovations","owner":"","gc":"TBD","awarded_to":"","value":3999999,"type":"Commercial","county":"Berkshire","state":"MA","town":"Great Barrington","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Miscellaneous Education Building Miscellaneous Recreational","source":"Dodge"},{"project":"Feasibility Study and Schematic Design Phas DUPLICATE REPORT","owner":"","gc":"TBD","awarded_to":"","value":100000000,"type":"Commercial","county":"Berkshire","state":"MA","town":"Stockbridge","bid_date":"2023-07-12","award_date":null,"status":"Lost","priority":"Medium","notes":"Stage: Abandoned | Miscellaneous Education Building","source":"Dodge"},{"project":"Plant Trees Furnish Deliver","owner":"","gc":"TBD","awarded_to":"","value":900000,"type":"Commercial","county":"Hampden","state":"MA","town":"Springfield","bid_date":"2026-02-12","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Unclassified","source":"Dodge"},{"project":"MA/DOT: Kellogg Road Bridge Replacement","owner":"","gc":"TBD","awarded_to":"","value":8497629,"type":"Municipal","county":"Berkshire","state":"MA","town":"Sheffield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Bridge","source":"Dodge"},{"project":"MA/DOT: Melbourne Road Bridge Replacement","owner":"","gc":"TBD","awarded_to":"","value":12499999,"type":"Municipal","county":"Berkshire","state":"MA","town":"Pittsfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Planning Schematics | Bridge","source":"Dodge"},{"project":"Westfield Bank Building Fit Out","owner":"","gc":"TBD","awarded_to":"","value":509000,"type":"Commercial","county":"Hampden","state":"MA","town":"Chicopee","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Construction | Bank","source":"Dodge"},{"project":"MA/DOT: South Main Street Route 7 Pavement Reconstruction","owner":"","gc":"TBD","awarded_to":"","value":7124001,"type":"Municipal","county":"Berkshire","state":"MA","town":"Great Barrington","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Paving","source":"Dodge"},{"project":"Office Building Addition/Renovations","owner":"","gc":"TBD","awarded_to":"","value":624999,"type":"Industrial","county":"Berkshire","state":"MA","town":"Williamstown","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Office","source":"Dodge"},{"project":"West Silver Street Abatement and Demolition","owner":"","gc":"TBD","awarded_to":"","value":449999,"type":"Residential","county":"Hampden","state":"MA","town":"Westfield","bid_date":"2026-02-10","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Custom Homes","source":"Dodge"},{"project":"MA/DOT:I 90 Breckenridge Street Deck Replacement","owner":"","gc":"TBD","awarded_to":"","value":4060000,"type":"Municipal","county":"Hampden","state":"MA","town":"Palmer","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Bridge Highway Signs/Guardrails","source":"Dodge"},{"project":"MA/DOT: Rte 187 Bridge Replacement","owner":"","gc":"TBD","awarded_to":"","value":4667550,"type":"Municipal","county":"Hampden","state":"MA","town":"Westfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Bridge","source":"Dodge"},{"project":"MA/DOT: Bridge preservation","owner":"","gc":"TBD","awarded_to":"","value":5278000,"type":"Municipal","county":"Berkshire","state":"MA","town":"Becket","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Bridge Sidewalk/Parking Lot Railroad","source":"Dodge"},{"project":"Brookside Rd Temporary Single Lane Modular Truss Bridge","owner":"","gc":"TBD","awarded_to":"","value":1999999,"type":"Municipal","county":"Berkshire","state":"MA","town":"Great Barrington","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Pre-Design | Bridge","source":"Dodge"},{"project":"MA/DOT: Route 10 Resurfacing","owner":"","gc":"TBD","awarded_to":"","value":8629346,"type":"Municipal","county":"Hampden","state":"MA","town":"Westfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Roadway Lighting Paving","source":"Dodge"},{"project":"MA/DOT: (Sheffield) Complete Streets Improvements","owner":"","gc":"TBD","awarded_to":"","value":3833825,"type":"Municipal","county":"Berkshire","state":"MA","town":"Sheffield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Paving","source":"Dodge"},{"project":"MA/DOT: (Egremont) Reconstruction of Mount Washington Roa","owner":"","gc":"TBD","awarded_to":"","value":9807885,"type":"Municipal","county":"Hampden","state":"MA","town":"Egremont","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Paving Bridge Highway Signs/Guardrails Storm Sewer","source":"Dodge"},{"project":"MA/DOT: Maintenance Facility Rehabilitation","owner":"","gc":"TBD","awarded_to":"","value":3570000,"type":"Industrial","county":"Hampden","state":"MA","town":"Springfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Office Passenger Terminal (Other) Vehicle Sales/Service","source":"Dodge"},{"project":"RFP/OPM: OPM Services for Crosby Elementary School","owner":"","gc":"TBD","awarded_to":"","value":40750000,"type":"Commercial","county":"Berkshire","state":"MA","town":"Pittsfield","bid_date":"2026-02-18","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Request for Proposals | Primary School","source":"Dodge"},{"project":"Sodium Hydroxide - Purchase IQC","owner":"","gc":"TBD","awarded_to":"","value":150000,"type":"Commercial","county":"Hampden","state":"MA","town":"Westfield","bid_date":"2026-02-06","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Unclassified","source":"Dodge"},{"project":"MA/DOT: Retaining Wall Replacement","owner":"","gc":"TBD","awarded_to":"","value":17495100,"type":"Commercial","county":"Hampden","state":"MA","town":"Longmeadow","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Planning Schematics | Site Development","source":"Dodge"},{"project":"MA/DOT: Route 32 Reconstruction Improvement","owner":"","gc":"TBD","awarded_to":"","value":6134080,"type":"Municipal","county":"Hampden","state":"MA","town":"Palmer","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Paving Landscaping Storm Sewer","source":"Dodge"},{"project":"MA/DOT: Willow Street Bridge Replacement","owner":"","gc":"TBD","awarded_to":"","value":12634291,"type":"Municipal","county":"Berkshire","state":"MA","town":"Lee","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Planning Schematics | Bridge","source":"Dodge"},{"project":"Mixed-Use Building North End Redevelopment","owner":"","gc":"TBD","awarded_to":"","value":7499999,"type":"Residential","county":"Hampden","state":"MA","town":"Springfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Pre-Design | Apartments/Condominiums 1-3 Stories Apartments/Condominiums 4+ Stories Office Food/Beverage Service Retail (Other) Miscellaneous Education Building","source":"Dodge"},{"project":"Town of Agawam Pavement Preservation","owner":"","gc":"TBD","awarded_to":"","value":520050,"type":"Municipal","county":"Hampden","state":"MA","town":"Agawam","bid_date":"2026-01-22","award_date":null,"status":"Awarded \u2014 Contact Now","priority":"Low","notes":"Stage: Bid Results | Paving Sidewalk/Parking Lot","source":"Dodge"},{"project":"Church on the Hill Restoration of 33 Windows","owner":"","gc":"TBD","awarded_to":"","value":349999,"type":"Commercial","county":"Berkshire","state":"MA","town":"Lenox","bid_date":"2025-11-19","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Start | Worship Facility","source":"Dodge"},{"project":"Bear Swamp Brook West Road Culvert Replacement","owner":"","gc":"TBD","awarded_to":"","value":1999999,"type":"Municipal","county":"Berkshire","state":"MA","town":"Clarksburg","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Storm Sewer","source":"Dodge"},{"project":"Scantic Valley YMCA Renovations","owner":"","gc":"TBD","awarded_to":"","value":349999,"type":"Commercial","county":"Hampden","state":"MA","town":"Wilbraham","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Construction Documents | Athletic Facility Miscellaneous Recreational","source":"Dodge"},{"project":"Wahconah Park Renovation","owner":"","gc":"TBD","awarded_to":"","value":17500000,"type":"Industrial","county":"Berkshire","state":"MA","town":"Pittsfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"High","notes":"Stage: Construction Documents | Retail (Other) Stadium Miscellaneous Recreational Park/Playground","source":"Dodge"},{"project":"Water Recovery Fclty Blower Sludge Bldg HVA DUPLICATE REPORT","owner":"","gc":"TBD","awarded_to":"","value":67539,"type":"Municipal","county":"Hampden","state":"MA","town":"Westfield","bid_date":null,"award_date":null,"status":"Lost","priority":"Low","notes":"Stage: Abandoned | Water Treatment Plant","source":"Dodge"},{"project":"FSB Sumner Ave Elementary & Pre-School Roof Replace","owner":"","gc":"TBD","awarded_to":"","value":1347000,"type":"Commercial","county":"Hampden","state":"MA","town":"Springfield","bid_date":"2025-12-22","award_date":null,"status":"Not Contacted","priority":"High","notes":"Stage: Start | Primary School Pre-School","source":"Dodge"},{"project":"MA/DOT: Pedestrian Curb Ramp Construction","owner":"","gc":"TBD","awarded_to":"","value":624999,"type":"Municipal","county":"Berkshire","state":"MA","town":"Great Barrington","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Sidewalk/Parking Lot","source":"Dodge"},{"project":"FSB Pittsfield Digester Cleaning & Inspection Support","owner":"","gc":"TBD","awarded_to":"","value":900000,"type":"Commercial","county":"Berkshire","state":"MA","town":"Pittsfield","bid_date":"2025-11-19","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Start | Dredging","source":"Dodge"},{"project":"Bondsville Water Storage Tank","owner":"","gc":"TBD","awarded_to":"","value":2910800,"type":"Municipal","county":"Hampden","state":"MA","town":"Palmer","bid_date":"2025-09-19","award_date":null,"status":"Not Contacted","priority":"High","notes":"Stage: Start | Site Development Water Tank","source":"Dodge"},{"project":"Stebbins St Electric Line and 15KV Spacer Cable Installatio","owner":"","gc":"TBD","awarded_to":"","value":624999,"type":"Industrial","county":"Hampden","state":"MA","town":"Holyoke","bid_date":"2026-02-03","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Power Lines","source":"Dodge"},{"project":"High School of Commerce Roof Replacement","owner":"","gc":"TBD","awarded_to":"","value":13042000,"type":"Commercial","county":"Hampden","state":"MA","town":"Springfield","bid_date":"2026-02-11","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Pre-Qualification | Middle/Senior High School","source":"Dodge"},{"project":"IFB Highway & Grounds Supply","owner":"","gc":"TBD","awarded_to":"","value":90000,"type":"Commercial","county":"Hampden","state":"MA","town":"Longmeadow","bid_date":"2026-02-13","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Unclassified","source":"Dodge"},{"project":"Snow Removal & Ice Control","owner":"","gc":"TBD","awarded_to":"","value":0,"type":"Commercial","county":"Berkshire","state":"MA","town":"New Ashford","bid_date":"2026-02-18","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Unclassified","source":"Dodge"},{"project":"Bus Maintenance Facility Site Improvements","owner":"","gc":"TBD","awarded_to":"","value":3600000,"type":"Commercial","county":"Hampden","state":"MA","town":"West Springfield","bid_date":"2025-02-27","award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Construction | Vehicle Sales/Service","source":"Dodge"},{"project":"FSB Kelly Elementary School Building Updates","owner":"","gc":"TBD","awarded_to":"","value":6650000,"type":"Commercial","county":"Hampden","state":"MA","town":"Holyoke","bid_date":"2026-01-30","award_date":null,"status":"Not Contacted","priority":"High","notes":"Stage: GC Bidding | Primary School","source":"Dodge"},{"project":"Commercial Building Alteration","owner":"","gc":"TBD","awarded_to":"","value":672845,"type":"Industrial","county":"Berkshire","state":"MA","town":"Pittsfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Construction | Office","source":"Dodge"},{"project":"F-35 Construct MAC Pad","owner":"","gc":"TBD","awarded_to":"","value":7499999,"type":"Industrial","county":"Hampden","state":"MA","town":"Westfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Military Facility","source":"Dodge"},{"project":"F-35 Maintenance Shops Building 15 Repair","owner":"","gc":"TBD","awarded_to":"","value":100000,"type":"Industrial","county":"Hampden","state":"MA","town":"Westfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Pre-Design | Vehicle Sales/Service Military Facility","source":"Dodge"},{"project":"F-35 Allied Support Sunshades","owner":"","gc":"TBD","awarded_to":"","value":7499999,"type":"Industrial","county":"Hampden","state":"MA","town":"Westfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Military Facility","source":"Dodge"},{"project":"F-35 Avionics Facility Building 26 Repair","owner":"","gc":"TBD","awarded_to":"","value":100000,"type":"Industrial","county":"Hampden","state":"MA","town":"Westfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Pre-Design | Military Facility","source":"Dodge"},{"project":"F-35 Repair/Add PL3 Fenceline","owner":"","gc":"TBD","awarded_to":"","value":1999999,"type":"Industrial","county":"Hampden","state":"MA","town":"Westfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Military Facility","source":"Dodge"},{"project":"F-35 Repair Drop Tank Storage","owner":"","gc":"TBD","awarded_to":"","value":1999999,"type":"Industrial","county":"Hampden","state":"MA","town":"Westfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Military Facility Storage Tank (Other)","source":"Dodge"},{"project":"F-35 ADAL WLT Door B23","owner":"","gc":"TBD","awarded_to":"","value":1999999,"type":"Industrial","county":"Hampden","state":"MA","town":"Westfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Military Facility","source":"Dodge"},{"project":"F-35 - Repair HazMart HVAC B52","owner":"","gc":"TBD","awarded_to":"","value":1999999,"type":"Industrial","county":"Hampden","state":"MA","town":"Westfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Military Facility","source":"Dodge"},{"project":"Liquid Chlorine Supply IQC","owner":"","gc":"TBD","awarded_to":"","value":0,"type":"Commercial","county":"Hampden","state":"MA","town":"Westfield","bid_date":"2026-02-05","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Unclassified","source":"Dodge"},{"project":"Apartment Renovations","owner":"","gc":"TBD","awarded_to":"","value":624999,"type":"Residential","county":"Hampden","state":"MA","town":"Holyoke","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Start | Apartments/Condominiums 4+ Stories","source":"Dodge"},{"project":"Building Automation System Upgrades","owner":"","gc":"TBD","awarded_to":"","value":130000,"type":"Industrial","county":"Hampden","state":"MA","town":"East Longmeadow","bid_date":"2026-02-11","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Office","source":"Dodge"},{"project":"FSB Charles Mccann HS Renovation REBID","owner":"","gc":"TBD","awarded_to":"","value":8803135,"type":"Commercial","county":"Berkshire","state":"MA","town":"North Adams","bid_date":"2026-01-27","award_date":null,"status":"Not Contacted","priority":"High","notes":"Stage: Start | Middle/Senior High School","source":"Dodge"},{"project":"RFP/OPM : Blower Sludge Bldg HVAC & Roof Replacement","owner":"","gc":"TBD","awarded_to":"","value":624999,"type":"Commercial","county":"Hampden","state":"MA","town":"Westfield","bid_date":"2026-02-19","award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Request for Proposals | Sewage Treatment Plant","source":"Dodge"},{"project":"Otis Master Plan Update","owner":"","gc":"TBD","awarded_to":"","value":70000,"type":"Industrial","county":"Berkshire","state":"MA","town":"Otis","bid_date":"2026-02-18","award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Request for Proposals | Office","source":"Dodge"},{"project":"Upland Disposal Facility","owner":"","gc":"TBD","awarded_to":"","value":600000000,"type":"Commercial","county":"Berkshire","state":"MA","town":"Lee","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"High","notes":"Stage: Design Development | Hazardous Waste Disposal Site Development","source":"Dodge"},{"project":"Curtis Fine Paper Mills Site Redevelopment","owner":"","gc":"TBD","awarded_to":"","value":4480000,"type":"Commercial","county":"Berkshire","state":"MA","town":"Adams","bid_date":"2024-07-25","award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Site Development","source":"Dodge"},{"project":"MA/DOT: Rte 116 Intersection Improvements","owner":"","gc":"TBD","awarded_to":"","value":12200000,"type":"Municipal","county":"Hampden","state":"MA","town":"Chicopee","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Planning Schematics | Paving","source":"Dodge"},{"project":"Drop Ceiling Replacement at Old Town Hall","owner":"","gc":"TBD","awarded_to":"","value":349999,"type":"Commercial","county":"Berkshire","state":"MA","town":"Sandisfield","bid_date":"2026-01-30","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Capitol/ Courthouse/City Hall","source":"Dodge"},{"project":"Old Town Hall Lighting Upgrades","owner":"","gc":"TBD","awarded_to":"","value":349999,"type":"Commercial","county":"Berkshire","state":"MA","town":"Sandisfield","bid_date":"2026-01-30","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Capitol/ Courthouse/City Hall","source":"Dodge"},{"project":"MA/DOT: Bridge Replacement","owner":"","gc":"TBD","awarded_to":"","value":4399661,"type":"Municipal","county":"Hampden","state":"MA","town":"Springfield","bid_date":"2024-03-15","award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Bridge","source":"Dodge"},{"project":"FSB Town Offices ADA Ramp Improvements","owner":"","gc":"TBD","awarded_to":"","value":492000,"type":"Commercial","county":"Berkshire","state":"MA","town":"Great Barrington","bid_date":"2026-01-22","award_date":null,"status":"Awarded \u2014 Contact Now","priority":"Low","notes":"Stage: Bid Results | Site Development","source":"Dodge"},{"project":"MA/DOT: Dalton Rd Bridge Replacement","owner":"","gc":"TBD","awarded_to":"","value":8335600,"type":"Municipal","county":"Berkshire","state":"MA","town":"Hinsdale","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Bridge","source":"Dodge"},{"project":"RFQ/AE: School Food Service Projects","owner":"","gc":"TBD","awarded_to":"","value":1999999,"type":"Commercial","county":"Hampden","state":"MA","town":"Springfield","bid_date":"2025-11-26","award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Request for Qualifications | Food/Beverage Service Primary School","source":"Dodge"},{"project":"Neighborhood Traffic Calming Program","owner":"","gc":"TBD","awarded_to":"","value":50000,"type":"Municipal","county":"Hampden","state":"MA","town":"Holyoke","bid_date":"2026-02-24","award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Request for Proposals | Paving","source":"Dodge"},{"project":"26-099 On-Call Window Treatments IQC","owner":"","gc":"TBD","awarded_to":"","value":350000,"type":"Commercial","county":"Hampden","state":"MA","town":"Springfield","bid_date":"2026-02-11","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Miscellaneous Education Building Miscellaneous Recreational","source":"Dodge"},{"project":"Vehicle Fleet Equipment Supply","owner":"","gc":"TBD","awarded_to":"","value":125000,"type":"Commercial","county":"Hampden","state":"MA","town":"Springfield","bid_date":"2026-02-11","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Unclassified","source":"Dodge"},{"project":"Apartments (Conversion from retail)","owner":"","gc":"TBD","awarded_to":"","value":1999999,"type":"Residential","county":"Hampden","state":"MA","town":"Springfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Apartments/Condominiums 1-3 Stories","source":"Dodge"},{"project":"Wendover Road Subdivision","owner":"","gc":"TBD","awarded_to":"","value":25000000,"type":"Residential","county":"Hampden","state":"MA","town":"Springfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Planning Schematics | Sale/Spec Homes","source":"Dodge"},{"project":"Supply and Delivery of Paint Supplies IQC","owner":"","gc":"TBD","awarded_to":"","value":175000,"type":"Commercial","county":"Hampden","state":"MA","town":"Springfield","bid_date":"2026-02-11","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Unclassified","source":"Dodge"},{"project":"2025 Roadway Paving","owner":"","gc":"TBD","awarded_to":"","value":608031,"type":"Municipal","county":"Berkshire","state":"MA","town":"North Adams","bid_date":"2026-02-02","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Paving","source":"Dodge"},{"project":"Southwick Partial Fiber Optic Network Construction","owner":"","gc":"TBD","awarded_to":"","value":4150000,"type":"Commercial","county":"Hampden","state":"MA","town":"Southwick","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Pre-Design | Communication Lines","source":"Dodge"},{"project":"Savoy SF Campground Bathroom Replacement REBID","owner":"","gc":"TBD","awarded_to":"","value":1000000,"type":"Commercial","county":"Berkshire","state":"MA","town":"North Adams","bid_date":"2026-02-12","award_date":null,"status":"Not Contacted","priority":"High","notes":"Stage: GC Bidding | Miscellaneous Recreational","source":"Dodge"},{"project":"MA/DOT: Williamstown Rd Bridge Replacement","owner":"","gc":"TBD","awarded_to":"","value":9455214,"type":"Municipal","county":"Berkshire","state":"MA","town":"Lanesborough","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Paving Bridge","source":"Dodge"},{"project":"Various Locations Window Treatments Services IQC","owner":"","gc":"TBD","awarded_to":"","value":350000,"type":"Industrial","county":"Hampden","state":"MA","town":"Springfield","bid_date":"2026-02-11","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Office Miscellaneous Education Building","source":"Dodge"},{"project":"FSB Bowles Elementary School Roof Replacement","owner":"","gc":"TBD","awarded_to":"","value":1481171,"type":"Commercial","county":"Hampden","state":"MA","town":"Springfield","bid_date":"2025-12-11","award_date":null,"status":"Not Contacted","priority":"High","notes":"Stage: Start | Primary School","source":"Dodge"},{"project":"IFWR On-Call Electrician IQC","owner":"","gc":"TBD","awarded_to":"","value":624999,"type":"Industrial","county":"Hampden","state":"MA","town":"Longmeadow","bid_date":"2026-02-05","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Office","source":"Dodge"},{"project":"On-Call General Contractor Repair and Maintenance IQC","owner":"","gc":"TBD","awarded_to":"","value":1999999,"type":"Industrial","county":"Hampden","state":"MA","town":"East Longmeadow","bid_date":"2026-02-05","award_date":null,"status":"Not Contacted","priority":"High","notes":"Stage: GC Bidding | Office","source":"Dodge"},{"project":"On Call Roofing Repair & Maintanance IQC","owner":"","gc":"TBD","awarded_to":"","value":624999,"type":"Industrial","county":"Hampden","state":"MA","town":"Longmeadow","bid_date":"2026-02-05","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Office","source":"Dodge"},{"project":"MA/DOT: D2 Emergency Traffic Signal Improvements","owner":"","gc":"TBD","awarded_to":"","value":367676,"type":"Municipal","county":"Hampden","state":"MA","town":"Leominster","bid_date":"2026-01-13","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Start | Roadway Lighting","source":"Dodge"},{"project":"West Sheffield Road Realignment REBID","owner":"","gc":"TBD","awarded_to":"","value":541166,"type":"Municipal","county":"Berkshire","state":"MA","town":"Great Barrington","bid_date":"2026-01-08","award_date":null,"status":"Awarded \u2014 Contact Now","priority":"Low","notes":"Stage: Bid Results | Paving","source":"Dodge"},{"project":"Multi-Family Housing Development","owner":"","gc":"TBD","awarded_to":"","value":12499999,"type":"Residential","county":"Hampden","state":"MA","town":"Chicopee","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Planning Schematics | Apartments/Condominiums 1-3 Stories","source":"Dodge"},{"project":"General Contractor IQC","owner":"","gc":"TBD","awarded_to":"","value":49000,"type":"Industrial","county":"Hampden","state":"MA","town":"Longmeadow","bid_date":"2026-02-05","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: GC Bidding | Office","source":"Dodge"},{"project":"Duggan Apartment Security Camera Installation","owner":"","gc":"TBD","awarded_to":"","value":690000,"type":"Residential","county":"Hampden","state":"MA","town":"Indian Orchard","bid_date":"2026-01-21","award_date":null,"status":"Awarded \u2014 Contact Now","priority":"Low","notes":"Stage: Bid Results | Apartments/Condominiums 1-3 Stories","source":"Dodge"},{"project":"RFQ/CM: Willow Street Parking Structure Project","owner":"","gc":"TBD","awarded_to":"","value":25000000,"type":"Commercial","county":"Hampden","state":"MA","town":"Springfield","bid_date":"2026-02-04","award_date":null,"status":"Not Contacted","priority":"High","notes":"Stage: GC Bidding Planning Schematics | Parking Garage","source":"Dodge"},{"project":"Springfield Urban Forest Master Plan","owner":"","gc":"TBD","awarded_to":"","value":75000,"type":"Commercial","county":"Hampden","state":"MA","town":"Springfield","bid_date":"2026-02-10","award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Request for Proposals | Air Pollution Control","source":"Dodge"},{"project":"The Hub Multipurpose Building","owner":"","gc":"TBD","awarded_to":"","value":1824400,"type":"Industrial","county":"Berkshire","state":"MA","town":"Pittsfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Construction | Food/Beverage Service Warehouse Miscellaneous Education Building Social Club Dormitory Animal/Plant/Fish Facility","source":"Dodge"},{"project":"Singing Bridge Residences","owner":"","gc":"TBD","awarded_to":"","value":26640700,"type":"Residential","county":"Hampden","state":"MA","town":"Chicopee","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Construction | Apartments/Condominiums 4+ Stories","source":"Dodge"},{"project":"Agawam Energy Center Battery Storage Facility 250 MW","owner":"","gc":"TBD","awarded_to":"","value":50000000,"type":"Commercial","county":"Hampden","state":"MA","town":"Agawam","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Planning Schematics | Electric Substation","source":"Dodge"},{"project":"Main Street Apartments with Retail Space","owner":"","gc":"TBD","awarded_to":"","value":12499999,"type":"Residential","county":"Hampden","state":"MA","town":"Chicopee","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Planning Schematics | Apartments/Condominiums 4+ Stories Retail (Other)","source":"Dodge"},{"project":"Industrial Building Addition","owner":"","gc":"TBD","awarded_to":"","value":7499999,"type":"Industrial","county":"Hampden","state":"MA","town":"Chicopee","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Warehouse","source":"Dodge"},{"project":"Apartments (Conversion of Memorial School Building)","owner":"","gc":"TBD","awarded_to":"","value":13000000,"type":"Residential","county":"Berkshire","state":"MA","town":"Adams","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Planning Schematics | Apartments/Condominiums 1-3 Stories","source":"Dodge"},{"project":"Bed & Breakfast w/ Public Community Space (Conv from Church)","owner":"","gc":"TBD","awarded_to":"","value":3999999,"type":"Commercial","county":"Berkshire","state":"MA","town":"Adams","bid_date":null,"award_date":null,"status":"Lost","priority":"Low","notes":"Stage: Delayed | Miscellaneous Recreational Hotel/Motel","source":"Dodge"},{"project":"FSB McMahon ES Roof Replacement & Interior Upgrades","owner":"","gc":"TBD","awarded_to":"","value":2584000,"type":"Commercial","county":"Hampden","state":"MA","town":"Holyoke","bid_date":"2026-01-14","award_date":null,"status":"Not Contacted","priority":"High","notes":"Stage: Start | Primary School","source":"Dodge"},{"project":"Cationic Liquid Polyelectrolyte","owner":"","gc":"TBD","awarded_to":"","value":0,"type":"Commercial","county":"Hampden","state":"MA","town":"Agawam","bid_date":"2026-02-04","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Unclassified","source":"Dodge"},{"project":"Brayton Elementary School Renovation","owner":"","gc":"TBD","awarded_to":"","value":52250000,"type":"Municipal","county":"Berkshire","state":"MA","town":"North Adams","bid_date":"2022-06-08","award_date":null,"status":"Lost","priority":"Medium","notes":"Stage: Abandoned | Primary School Paving","source":"Dodge"},{"project":"New Apartment Intercom System Addition","owner":"","gc":"TBD","awarded_to":"","value":109475,"type":"Residential","county":"Berkshire","state":"MA","town":"Adams","bid_date":"2026-01-16","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Start | Apartments/Condominiums 1-3 Stories","source":"Dodge"},{"project":"MA/DOT: I 91 Deck Replacement","owner":"","gc":"TBD","awarded_to":"","value":14870050,"type":"Municipal","county":"Hampden","state":"MA","town":"Westfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Planning Schematics | Bridge","source":"Dodge"},{"project":"FY25 CDBG Housing Rehabilitation REBID","owner":"","gc":"TBD","awarded_to":"","value":1999999,"type":"Residential","county":"Berkshire","state":"MA","town":"Lenox","bid_date":"2026-02-11","award_date":null,"status":"Not Contacted","priority":"High","notes":"Stage: GC Bidding | Custom Homes","source":"Dodge"},{"project":"610 North Street Urology Alterations","owner":"","gc":"TBD","awarded_to":"","value":7499999,"type":"Commercial","county":"Berkshire","state":"MA","town":"Pittsfield","bid_date":"2026-01-23","award_date":null,"status":"Not Contacted","priority":"High","notes":"Stage: GC Bidding-Invitation | Hospital","source":"Dodge"},{"project":"MA/DOT: Route 9 (Elm Street - Lyman Street) Reconstruction","owner":"","gc":"TBD","awarded_to":"","value":7630000,"type":"Municipal","county":"Berkshire","state":"MA","town":"Pittsfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Paving Sidewalk/Parking Lot Landscaping","source":"Dodge"},{"project":"Hydraulic Structures Maintenance & Repairs IQC","owner":"","gc":"TBD","awarded_to":"","value":350000,"type":"Municipal","county":"Hampden","state":"MA","town":"Holyoke","bid_date":"2025-11-06","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Start | Flood Control","source":"Dodge"},{"project":"Environmental Monitoring Services IQC","owner":"","gc":"TBD","awarded_to":"","value":400000,"type":"Commercial","county":"Hampden","state":"MA","town":"Springfield","bid_date":"2026-02-11","award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Request for Proposals | Air Pollution Control","source":"Dodge"},{"project":"RFP/DEV: Courthouse Office Space Development","owner":"","gc":"TBD","awarded_to":"","value":50000000,"type":"Industrial","county":"Hampden","state":"MA","town":"Springfield","bid_date":"2025-10-16","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Request for Proposals | Office Capitol/ Courthouse/City Hall","source":"Dodge"},{"project":"Moore Street & Valley Street Improvements","owner":"","gc":"TBD","awarded_to":"","value":58800,"type":"Municipal","county":"Hampden","state":"MA","town":"Agawam","bid_date":"2025-03-18","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Paving Storm Sewer Water Line","source":"Dodge"},{"project":"FY25 CDBG Housing Rehabilitation Services IQC","owner":"","gc":"TBD","awarded_to":"","value":1999999,"type":"Residential","county":"Berkshire","state":"MA","town":"Lenox","bid_date":"2026-02-11","award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Request for Proposals | Custom Homes Apartments/Condominiums 1-3 Stories","source":"Dodge"},{"project":"Installation of Reflectorized Pavement Markings","owner":"","gc":"TBD","awarded_to":"","value":1500000,"type":"Municipal","county":"Hampden","state":"MA","town":"Boston","bid_date":"2026-02-19","award_date":null,"status":"Not Contacted","priority":"High","notes":"Stage: Bidding | Paving","source":"Dodge"},{"project":"Taxiway B Mitigation Area Upgrades","owner":"","gc":"TBD","awarded_to":"","value":506540,"type":"Commercial","county":"Hampden","state":"MA","town":"Westfield","bid_date":"2025-04-16","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Start | Runway/Taxiway","source":"Dodge"},{"project":"House Rehabilitation","owner":"","gc":"TBD","awarded_to":"","value":47500,"type":"Residential","county":"Hampden","state":"MA","town":"Agawam","bid_date":"2025-12-19","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Start | Custom Homes","source":"Dodge"},{"project":"Mason Square Library Automated Logic Controls","owner":"","gc":"TBD","awarded_to":"","value":89295,"type":"Commercial","county":"Hampden","state":"MA","town":"Springfield","bid_date":"2025-12-05","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Start | Library","source":"Dodge"},{"project":"Grant Program Heating Repair and Replacement","owner":"","gc":"TBD","awarded_to":"","value":624999,"type":"Industrial","county":"Hampden","state":"MA","town":"Westfield","bid_date":"2025-12-17","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Start | Office","source":"Dodge"},{"project":"MA/DOT: Williamstown- Route 7 Pavement Resurfacing","owner":"","gc":"TBD","awarded_to":"","value":2071468,"type":"Municipal","county":"Berkshire","state":"MA","town":"Williamstown","bid_date":"2025-12-16","award_date":null,"status":"Not Contacted","priority":"High","notes":"Stage: Start | Paving","source":"Dodge"},{"project":"West Springfield Water Supply Maintenance REBID IQC","owner":"","gc":"TBD","awarded_to":"","value":105393,"type":"Municipal","county":"Hampden","state":"MA","town":"Westfield","bid_date":"2025-12-12","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Start | Water Treatment Plant","source":"Dodge"},{"project":"MA/DOT: I-91 Bridge Preservation","owner":"","gc":"TBD","awarded_to":"","value":8620429,"type":"Municipal","county":"Hampden","state":"MA","town":"Chicopee","bid_date":"2025-12-16","award_date":null,"status":"Not Contacted","priority":"High","notes":"Stage: Start | Bridge","source":"Dodge"},{"project":"Welcome Center","owner":"","gc":"TBD","awarded_to":"","value":1999999,"type":"Commercial","county":"Berkshire","state":"MA","town":"Lanesborough","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Miscellaneous Recreational","source":"Dodge"},{"project":"New Leaf Energy Battery Storage Facility (BESS) Agawam MA","owner":"","gc":"TBD","awarded_to":"","value":1999999,"type":"Commercial","county":"Hampden","state":"MA","town":"Agawam","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Electric Substation","source":"Dodge"},{"project":"Commercial Building Alteration","owner":"","gc":"TBD","awarded_to":"","value":8110000,"type":"Industrial","county":"Hampden","state":"MA","town":"Westfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"High","notes":"Stage: Start | Office","source":"Dodge"},{"project":"Commercial Building Alteration","owner":"","gc":"TBD","awarded_to":"","value":805000,"type":"Industrial","county":"Hampden","state":"MA","town":"Westfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Start | Office","source":"Dodge"},{"project":"Commercial Building Alteration","owner":"","gc":"TBD","awarded_to":"","value":79510,"type":"Industrial","county":"Hampden","state":"MA","town":"Westfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Start | Office","source":"Dodge"},{"project":"Blacktop Resurfacing and Appurtenant","owner":"","gc":"TBD","awarded_to":"","value":608031,"type":"Municipal","county":"Berkshire","state":"MA","town":"North Adams","bid_date":"2026-01-21","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Paving","source":"Dodge"},{"project":"Harriman & West Airport New Hangar","owner":"","gc":"TBD","awarded_to":"","value":3999999,"type":"Commercial","county":"Berkshire","state":"MA","town":"North Adams","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Pre-Design | Aircraft Sales/Service","source":"Dodge"},{"project":"New School Administration Building","owner":"","gc":"TBD","awarded_to":"","value":2360000,"type":"Industrial","county":"Hampden","state":"MA","town":"Chicopee","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Pre-Design | Office Miscellaneous Education Building","source":"Dodge"},{"project":"Silverbrook & Town Hall Parking Lot and Paving Imprts","owner":"","gc":"TBD","awarded_to":"","value":340000,"type":"Municipal","county":"Berkshire","state":"MA","town":"Sandisfield","bid_date":"2026-02-02","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Paving Sidewalk/Parking Lot","source":"Dodge"},{"project":"Westfield CAPV Head Start Childcare Center","owner":"","gc":"TBD","awarded_to":"","value":10000000,"type":"Commercial","county":"Hampden","state":"MA","town":"Westfield","bid_date":"2025-06-04","award_date":null,"status":"Not Contacted","priority":"High","notes":"Stage: Start | Miscellaneous Education Building Pre-School","source":"Dodge"},{"project":"N Whitman Road Culvert Replacement","owner":"","gc":"TBD","awarded_to":"","value":1999999,"type":"Municipal","county":"Berkshire","state":"MA","town":"Hancock","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Storm Sewer","source":"Dodge"},{"project":"Under Canvas Glamping Facility (Lanesborough MA)","owner":"","gc":"TBD","awarded_to":"","value":1999999,"type":"Commercial","county":"Berkshire","state":"MA","town":"Lanesborough","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Supermarket/Convenience Store Miscellaneous Recreational Park/Playground","source":"Dodge"},{"project":"MA/DOT: Cheshire Pavement Preservation","owner":"","gc":"TBD","awarded_to":"","value":13871813,"type":"Municipal","county":"Berkshire","state":"MA","town":"Adams","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Planning Schematics | Paving","source":"Dodge"},{"project":"Highway Building Structural & Accessibility Improvements","owner":"","gc":"TBD","awarded_to":"","value":119905,"type":"Commercial","county":"Berkshire","state":"MA","town":"Pittsfield","bid_date":"2025-12-11","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Start | Capitol/ Courthouse/City Hall Communication Building","source":"Dodge"},{"project":"MA/DOT: Route 10 and 202 Road Reconstruction","owner":"","gc":"TBD","awarded_to":"","value":20800150,"type":"Municipal","county":"Hampden","state":"MA","town":"Westfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Planning Schematics | Paving Bridge","source":"Dodge"},{"project":"MA/DOT: RT 183 Park St Reconstruction","owner":"","gc":"TBD","awarded_to":"","value":28038775,"type":"Municipal","county":"Berkshire","state":"MA","town":"Great Barrington","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Planning Schematics | Passenger Terminal (Other) Paving Sidewalk/Parking Lot Highway Signs/Guardrails","source":"Dodge"},{"project":"Hungry Hill Veterans Memorial Park Development","owner":"","gc":"TBD","awarded_to":"","value":245000,"type":"Commercial","county":"Hampden","state":"MA","town":"Springfield","bid_date":"2025-11-12","award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Park/Playground","source":"Dodge"},{"project":"MA/DOT: I-91 Roadway Lighting Replacement","owner":"","gc":"TBD","awarded_to":"","value":21621134,"type":"Municipal","county":"Hampden","state":"MA","town":"Chicopee","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Planning Schematics | Roadway Lighting Communication Lines Highway Signs/Guardrails","source":"Dodge"},{"project":"Hibbett School Redevelopment","owner":"","gc":"TBD","awarded_to":"","value":3999999,"type":"Residential","county":"Berkshire","state":"MA","town":"Pittsfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Pre-Design | Sale/Spec Homes","source":"Dodge"},{"project":"St. Joseph Central High School Redevelopment","owner":"","gc":"TBD","awarded_to":"","value":3999999,"type":"Residential","county":"Berkshire","state":"MA","town":"Pittsfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Pre-Design | Sale/Spec Homes Miscellaneous Education Building","source":"Dodge"},{"project":"New Monument Mountain Regional High School","owner":"","gc":"TBD","awarded_to":"","value":152067064,"type":"Municipal","county":"Berkshire","state":"MA","town":"Great Barrington","bid_date":"2023-12-06","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Planning Schematics | Middle/Senior High School Miscellaneous Education Building Sidewalk/Parking Lot Site Development","source":"Dodge"},{"project":"MA/DOT: Bridge Replacement","owner":"","gc":"TBD","awarded_to":"","value":49007423,"type":"Municipal","county":"Hampden","state":"MA","town":"Russell","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Planning Schematics | Bridge","source":"Dodge"},{"project":"RFP/AE: Park Avenue & Front and Kelley Street Improvement","owner":"","gc":"TBD","awarded_to":"","value":538000,"type":"Municipal","county":"Hampden","state":"MA","town":"Palmer","bid_date":"2026-01-22","award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Request for Proposals | Paving Sidewalk/Parking Lot","source":"Dodge"},{"project":"Vacant Unit Turnover","owner":"","gc":"TBD","awarded_to":"","value":896600,"type":"Residential","county":"Berkshire","state":"MA","town":"Pittsfield","bid_date":"2026-01-07","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Start | Apartments/Condominiums 1-3 Stories","source":"Dodge"},{"project":"Project Legacy Affordable Housing Development","owner":"","gc":"TBD","awarded_to":"","value":4800000,"type":"Residential","county":"Berkshire","state":"MA","town":"Pittsfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Apartments/Condominiums 1-3 Stories","source":"Dodge"},{"project":"Willow/Cross Street Bridge Design","owner":"","gc":"TBD","awarded_to":"","value":24000000,"type":"Commercial","county":"Hampden","state":"MA","town":"Springfield","bid_date":"2025-08-11","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Planning Schematics | Parking Garage","source":"Dodge"},{"project":"MA/DOT: Route 5 Bridge Preservation","owner":"","gc":"TBD","awarded_to":"","value":62186012,"type":"Municipal","county":"Hampden","state":"MA","town":"Agawam","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Planning Schematics | Bridge","source":"Dodge"},{"project":"MA/DOT: D2 Highway Lighting Improvements","owner":"","gc":"TBD","awarded_to":"","value":492650,"type":"Municipal","county":"Hampden","state":"MA","town":"Springfield","bid_date":"2025-12-16","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Start | Roadway Lighting","source":"Dodge"},{"project":"Interior and Exterior Painting","owner":"","gc":"TBD","awarded_to":"","value":95000,"type":"Commercial","county":"Hampden","state":"MA","town":"Longmeadow","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Construction Documents | Primary School","source":"Dodge"},{"project":"RFQ/CM: South Holyoke Homes Phase 3","owner":"","gc":"TBD","awarded_to":"","value":7499999,"type":"Residential","county":"Hampden","state":"MA","town":"Holyoke","bid_date":"2026-01-30","award_date":null,"status":"Not Contacted","priority":"High","notes":"Stage: GC Bidding Planning Schematics | Apartments/Condominiums 4+ Stories","source":"Dodge"},{"project":"Mixed-Use Building (Wright Building Redevelopment)","owner":"","gc":"TBD","awarded_to":"","value":17800000,"type":"Residential","county":"Berkshire","state":"MA","town":"Pittsfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Construction | Apartments/Condominiums 1-3 Stories Retail (Other)","source":"Dodge"},{"project":"MA/DOT: North Adams - Route 2 Bridge Preservation","owner":"","gc":"TBD","awarded_to":"","value":40095720,"type":"Municipal","county":"Berkshire","state":"MA","town":"North Adams","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Planning Schematics | Bridge","source":"Dodge"},{"project":"The Village at Sawmill Brook Mixed-Use Development","owner":"","gc":"TBD","awarded_to":"","value":50000000,"type":"Residential","county":"Hampden","state":"MA","town":"Monson","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Planning Schematics | Sale/Spec Homes Apartments/Condominiums 1-3 Stories Apartments/Condominiums 4+ Stories Office Food/Beverage Service Retail (Other) Warehouse Manufacturing Building","source":"Dodge"},{"project":"MA/DOT: Holyoke - Beech Street Intersection Improvements","owner":"","gc":"TBD","awarded_to":"","value":7070000,"type":"Municipal","county":"Hampden","state":"MA","town":"Holyoke","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Paving Park/Playground","source":"Dodge"},{"project":"MA/DOT: Pedestrian Curb Ramps Reconstruction","owner":"","gc":"TBD","awarded_to":"","value":624999,"type":"Municipal","county":"Berkshire","state":"MA","town":"Richmond","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Sidewalk/Parking Lot","source":"Dodge"},{"project":"Springfield Community College - B20 Facade Repairs","owner":"","gc":"TBD","awarded_to":"","value":31158,"type":"Commercial","county":"Hampden","state":"MA","town":"Springfield","bid_date":"2025-12-03","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Start | College/University","source":"Dodge"},{"project":"2025 Westfield Pedestrian Sidewalk Replacement","owner":"","gc":"TBD","awarded_to":"","value":49999,"type":"Municipal","county":"Hampden","state":"MA","town":"Westfield","bid_date":"2025-12-03","award_date":null,"status":"Awarded \u2014 Contact Now","priority":"Low","notes":"Stage: Bid Results | Sidewalk/Parking Lot","source":"Dodge"},{"project":"WMH Building Management System Maintenance","owner":"","gc":"TBD","awarded_to":"","value":34200,"type":"Commercial","county":"Hampden","state":"MA","town":"Westfield","bid_date":"2025-12-02","award_date":null,"status":"Awarded \u2014 Contact Now","priority":"Low","notes":"Stage: Bid Results | Hospital","source":"Dodge"},{"project":"2026 WW Pump Stations Instrumentation & Communication IQC","owner":"","gc":"TBD","awarded_to":"","value":75000,"type":"Commercial","county":"Hampden","state":"MA","town":"Wilbraham","bid_date":"2026-01-29","award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Bidding | Sewage Treatment Plant","source":"Dodge"},{"project":"FSB Vacant Unit Turnover Rose Manor","owner":"","gc":"TBD","awarded_to":"","value":813145,"type":"Residential","county":"Berkshire","state":"MA","town":"Pittsfield","bid_date":"2026-01-07","award_date":null,"status":"Awarded \u2014 Contact Now","priority":"Medium","notes":"Stage: Bidding Bid Results | Apartments/Condominiums 1-3 Stories Apartments/Condominiums 4+ Stories Elderly/Assisted Living","source":"Dodge"},{"project":"Falcon Landing Warehouse/Distribution Building","owner":"","gc":"TBD","awarded_to":"","value":58728921,"type":"Industrial","county":"Hampden","state":"MA","town":"Westfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Planning Schematics | Warehouse","source":"Dodge"},{"project":"FSB New North Barbara Rivera Community Center Phase 2","owner":"","gc":"TBD","awarded_to":"","value":1425000,"type":"Commercial","county":"Hampden","state":"MA","town":"Springfield","bid_date":null,"award_date":null,"status":"Lost","priority":"Low","notes":"Stage: Abandoned | Miscellaneous Education Building Miscellaneous Recreational","source":"Dodge"},{"project":"Solar Array","owner":"","gc":"TBD","awarded_to":"","value":3999999,"type":"Industrial","county":"Hampden","state":"MA","town":"Springfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Planning Schematics | Power Plant (Other)","source":"Dodge"},{"project":"Chase Bank & Multi-Tenant at Springfield Crossing BLDG# 7","owner":"","gc":"TBD","awarded_to":"","value":3999999,"type":"Industrial","county":"Hampden","state":"MA","town":"Springfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Low","notes":"Stage: Construction | Bank Food/Beverage Service Retail (Other)","source":"Dodge"},{"project":"Baystate Community Health & Wellness Center Springfield","owner":"","gc":"TBD","awarded_to":"","value":65000000,"type":"Commercial","county":"Hampden","state":"MA","town":"Springfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"High","notes":"Stage: Construction Documents | Clinic/Medical Office","source":"Dodge"},{"project":"Apartment Complex","owner":"","gc":"TBD","awarded_to":"","value":41000000,"type":"Residential","county":"Berkshire","state":"MA","town":"Lenox","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"Medium","notes":"Stage: Planning Schematics | Apartments/Condominiums 1-3 Stories Apartments/Condominiums 4+ Stories","source":"Dodge"},{"project":"Advanced Manufacturing for Advanced Optics Tech Hub Addition","owner":"","gc":"TBD","awarded_to":"","value":6200000,"type":"Industrial","county":"Berkshire","state":"MA","town":"Pittsfield","bid_date":null,"award_date":null,"status":"Not Contacted","priority":"High","notes":"Stage: Construction Documents | Office Warehouse Manufacturing Building Miscellaneous Education Building","source":"Dodge"}];

// ── Constants ────────────────────────────────────────────────────────────────
const STATUS_OPTIONS   = ["Not Contacted","In Progress","Quoted","Awarded — Contact Now","Won","Lost"];
const PRIORITY_OPTIONS = ["High","Medium","Low"];
const TYPE_OPTIONS     = ["Commercial","Municipal","Residential","Industrial"];
const SOURCE_OPTIONS   = ["Dodge","eSEARCH","CT DOT","LinkedIn","Google Maps","Chamber of Commerce","Referral","Other"];
const COUNTY_OPTIONS   = ["Litchfield","New Haven","Fairfield","Hartford","Tolland","Berkshire","Hampden","Hampshire","Other"];
const TOWN_OPTIONS = [
  "Barkhamsted","Bethlehem","Bridgewater","Canaan","Colebrook","Cornwall","Goshen","Hartland",
  "Harwinton","Kent","Litchfield","Morris","New Hartford","New Milford","Norfolk","North Canaan",
  "Plymouth","Roxbury","Salisbury","Sharon","Thomaston","Torrington","Warren","Washington",
  "Watertown","Winchester (Winsted)","Woodbury","Danbury","Waterbury","Naugatuck","Ansonia","Shelton",
  "Bloomfield","Bristol","Burlington","Canton","Avon","Simsbury","Granby","Hartford","New Britain",
  "Newington","Plainville","Southington","Wolcott","Hamden","Wallingford","Middletown",
  "Pittsfield","Great Barrington","Lenox","Stockbridge","Lee","North Adams","Adams","Dalton",
  "Williamstown","Clarksburg","Sheffield","Savoy","Lanesborough","Hancock","Richmond","Mill River","Cheshire",
  "Springfield","Chicopee","Holyoke","Westfield","Agawam","West Springfield","Longmeadow",
  "East Longmeadow","Ludlow","Wilbraham","Palmer","Hampden","Blandford","Southwick","Monson",
  "Chester","Russell","Indian Orchard","Other",
];

const QUADRANT_OPTIONS = ["Litchfield County CT","Berkshire County MA","Hampden County MA","Hartford County CT","New Haven County CT","Fairfield County CT"];
const QUADRANT_COLORS = {
  "Litchfield County CT": { bg:"#0d1f2d", border:"#1a5c8a", text:"#4aa8e8",  short:"LITCHFIELD CT" },
  "Berkshire County MA":  { bg:"#1a1a0a", border:"#6b5c1a", text:"#e8c84a",  short:"BERKSHIRE MA"  },
  "Hampden County MA":    { bg:"#1a0d1a", border:"#6b1a6b", text:"#e04ae0",  short:"HAMPDEN MA"    },
  "Hartford County CT":   { bg:"#0a1a0a", border:"#1a6b2a", text:"#4ae868",  short:"HARTFORD CT"   },
  "New Haven County CT":  { bg:"#1a160a", border:"#8a6b1a", text:"#e8b84a",  short:"NEW HAVEN CT"  },
  "Fairfield County CT":  { bg:"#1a0d0d", border:"#8a2a1a", text:"#e86b4a",  short:"FAIRFIELD CT"  },
};
function getQuadrant(bid) {
  const c = bid.county, s = bid.state || "CT";
  if (s==="MA" && c==="Berkshire") return "Berkshire County MA";
  if (s==="MA" && c==="Hampden")   return "Hampden County MA";
  if (c==="Litchfield") return "Litchfield County CT";
  if (c==="Hartford")   return "Hartford County CT";
  if (c==="New Haven")  return "New Haven County CT";
  if (c==="Fairfield")  return "Fairfield County CT";
  return "Litchfield County CT";
}

const DAY_ROUTES = {
  "Monday":    { label:"MON", fullLabel:"Monday",    subtitle:"S. Litchfield + Waterbury",     color:"#4a9eff", bg:"#091929", border:"#1a4a7a",
    towns:["Danbury","Sherman","New Milford","Bridgewater","Roxbury","Washington","Warren","Kent","Morris","Bethlehem","Woodbury","Thomaston","Plymouth","Waterbury","Watertown","Naugatuck","Ansonia","Shelton","Hamden","Wallingford","Middletown"] },
  "Tuesday":   { label:"TUE", fullLabel:"Tuesday",   subtitle:"Berkshires AM · Springfield PM", color:"#b04ae8", bg:"#120d1e", border:"#4a1a6b",
    towns:["Pittsfield","Lanesborough","Cheshire","Adams","North Adams","Williamstown","Clarksburg","New Ashford","Dalton","Hinsdale","Windsor","Hancock","Lenox","Lee","Stockbridge","Great Barrington","Sheffield","Egremont","Alford","West Stockbridge","New Marlborough","Sandisfield","Otis","Tyringham","Becket","Monterey","Mount Washington","Mill River","Richmond","Savoy","Florida","Berkshire","Springfield","Chicopee","Holyoke","Westfield","Agawam","West Springfield","Longmeadow","East Longmeadow","Ludlow","Wilbraham","Palmer","Hampden","Blandford","Southwick","Monson","Chester","Russell","Granville","Brimfield","Holland","Wales","Tolland","Indian Orchard"] },
  "Wednesday": { label:"WED", fullLabel:"Wednesday", subtitle:"W. + N. Litchfield Loop",        color:"#4ae8a0", bg:"#091a12", border:"#1a6b40",
    towns:["Sharon","Canaan","North Canaan","Norfolk","Colebrook","Hartland","Barkhamsted","Winchester (Winsted)","Winsted","Winchester","Winchestr Ctr","Torrington","Goshen","Cornwall","New Hartford","Harwinton","Litchfield","Salisbury"] },
  "Thursday":  { label:"THU", fullLabel:"Thursday",  subtitle:"Hartford + 84 Corridor",         color:"#e8c84a", bg:"#1a1a1a", border:"#6b5200",
    towns:["Thomaston","Plymouth","Bristol","New Britain","Plainville","Southington","Wolcott","Bloomfield","Hartford","Newington","West Hartford","Farmington","Canton","Simsbury","Avon","Granby","Burlington"] },
};
function getDay(bid) {
  const t = bid.town || "";
  for (const [day, r] of Object.entries(DAY_ROUTES)) { if (r.towns.includes(t)) return day; }
  if ((bid.state||"CT")==="MA") return "Tuesday";
  if (["Hartford","New Haven","Fairfield"].includes(bid.county||"")) return "Thursday";
  return "Wednesday";
}

const STATUS_COLORS = {
  "Not Contacted":         { bg:"#222222", border:"#2a2a2a",    text:"#8888aa" },
  "In Progress":           { bg:"#1a2a1a", border:"#2d4a2d", text:"#7aaa7a" },
  "Quoted":                { bg:"#1a1e2e", border:"#2d3566", text:"#7a88cc" },
  "Awarded — Contact Now": { bg:"#2a1800", border:"#cc6600", text:"#ffaa00" },
  "Won":                   { bg:"#0f2a1a", border:"#1a5c35", text:"#4dcc88" },
  "Lost":                  { bg:"#2a1a1a", border:"#5c2a2a", text:"#cc6666" },
};
const PRIORITY_COLORS = { High:"#e8e8e8", Medium:"#e8a21c", Low:"#5a8a6a" };

function fmt$(v) { if(!v) return "—"; if(v>=1000000) return `$${(v/1000000).toFixed(1)}M`; return `$${(v/1000).toFixed(0)}K`; }
function daysUntil(d) { if(!d) return null; return Math.ceil((new Date(d)-new Date())/86400000); }
function fmtDate(d) { if(!d) return "—"; return new Date(d).toLocaleDateString("en-US",{month:"short",day:"numeric"}); }

function parseDodgeCSV(text) {
  const lines = text.trim().split("\n"); if(lines.length<2) return [];
  const headers = lines[0].split(",").map(h=>h.replace(/"/g,"").trim().toLowerCase());
  const get = (row,...keys) => { for(const k of keys){ const i=headers.findIndex(h=>h.includes(k)); if(i!==-1&&row[i]) return row[i].replace(/"/g,"").trim(); } return ""; };
  return lines.slice(1).map((line,idx)=>{
    const row=[]; let cur="",inQ=false;
    for(const ch of line){ if(ch==='"') inQ=!inQ; else if(ch===","&&!inQ){row.push(cur);cur="";} else cur+=ch; } row.push(cur);
    const valRaw=get(row,"value","amount","cost","low","high").replace(/[$,]/g,"");
    return { project:get(row,"title","project","name")||"Imported", owner:get(row,"owner","client"), gc:get(row,"contractor","gc","general")||"TBD",
      awardedTo:get(row,"award","winner"), value:parseFloat(valRaw)||0, type:"Commercial",
      county:get(row,"county")||"Litchfield", state:get(row,"state")||"CT", town:get(row,"city","town","location")||"Other",
      bidDate:get(row,"bid date","biddate","due"), awardDate:get(row,"award date","awarddate"),
      status:"Not Contacted", priority:"Medium", notes:get(row,"notes","description","action stage"), source:"Dodge" };
  }).filter(b=>b.project);
}

// ── Bid Modal ────────────────────────────────────────────────────────────────
function BidModal({ bid, onClose, onSave, saving }) {
  const [form, setForm] = useState(bid || { project:"",owner:"",gc:"",awardedTo:"",value:"",type:"Commercial",county:"Litchfield",state:"CT",town:"Torrington",bidDate:"",awardDate:"",status:"Not Contacted",priority:"Medium",notes:"",source:"Dodge" });
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const isAwd=form.status==="Awarded — Contact Now";
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{background:"#0e0e18",border:`1px solid ${isAwd?"#cc6600":"#333333"}`,borderRadius:12,width:"100%",maxWidth:700,maxHeight:"92vh",overflowY:"auto",padding:32,position:"relative",boxShadow:isAwd?"0 0 40px rgba(204,102,0,0.2)":"none"}}>
        <button onClick={onClose} style={{position:"absolute",top:16,right:20,background:"none",border:"none",color:"#666",fontSize:22,cursor:"pointer"}}>×</button>
        {isAwd&&<div style={{background:"#1a0d00",border:"1px solid #cc6600",borderRadius:8,padding:"12px 16px",marginBottom:20,display:"flex",alignItems:"center",gap:10}}><span style={{fontSize:18}}>🏆</span><div><div style={{color:"#ffaa00",fontWeight:700,fontSize:13}}>BID AWARDED — CONTACT NOW</div><div style={{color:"#aa7700",fontSize:12}}>Log the winning contractor and reach out immediately.</div></div></div>}
        <h2 style={{color:"#F5F5F5",fontFamily:"'Bebas Neue',sans-serif",fontSize:26,marginBottom:24,letterSpacing:1}}>{bid?"EDIT PROJECT":"ADD NEW PROJECT"}</h2>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
          {[["Project Name","project","text","full"],["Property Owner","owner","text"],["General Contractor","gc","text"],["Est. Project Value ($)","value","number"],["Bid Date","bidDate","date"],["Award Date","awardDate","date"]].map(([label,key,type,span])=>(
            <div key={key} style={{gridColumn:span==="full"?"1 / -1":undefined}}>
              <label style={{color:"#888",fontSize:11,letterSpacing:1,display:"block",marginBottom:6,fontFamily:"monospace"}}>{label.toUpperCase()}</label>
              <input type={type} value={form[key]||""} onChange={e=>set(key,e.target.value)} style={{width:"100%",background:"#1a1a1a",border:"1px solid #2a2a44",borderRadius:6,color:"#F5F5F5",padding:"10px 12px",fontSize:14,outline:"none",boxSizing:"border-box"}}/>
            </div>
          ))}
          <div style={{gridColumn:"1 / -1"}}>
            <label style={{color:isAwd?"#ffaa00":"#888",fontSize:11,letterSpacing:1,display:"block",marginBottom:6,fontFamily:"monospace"}}>AWARDED TO (WINNING CONTRACTOR) {isAwd&&"⚡"}</label>
            <input type="text" value={form.awardedTo||""} onChange={e=>set("awardedTo",e.target.value)} placeholder={isAwd?"Enter winning GC name...":""} style={{width:"100%",background:isAwd?"#1a0d00":"#1a1a1a",border:`1px solid ${isAwd?"#cc6600":"#333333"}`,borderRadius:6,color:isAwd?"#ffcc44":"#F5F5F5",padding:"10px 12px",fontSize:14,outline:"none",boxSizing:"border-box"}}/>
          </div>
          {[["Town","town",TOWN_OPTIONS],["Project Type","type",TYPE_OPTIONS],["County","county",COUNTY_OPTIONS],["Status","status",STATUS_OPTIONS],["Priority","priority",PRIORITY_OPTIONS],["Lead Source","source",SOURCE_OPTIONS]].map(([label,key,opts])=>(
            <div key={key}>
              <label style={{color:"#888",fontSize:11,letterSpacing:1,display:"block",marginBottom:6,fontFamily:"monospace"}}>{label.toUpperCase()}</label>
              <select value={form[key]} onChange={e=>set(key,e.target.value)} style={{width:"100%",background:"#1a1a1a",border:"1px solid #2a2a44",borderRadius:6,color:"#F5F5F5",padding:"10px 12px",fontSize:14,outline:"none"}}>
                {opts.map(o=><option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          ))}
          <div style={{gridColumn:"1 / -1"}}>
            <label style={{color:"#888",fontSize:11,letterSpacing:1,display:"block",marginBottom:6,fontFamily:"monospace"}}>NOTES</label>
            <textarea value={form.notes} onChange={e=>set("notes",e.target.value)} rows={3} style={{width:"100%",background:"#1a1a1a",border:"1px solid #2a2a44",borderRadius:6,color:"#F5F5F5",padding:"10px 12px",fontSize:14,outline:"none",resize:"vertical",boxSizing:"border-box",fontFamily:"inherit"}}/>
          </div>
        </div>
        <div style={{display:"flex",gap:12,marginTop:24,justifyContent:"flex-end"}}>
          <button onClick={onClose} style={{padding:"10px 24px",background:"none",border:"1px solid #333",borderRadius:6,color:"#888",cursor:"pointer",fontSize:14}}>Cancel</button>
          <button onClick={()=>onSave({...form,value:Number(form.value),id:form.id})} disabled={saving} style={{padding:"10px 28px",background:isAwd?"#cc6600":"#e8e8e8",border:"none",borderRadius:6,color:"#0a0a0a",cursor:saving?"wait":"pointer",fontSize:14,fontWeight:700,opacity:saving?0.7:1}}>
            {saving?"Saving...":"Save Project"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Import Modal ─────────────────────────────────────────────────────────────
function ImportModal({ onClose, onImport, importing }) {
  const [text,setText]=useState(""); const [preview,setPreview]=useState([]); const fileRef=useRef();
  const handleFile=e=>{ const f=e.target.files[0]; if(!f) return; const r=new FileReader(); r.onload=ev=>{setText(ev.target.result);setPreview(parseDodgeCSV(ev.target.result));}; r.readAsText(f); };
  const handlePaste=v=>{setText(v);setPreview(parseDodgeCSV(v));};
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{background:"#0e0e18",border:"1px solid #2a2a44",borderRadius:12,width:"100%",maxWidth:740,maxHeight:"90vh",overflowY:"auto",padding:32,position:"relative"}}>
        <button onClick={onClose} style={{position:"absolute",top:16,right:20,background:"none",border:"none",color:"#666",fontSize:22,cursor:"pointer"}}>×</button>
        <h2 style={{color:"#F5F5F5",fontFamily:"'Bebas Neue',sans-serif",fontSize:26,marginBottom:6,letterSpacing:1}}>IMPORT DATA</h2>
        <p style={{color:"#888",fontSize:11,marginBottom:4,fontFamily:"monospace",letterSpacing:1}}>(Company, Address, Project Data)</p>
        <p style={{color:"#555",fontSize:13,marginBottom:20}}>Import a CSV from any source — Dodge, eSEARCH, spreadsheets, or your own data. Projects save directly to your live database.</p>
        <div style={{background:"#0f0f0f",border:"1px solid #1e1e38",borderRadius:8,padding:16,marginBottom:20,fontSize:12,color:"#555",fontFamily:"monospace",lineHeight:1.8}}>
          1. Go to <span style={{color:"#7a88cc"}}>construction.com</span> → Search Projects<br/>
          2. Filter: State = CT or MA, your counties, Stage = Bidding + Awarded<br/>
          3. Click <strong style={{color:"#F5F5F5"}}>Export → Download CSV</strong><br/>
          4. Upload below
        </div>
        <button onClick={()=>fileRef.current.click()} style={{background:"#1a1a1a",border:"1px solid #2a2a44",borderRadius:6,color:"#F5F5F5",padding:"10px 20px",cursor:"pointer",fontSize:13,marginBottom:16}}>📂 Upload File</button>
        <input ref={fileRef} type="file" accept=".csv,.txt" style={{display:"none"}} onChange={handleFile}/>
        <div>
          <label style={{color:"#888",fontSize:11,letterSpacing:1,display:"block",marginBottom:6,fontFamily:"monospace"}}>OR PASTE CSV TEXT</label>
          <textarea value={text} onChange={e=>handlePaste(e.target.value)} rows={5} style={{width:"100%",background:"#1a1a1a",border:"1px solid #2a2a44",borderRadius:6,color:"#F5F5F5",padding:"10px 12px",fontSize:12,outline:"none",resize:"vertical",boxSizing:"border-box",fontFamily:"monospace"}}/>
        </div>
        {preview.length>0&&<div style={{marginTop:20}}><div style={{color:"#5a8a6a",fontSize:12,marginBottom:10,fontFamily:"monospace"}}>✓ {preview.length} PROJECTS DETECTED</div><div style={{maxHeight:180,overflowY:"auto",border:"1px solid #1e1e38",borderRadius:6}}>{preview.slice(0,6).map((b,i)=>(<div key={i} style={{display:"grid",gridTemplateColumns:"3fr 1fr 1fr",gap:12,padding:"9px 14px",borderBottom:"1px solid #141420",fontSize:12}}><div style={{color:"#F5F5F5"}}>{b.project}</div><div style={{color:"#888"}}>{b.town}</div><div style={{color:"#e8e8e8",fontFamily:"monospace"}}>{fmt$(b.value)}</div></div>))}{preview.length>6&&<div style={{padding:"9px 14px",color:"#555",fontSize:12}}>+{preview.length-6} more...</div>}</div></div>}
        <div style={{display:"flex",gap:12,marginTop:24,justifyContent:"flex-end"}}>
          <button onClick={onClose} style={{padding:"10px 24px",background:"none",border:"1px solid #333",borderRadius:6,color:"#888",cursor:"pointer",fontSize:14}}>Cancel</button>
          <button disabled={preview.length===0||importing} onClick={()=>onImport(preview)} style={{padding:"10px 28px",background:preview.length>0?"#e8e8e8":"#1a1a1a",border:"none",borderRadius:6,color:preview.length>0?"#0a0a0a":"#444",cursor:preview.length>0&&!importing?"pointer":"default",fontSize:14,fontWeight:700}}>
            {importing?`Saving to database...`:`Import ${preview.length>0?preview.length:""} Projects`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main App ─────────────────────────────────────────────────────────────────
function BidTracker() {
  const [bids, setBids]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [importing, setImporting] = useState(false);
  const [dbError, setDbError]   = useState(null);
  const [search, setSearch]     = useState("");
  const [filterStatus, setFilterStatus]     = useState("All");
  const [filterType, setFilterType]         = useState("All");
  const [filterPriority, setFilterPriority] = useState("All");
  const [filterTown, setFilterTown]         = useState("All");
  const [filterQuadrant, setFilterQuadrant] = useState("All");
  const [filterDay, setFilterDay]           = useState("All");
  const [sortBy, setSortBy]     = useState("bidDate");
  const [modal, setModal]       = useState(null);
  const [showImport, setShowImport]   = useState(false);
  const [showReport, setShowReport]   = useState(false);
  const [lastSync, setLastSync]       = useState(null);

  // ── Load from Supabase ─────────────────────────────────────────────────────
  const loadBids = useCallback(async (showLoader=false) => {
    if(showLoader) setLoading(true);
    try {
      const data = await sbFetch(`projects?select=*&user_id=eq.${getUserId()}&order=id.asc&limit=2000`);
      if(data && data.length > 0) {
        setBids(data.map(fromDB));
        setLastSync(new Date());
        setDbError(null);
      } else if(data && data.length === 0) {
        // Empty DB for this user — new rep starting fresh
        setBids([]);
      }
    } catch(e) {
      setDbError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Seed database on first load ────────────────────────────────────────────
  const seedDatabase = async () => {
    try {
      const chunks = [];
      for(let i=0; i<SEED_DATA.length; i+=100) chunks.push(SEED_DATA.slice(i,i+100));
      for(const chunk of chunks) {
        await sbFetch("projects", { method:"POST", body:JSON.stringify(chunk), prefer:"return=minimal" });
      }
      await loadBids();
    } catch(e) {
      setDbError("Seed failed: " + e.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBids(true);
    // Auto-refresh every 60 seconds
    const interval = setInterval(() => loadBids(false), 60000);
    return () => clearInterval(interval);
  }, [loadBids]);

  // ── Save / Update ──────────────────────────────────────────────────────────
  const saveBid = async (bid) => {
    setSaving(true);
    try {
      if(bid.id) {
        await sbFetch(`projects?id=eq.${bid.id}`, { method:"PATCH", body:JSON.stringify(toDB(bid)), prefer:"return=minimal" });
        setBids(prev => prev.map(b => b.id===bid.id ? bid : b));
      } else {
        const result = await sbFetch("projects", { method:"POST", body:JSON.stringify(toDB(bid)) });
        if(result && result[0]) setBids(prev => [...prev, fromDB(result[0])]);
      }
      setModal(null);
      setLastSync(new Date());
    } catch(e) {
      alert("Save failed: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const deleteBid = async (id) => {
    try {
      await sbFetch(`projects?id=eq.${id}`, { method:"DELETE", prefer:"return=minimal" });
      setBids(prev => prev.filter(b => b.id!==id));
    } catch(e) { alert("Delete failed: " + e.message); }
  };

  // ── Import CSV → Supabase ──────────────────────────────────────────────────
  const importBids = async (newBids) => {
    setImporting(true);
    try {
      const chunks = [];
      for(let i=0; i<newBids.length; i+=100) chunks.push(newBids.slice(i,i+100));
      const inserted = [];
      for(const chunk of chunks) {
        const result = await sbFetch("projects", { method:"POST", body:JSON.stringify(chunk.map(toDB)) });
        if(result) inserted.push(...result.map(fromDB));
      }
      setBids(prev => [...prev, ...inserted]);
      setShowImport(false);
      setLastSync(new Date());
    } catch(e) {
      alert("Import failed: " + e.message);
    } finally {
      setImporting(false);
    }
  };

  const awarded  = useMemo(()=>bids.filter(b=>b.status==="Awarded — Contact Now"),[bids]);

  const filtered = useMemo(()=>bids
    .filter(b=>{
      const q=search.toLowerCase();
      if(q&&![b.project,b.gc,b.town,b.owner,b.awardedTo].some(f=>f?.toLowerCase().includes(q))) return false;
      if(filterStatus!=="All"&&b.status!==filterStatus) return false;
      if(filterType!=="All"&&b.type!==filterType) return false;
      if(filterPriority!=="All"&&b.priority!==filterPriority) return false;
      if(filterTown!=="All"&&b.town!==filterTown) return false;
      if(filterQuadrant!=="All"&&getQuadrant(b)!==filterQuadrant) return false;
      if(filterDay!=="All"&&getDay(b)!==filterDay) return false;
      return true;
    })
    .sort((a,b)=>{
      if(a.status==="Awarded — Contact Now"&&b.status!=="Awarded — Contact Now") return -1;
      if(b.status==="Awarded — Contact Now"&&a.status!=="Awarded — Contact Now") return 1;
      if(sortBy==="bidDate") return new Date(a.bidDate||0)-new Date(b.bidDate||0);
      if(sortBy==="value") return b.value-a.value;
      if(sortBy==="priority") return PRIORITY_OPTIONS.indexOf(a.priority)-PRIORITY_OPTIONS.indexOf(b.priority);
      return 0;
    }),[bids,search,filterStatus,filterType,filterPriority,filterTown,filterQuadrant,filterDay,sortBy]);

  const stats = useMemo(()=>({
    total:    bids.filter(b=>!["Won","Lost"].includes(b.status)).length,
    pipeline: bids.reduce((s,b)=>b.status!=="Lost"?s+b.value:s,0),
    awarded:  awarded.length,
    urgent:   bids.filter(b=>{ const d=daysUntil(b.bidDate); return d!==null&&d<=7&&d>=0&&!["Won","Lost","Awarded — Contact Now"].includes(b.status); }).length,
  }),[bids,awarded]);

  if(loading) return (
    <div style={{minHeight:"100vh",background:"#0a0a0a",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16}}>
      <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet"/>
      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:32,letterSpacing:4,color:"#e8e8e8"}}>REPROUTE</div>
      <div style={{color:"#444",fontSize:13,letterSpacing:2,fontFamily:"monospace"}}>LOADING LIVE DATABASE...</div>
      <div style={{width:200,height:2,background:"#222222",borderRadius:2,overflow:"hidden"}}>
        <div style={{height:"100%",background:"#e8e8e8",animation:"load 1.5s ease-in-out infinite",width:"40%"}}/>
      </div>
      {dbError&&<div style={{color:"#cc4444",fontSize:12,maxWidth:400,textAlign:"center",padding:"0 20px"}}>{dbError}</div>}
      <style>{`@keyframes load{0%{transform:translateX(-100%)}100%{transform:translateX(600%)}}`}</style>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:"#0a0a0a",fontFamily:"'DM Sans','Segoe UI',sans-serif",color:"#F5F5F5"}}>
      <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet"/>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>

      {/* Header */}
      <div style={{borderBottom:"1px solid #1a1a2e",padding:"16px 32px",display:"flex",alignItems:"center",justifyContent:"space-between",background:"#0f0f0f"}}>
        <div style={{display:"flex",alignItems:"baseline",gap:12}}>
          <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,letterSpacing:4,color:"#e8e8e8"}}>REPROUTE</span>
          <span style={{color:"#444",fontSize:16}}>|</span>
          <span style={{color:"#666",fontSize:12,letterSpacing:2}}>BID INTELLIGENCE · LIVE</span>
          {lastSync&&<span style={{color:"#2a4a2a",fontSize:10,fontFamily:"monospace",marginLeft:8}}>● synced {lastSync.toLocaleTimeString()}</span>}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <button onClick={()=>loadBids(false)} style={{background:"#1a1a1a",border:"1px solid #2a2a44",borderRadius:6,color:"#666",padding:"7px 14px",cursor:"pointer",fontSize:12}}>↻ Refresh</button>
          <button onClick={()=>setShowImport(true)} style={{background:"#1a1a1a",border:"1px solid #2a2a44",borderRadius:6,color:"#e8e8e8",padding:"8px 16px",cursor:"pointer",fontSize:13,fontWeight:600}}>⬆ Import Data</button>
          <button onClick={()=>setShowReport(true)} style={{background:"#1a1a1a",border:"1px solid #cc2222",borderRadius:6,color:"#cc2222",padding:"8px 16px",cursor:"pointer",fontSize:13,fontWeight:600}}>📋 Daily Report</button>
          <button onClick={()=>setModal("add")} style={{background:"#e8e8e8",border:"none",borderRadius:6,color:"#0a0a0a",padding:"9px 18px",cursor:"pointer",fontSize:13,fontWeight:700}}>+ Add Project</button>
        </div>
      </div>

      {/* DB Error Banner */}
      {dbError&&<div style={{background:"#2a0a0a",borderBottom:"1px solid #cc4444",padding:"10px 32px",color:"#cc8888",fontSize:12,fontFamily:"monospace"}}>⚠ Database error: {dbError} — <button onClick={()=>loadBids(true)} style={{background:"none",border:"none",color:"#e8e8e8",cursor:"pointer",fontSize:12,textDecoration:"underline"}}>retry</button></div>}

      {/* Award Alert Banner */}
      {awarded.length>0&&(
        <div style={{background:"#110900",borderBottom:"2px solid #cc6600"}}>
          <div style={{padding:"8px 32px 4px",color:"#664400",fontSize:10,fontFamily:"monospace",letterSpacing:2}}>⚡ ACTION REQUIRED — {awarded.length} BID{awarded.length>1?"S":""} AWARDED</div>
          {awarded.map(b=>(
            <div key={b.id} style={{display:"flex",alignItems:"center",gap:16,padding:"10px 32px",borderTop:"1px solid #1e1000"}}>
              <span style={{fontSize:10,fontFamily:"monospace",letterSpacing:2,color:"#ffaa00",background:"#2a1500",padding:"3px 8px",borderRadius:3,border:"1px solid #cc6600",animation:"pulse 2s infinite",whiteSpace:"nowrap"}}>🏆 AWARDED</span>
              <div style={{flex:1}}><span style={{color:"#ffcc44",fontWeight:600,fontSize:14}}>{b.project}</span>{b.awardedTo?<span style={{color:"#aa7700",fontSize:13}}> — Won by <strong style={{color:"#ffaa00"}}>{b.awardedTo}</strong></span>:<span style={{color:"#553300",fontSize:12,fontStyle:"italic"}}> — Log winning contractor →</span>}</div>
              <span style={{color:"#553300",fontSize:12}}>{b.town} · {fmt$(b.value)}</span>
              <button onClick={()=>setModal(b)} style={{background:"#cc6600",border:"none",borderRadius:5,color:"#fff",padding:"7px 16px",cursor:"pointer",fontSize:12,fontWeight:700}}>Contact Now →</button>
            </div>
          ))}
        </div>
      )}

      {/* Stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:1,borderBottom:"1px solid #1a1a2e",background:"#222222"}}>
        {[["ACTIVE BIDS",stats.total,null],["PIPELINE VALUE",fmt$(stats.pipeline),"#e8e8e8"],["🏆 NEED CONTACT",stats.awarded,stats.awarded>0?"#ffaa00":null],["BID IN ≤7 DAYS",stats.urgent,stats.urgent>0?"#e8e8e8":null]].map(([label,val,color])=>(
          <div key={label} style={{background:"#0f0f0f",padding:"18px 24px",borderRight:"1px solid #1a1a2e"}}>
            <div style={{color:"#444",fontSize:10,letterSpacing:2,marginBottom:5,fontFamily:"monospace"}}>{label}</div>
            <div style={{fontSize:26,fontFamily:"'Bebas Neue',sans-serif",letterSpacing:1,color:color||"#F5F5F5"}}>{val}</div>
          </div>
        ))}
      </div>

      {/* Pipeline Dashboard */}
      <PipelineDashboard bids={bids} />

      {/* Day Route Buttons */}
      <div style={{padding:"12px 32px",display:"flex",gap:8,alignItems:"center",borderBottom:"1px solid #141420",background:"#0a0a12",flexWrap:"wrap"}}>
        <span style={{color:"#444",fontSize:10,fontFamily:"monospace",letterSpacing:2,marginRight:4,whiteSpace:"nowrap"}}>FIELD DAY:</span>
        <button onClick={()=>setFilterDay("All")} style={{padding:"8px 16px",borderRadius:6,border:`1px solid ${filterDay==="All"?"#666":"#222"}`,background:filterDay==="All"?"#e8e8e8":"transparent",color:filterDay==="All"?"#0a0a0a":"#555",cursor:"pointer",fontSize:12,fontWeight:700,letterSpacing:1}}>ALL</button>
        {Object.entries(DAY_ROUTES).map(([day,r])=>{
          const active=filterDay===day;
          const dayCount=bids.filter(b=>getDay(b)===day&&!["Won","Lost"].includes(b.status)).length;
          const awardedCount=bids.filter(b=>getDay(b)===day&&b.status==="Awarded — Contact Now").length;
          return (
            <button key={day} onClick={()=>setFilterDay(active?"All":day)} style={{padding:"8px 16px",borderRadius:6,border:`1px solid ${active?r.color:r.border}`,background:active?r.bg:"transparent",color:active?r.color:r.border,cursor:"pointer",fontSize:12,fontWeight:700,transition:"all 0.15s",boxShadow:active?`0 0 14px ${r.color}44`:"none",display:"flex",alignItems:"center",gap:8}}>
              <span>{r.label}</span>
              <span style={{opacity:0.7,fontSize:10,fontWeight:400}}>{r.subtitle}</span>
              <span style={{background:active?`${r.color}22`:"#1a1a2a",border:`1px solid ${active?r.color:r.border}`,borderRadius:10,padding:"1px 7px",fontSize:10}}>{dayCount}</span>
              {awardedCount>0&&<span style={{background:"#2a1500",border:"1px solid #cc6600",borderRadius:10,padding:"1px 7px",fontSize:10,color:"#ffaa00",animation:"pulse 2s infinite"}}>🏆{awardedCount}</span>}
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div style={{padding:"12px 32px",display:"flex",gap:10,alignItems:"center",borderBottom:"1px solid #141420",flexWrap:"wrap",background:"#111111"}}>
        <input placeholder="Search project, GC, owner, town..." value={search} onChange={e=>setSearch(e.target.value)} style={{background:"#1a1a1a",border:"1px solid #2a2a44",borderRadius:6,color:"#F5F5F5",padding:"8px 14px",fontSize:13,outline:"none",width:240}}/>
        {[["Status",filterStatus,setFilterStatus,["All",...STATUS_OPTIONS]],["Type",filterType,setFilterType,["All",...TYPE_OPTIONS]],["Priority",filterPriority,setFilterPriority,["All",...PRIORITY_OPTIONS]],["Town",filterTown,setFilterTown,["All",...TOWN_OPTIONS]],["Quadrant",filterQuadrant,setFilterQuadrant,["All",...QUADRANT_OPTIONS]],["Sort",sortBy,setSortBy,[["bidDate","Bid Date"],["value","Value"],["priority","Priority"]]]].map(([label,val,setter,opts])=>(
          <select key={label} value={val} onChange={e=>setter(e.target.value)} style={{background:"#1a1a1a",border:"1px solid #2a2a44",borderRadius:6,color:val==="All"||val==="bidDate"?"#555":"#F5F5F5",padding:"8px 10px",fontSize:12,outline:"none"}}>
            {opts.map(o=>Array.isArray(o)?<option key={o[0]} value={o[0]}>{o[1]}</option>:<option key={o} value={o}>{o==="All"?`All ${label}s`:o}</option>)}
          </select>
        ))}
        <span style={{color:"#333",fontSize:12,marginLeft:"auto"}}>{filtered.length} of {bids.length} projects</span>
      </div>

      {/* Table */}
      <div style={{padding:"0 32px 40px"}}>
        {filtered.length===0
          ?<div style={{textAlign:"center",color:"#333",padding:60}}>No projects match your filters.</div>
          :<>
            <div style={{display:"grid",gridTemplateColumns:"3fr 1.1fr 1fr 0.6fr 1fr 1.3fr 24px",gap:16,padding:"10px 16px",borderBottom:"1px solid #1e1e30",color:"#333",fontSize:10,fontFamily:"monospace",letterSpacing:1}}>
              {["PROJECT / GC","VALUE","BID DATE","PRI","DAY / COUNTY","STATUS",""].map(h=><div key={h} style={{color:"#4a4a00",letterSpacing:1}}>{h}</div>)}
            </div>
            {filtered.map((bid,i)=>{
              const days=daysUntil(bid.bidDate);
              const isUrgent=days!==null&&days<=7&&days>=0&&!["Won","Lost","Awarded — Contact Now"].includes(bid.status);
              const isAwd=bid.status==="Awarded — Contact Now";
              const sc=STATUS_COLORS[bid.status];
              const day=getDay(bid); const dr=DAY_ROUTES[day];
              const q=getQuadrant(bid); const qc=QUADRANT_COLORS[q];
              return (
                <div key={bid.id} onClick={()=>setModal(bid)}
                  style={{borderBottom:"1px solid #141420",display:"grid",gridTemplateColumns:"3fr 1.1fr 1fr 0.6fr 1fr 1.3fr 24px",gap:16,alignItems:"center",padding:"14px 16px",cursor:"pointer",borderLeft:`3px solid ${isAwd?"#cc6600":bid.source==="Dodge"||bid.source==="Imported"?"#e8873a":PRIORITY_COLORS[bid.priority]}`,background:isAwd?(i%2===0?"#110900":"#140b00"):bid.source==="Dodge"||bid.source==="Imported"?(i%2===0?"#120a00":"#160c00"):(i%2===0?"transparent":"#141414"),transition:"background 0.12s"}}
                  onMouseEnter={e=>e.currentTarget.style.background=isAwd?"#1a1000":bid.source==="Dodge"||bid.source==="Imported"?"#1e1000":"#1f1f1f"}
                  onMouseLeave={e=>e.currentTarget.style.background=isAwd?(i%2===0?"#110900":"#140b00"):bid.source==="Dodge"||bid.source==="Imported"?(i%2===0?"#120a00":"#160c00"):(i%2===0?"transparent":"#141414")}
                >
                  <div>
                    <div style={{fontWeight:600,fontSize:13,color:isAwd?"#ffcc44":"#F5F5F5",marginBottom:2,display:"flex",alignItems:"center",gap:6}}>
                      {bid.project}
                      {(bid.source==="Dodge"||bid.source==="Imported")&&<span style={{fontSize:8,padding:"1px 5px",borderRadius:3,background:"#2a1800",border:"1px solid #e8873a",color:"#e8873a",fontFamily:"monospace",letterSpacing:1,flexShrink:0}}>IMPORTED</span>}
                    </div>
                    <div style={{fontSize:11,color:"#555"}}>{bid.awardedTo?<span>🏆 <span style={{color:"#ffaa00"}}>{bid.awardedTo}</span></span>:bid.gc!=="TBD"?bid.gc:<span style={{color:"#e8e8e8",fontSize:10}}>GC TBD</span>}{" · "}{bid.town}</div>
                    {bid.notes&&<div style={{fontSize:10,color:"#3a3a4a",marginTop:2}}>{bid.notes.slice(0,70)}{bid.notes.length>70?"…":""}</div>}
                  </div>
                  <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:17,color:"#e8e8e8",letterSpacing:1}}>{fmt$(bid.value)}<div style={{fontSize:9,color:"#3a3a4a",fontFamily:"monospace"}}>{bid.type.toUpperCase()}</div></div>
                  <div>
                    <div style={{fontSize:12,color:isUrgent?"#e8e8e8":isAwd?"#ffaa00":"#666"}}>{isAwd&&bid.awardDate?`Awd ${fmtDate(bid.awardDate)}`:fmtDate(bid.bidDate)}</div>
                    {!isAwd&&days!==null&&<div style={{fontSize:10,color:isUrgent?"#e8e8e8":"#3a3a4a"}}>{days<0?`${Math.abs(days)}d ago`:days===0?"TODAY":`in ${days}d`}</div>}
                  </div>
                  <div style={{width:7,height:7,borderRadius:"50%",background:PRIORITY_COLORS[bid.priority],boxShadow:`0 0 6px ${PRIORITY_COLORS[bid.priority]}`,margin:"0 auto"}} title={bid.priority}/>
                  <div style={{display:"flex",flexDirection:"column",gap:3}}>
                    <div style={{fontSize:9,padding:"2px 6px",borderRadius:3,background:dr.bg,border:`1px solid ${dr.border}`,color:dr.color,fontFamily:"monospace",whiteSpace:"nowrap"}}>{dr.label} · {dr.subtitle}</div>
                    <div style={{fontSize:9,padding:"2px 6px",borderRadius:3,background:qc.bg,border:`1px solid ${qc.border}`,color:qc.text,fontFamily:"monospace",whiteSpace:"nowrap"}}>{qc.short}</div>
                  </div>
                  <div style={{fontSize:9,padding:"3px 7px",borderRadius:4,background:sc.bg,border:`1px solid ${sc.border}`,color:sc.text,letterSpacing:0.4,textAlign:"center",fontFamily:"monospace",lineHeight:1.5}}>{bid.status==="Awarded — Contact Now"?"AWARDED":bid.status.toUpperCase()}</div>
                  <button onClick={e=>{e.stopPropagation();deleteBid(bid.id);}} style={{background:"none",border:"none",color:"#252525",cursor:"pointer",fontSize:12,padding:"2px 4px"}} onMouseEnter={e=>e.currentTarget.style.color="#cc4444"} onMouseLeave={e=>e.currentTarget.style.color="#252525"}>✕</button>
                </div>
              );
            })}
          </>
        }
      </div>

      <div style={{padding:"12px 32px",borderTop:"1px solid #141420",display:"flex",gap:20,alignItems:"center",color:"#3a3a3a",fontSize:11,fontFamily:"monospace"}}>
        {PRIORITY_OPTIONS.map(p=>(<span key={p} style={{display:"flex",alignItems:"center",gap:5}}><span style={{width:7,height:7,borderRadius:"50%",background:PRIORITY_COLORS[p],display:"inline-block"}}/>{p}</span>))}
        <span style={{marginLeft:16,color:"#663300"}}>🏆 Awarded = contact immediately</span>
        <span style={{marginLeft:"auto",color:"#2a4a0a"}}>● LIVE · {bids.length} projects · auto-refresh 60s</span>
      </div>

      {modal&&<BidModal bid={modal==="add"?null:modal} onClose={()=>setModal(null)} onSave={saveBid} saving={saving}/>}
      {showImport&&<ImportModal onClose={()=>setShowImport(false)} onImport={importBids} importing={importing}/>}
      {showReport&&<DailyReportModal onClose={()=>setShowReport(false)}/>}
    </div>
  );
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  TERRITORY MAP  (Supabase-wired, add/edit/delete companies)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const DEFAULT_DAY_CONFIG = {
  Monday:    { color:"#4a9eff", bg:"#091929", border:"#1a4a7a", label:"MON", desc:"Route 1" },
  Tuesday:   { color:"#b04ae8", bg:"#120d1e", border:"#4a1a6b", label:"TUE", desc:"Route 2" },
  Wednesday: { color:"#4ae8a0", bg:"#091a12", border:"#1a6b40", label:"WED", desc:"Route 3" },
  Thursday:  { color:"#e8c84a", bg:"#1a1a1a", border:"#6b5200", label:"THU", desc:"Route 4" },
  Friday:    { color:"#e8503a", bg:"#1a0a08", border:"#6b2010", label:"FRI", desc:"Route 5" },
};

function getDAYCONFIG(userRoutes) {
  const base = JSON.parse(JSON.stringify(DEFAULT_DAY_CONFIG));
  if (!userRoutes) return base;
  Object.keys(base).forEach(day => {
    if (userRoutes[day]) {
      base[day].desc = userRoutes[day];
    }
  });
  return base;
}

// Will be overridden per-user after settings load
let DAY_CONFIG = JSON.parse(JSON.stringify(DEFAULT_DAY_CONFIG));

const TYPE_OPTIONS_MAP = ["GC","Excavation","Paving","Roofing","Industrial","Other"];
const PRIORITY_OPTIONS_MAP = ["High","Medium","Low"];
const STATE_OPTIONS = ["CT","MA"];
const TYPE_ICONS = { GC:"🏗", Excavation:"⛏", Paving:"🚧", Roofing:"🏠", Industrial:"🏭", Other:"📍" };
const PRIORITY_COLORS_MAP = { High:"#e8e8e8", Medium:"#4a9eff", Low:"#555" };

const BLANK_COMPANY = { name:"", day:"Monday", type:"GC", lat:"", lng:"", town:"", state:"CT", phone:"", email:"", notes:"", priority:"Medium", website:"", contact:"" };

function CompanyModal({ company, onClose, onSave, saving }) {
  const [form, setForm] = useState(company || BLANK_COMPANY);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const dc = DAY_CONFIG[form.day] || DAY_CONFIG.Monday;
  const isNew = !company;

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{background:"#0f0f0f",border:`1px solid ${dc.color}`,borderRadius:12,width:"100%",maxWidth:600,maxHeight:"90vh",overflowY:"auto",padding:32,position:"relative",boxShadow:`0 0 30px ${dc.color}22`}}>
        <button onClick={onClose} style={{position:"absolute",top:16,right:20,background:"none",border:"none",color:"#555",fontSize:22,cursor:"pointer"}}>×</button>
        <h2 style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:24,letterSpacing:2,color:"#e8e8e8",marginBottom:6}}>{isNew?"ADD COMPANY":"EDIT COMPANY"}</h2>
        <p style={{color:"#444",fontSize:12,marginBottom:24,fontFamily:"monospace"}}>All fields save directly to the live database.</p>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
          {/* Company Name - full width */}
          <div style={{gridColumn:"1 / -1"}}>
            <label style={{color:"#888",fontSize:10,letterSpacing:1,display:"block",marginBottom:5,fontFamily:"monospace"}}>COMPANY NAME *</label>
            <input value={form.name} onChange={e=>set("name",e.target.value)} placeholder="e.g. Smith Excavation LLC"
              style={{width:"100%",background:"#1a1a1a",border:`1px solid ${form.name?"#444":"#2a2a2a"}`,borderRadius:6,color:"#f5f5f5",padding:"10px 12px",fontSize:14,outline:"none",boxSizing:"border-box"}}/>
          </div>

          {/* Day */}
          <div>
            <label style={{color:"#888",fontSize:10,letterSpacing:1,display:"block",marginBottom:5,fontFamily:"monospace"}}>ROUTE DAY</label>
            <select value={form.day} onChange={e=>set("day",e.target.value)}
              style={{width:"100%",background:"#1a1a1a",border:`1px solid ${dc.border}`,borderRadius:6,color:dc.color,padding:"10px 12px",fontSize:13,outline:"none"}}>
              {Object.keys(DAY_CONFIG).map(d=><option key={d} value={d}>{DAY_CONFIG[d].label} — {DAY_CONFIG[d].desc}</option>)}
            </select>
          </div>

          {/* Type */}
          <div>
            <label style={{color:"#888",fontSize:10,letterSpacing:1,display:"block",marginBottom:5,fontFamily:"monospace"}}>COMPANY TYPE</label>
            <select value={form.type} onChange={e=>set("type",e.target.value)}
              style={{width:"100%",background:"#1a1a1a",border:"1px solid #333",borderRadius:6,color:"#f5f5f5",padding:"10px 12px",fontSize:13,outline:"none"}}>
              {TYPE_OPTIONS_MAP.map(t=><option key={t} value={t}>{TYPE_ICONS[t]} {t}</option>)}
            </select>
          </div>

          {/* Phone */}
          <div>
            <label style={{color:"#888",fontSize:10,letterSpacing:1,display:"block",marginBottom:5,fontFamily:"monospace"}}>PHONE</label>
            <input value={form.phone} onChange={e=>set("phone",e.target.value)} placeholder="(860) 555-0100"
              style={{width:"100%",background:"#1a1a1a",border:"1px solid #333",borderRadius:6,color:"#e8e8e8",padding:"10px 12px",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
          </div>

          {/* Contact name */}
          <div>
            <label style={{color:"#888",fontSize:10,letterSpacing:1,display:"block",marginBottom:5,fontFamily:"monospace"}}>CONTACT NAME</label>
            <input value={form.contact||""} onChange={e=>set("contact",e.target.value)} placeholder="e.g. Mike Smith"
              style={{width:"100%",background:"#1a1a1a",border:"1px solid #333",borderRadius:6,color:"#f5f5f5",padding:"10px 12px",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
          </div>

          {/* Email */}
          <div style={{gridColumn:"1 / -1"}}>
            <label style={{color:"#888",fontSize:10,letterSpacing:1,display:"block",marginBottom:5,fontFamily:"monospace"}}>EMAIL <span style={{color:"#444"}}>(optional)</span></label>
            <input type="email" value={form.email||""} onChange={e=>set("email",e.target.value)} placeholder="contact@company.com"
              style={{width:"100%",background:"#1a1a1a",border:"1px solid #333",borderRadius:6,color:"#4a9eff",padding:"10px 12px",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
          </div>

          {/* Town */}
          <div>
            <label style={{color:"#888",fontSize:10,letterSpacing:1,display:"block",marginBottom:5,fontFamily:"monospace"}}>TOWN</label>
            <input value={form.town} onChange={e=>set("town",e.target.value)} placeholder="e.g. Torrington"
              style={{width:"100%",background:"#1a1a1a",border:"1px solid #333",borderRadius:6,color:"#f5f5f5",padding:"10px 12px",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
          </div>

          {/* State */}
          <div>
            <label style={{color:"#888",fontSize:10,letterSpacing:1,display:"block",marginBottom:5,fontFamily:"monospace"}}>STATE</label>
            <select value={form.state} onChange={e=>set("state",e.target.value)}
              style={{width:"100%",background:"#1a1a1a",border:"1px solid #333",borderRadius:6,color:"#f5f5f5",padding:"10px 12px",fontSize:13,outline:"none"}}>
              {STATE_OPTIONS.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Priority */}
          <div>
            <label style={{color:"#888",fontSize:10,letterSpacing:1,display:"block",marginBottom:5,fontFamily:"monospace"}}>PRIORITY</label>
            <select value={form.priority} onChange={e=>set("priority",e.target.value)}
              style={{width:"100%",background:"#1a1a1a",border:"1px solid #333",borderRadius:6,color:PRIORITY_COLORS_MAP[form.priority],padding:"10px 12px",fontSize:13,outline:"none"}}>
              {PRIORITY_OPTIONS_MAP.map(p=><option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          {/* Lat / Lng */}
          <div>
            <label style={{color:"#888",fontSize:10,letterSpacing:1,display:"block",marginBottom:5,fontFamily:"monospace"}}>LATITUDE <span style={{color:"#444"}}>(optional — auto from town)</span></label>
            <input type="number" step="0.0001" value={form.lat||""} onChange={e=>set("lat",e.target.value)} placeholder="41.8049"
              style={{width:"100%",background:"#1a1a1a",border:"1px solid #333",borderRadius:6,color:"#f5f5f5",padding:"10px 12px",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
          </div>
          <div>
            <label style={{color:"#888",fontSize:10,letterSpacing:1,display:"block",marginBottom:5,fontFamily:"monospace"}}>LONGITUDE</label>
            <input type="number" step="0.0001" value={form.lng||""} onChange={e=>set("lng",e.target.value)} placeholder="-73.1175"
              style={{width:"100%",background:"#1a1a1a",border:"1px solid #333",borderRadius:6,color:"#f5f5f5",padding:"10px 12px",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
          </div>

          {/* Notes - full width */}
          <div style={{gridColumn:"1 / -1"}}>
            <label style={{color:"#888",fontSize:10,letterSpacing:1,display:"block",marginBottom:5,fontFamily:"monospace"}}>NOTES</label>
            <textarea value={form.notes} onChange={e=>set("notes",e.target.value)} rows={3} placeholder="What do they work on? Who's the decision maker? Equipment rental potential?"
              style={{width:"100%",background:"#1a1a1a",border:"1px solid #333",borderRadius:6,color:"#f5f5f5",padding:"10px 12px",fontSize:13,outline:"none",resize:"vertical",boxSizing:"border-box",fontFamily:"inherit"}}/>
          </div>

          {/* Website */}
          <div style={{gridColumn:"1 / -1"}}>
            <label style={{color:"#888",fontSize:10,letterSpacing:1,display:"block",marginBottom:5,fontFamily:"monospace"}}>WEBSITE <span style={{color:"#444"}}>(optional)</span></label>
            <input value={form.website||""} onChange={e=>set("website",e.target.value)} placeholder="https://..."
              style={{width:"100%",background:"#1a1a1a",border:"1px solid #333",borderRadius:6,color:"#4a9eff",padding:"10px 12px",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
          </div>
        </div>

        <div style={{display:"flex",gap:10,marginTop:24,justifyContent:"flex-end"}}>
          <button onClick={onClose} style={{padding:"10px 22px",background:"none",border:"1px solid #333",borderRadius:6,color:"#666",cursor:"pointer",fontSize:13}}>Cancel</button>
          <button onClick={()=>onSave(form)} disabled={!form.name||saving}
            style={{padding:"10px 28px",background:form.name?"#e8e8e8":"#222",border:"none",borderRadius:6,color:form.name?"#0a0a0a":"#555",cursor:form.name&&!saving?"pointer":"default",fontSize:13,fontWeight:700,opacity:saving?0.7:1}}>
            {saving?"Saving...":(isNew?"Add to Map":"Save Changes")}
          </button>
        </div>
      </div>
    </div>
  );
}

// Default lat/lng for towns when user doesn't provide coords
const TOWN_COORDS = {
  "Torrington":{lat:41.8005,lng:-73.1212},"Winsted":{lat:41.9282,lng:-73.0626},
  "Litchfield":{lat:41.7490,lng:-73.1876},"New Milford":{lat:41.5776,lng:-73.4082},
  "Waterbury":{lat:41.5582,lng:-73.0515},"Danbury":{lat:41.3948,lng:-73.4540},
  "Sharon":{lat:41.8676,lng:-73.4793},"Canaan":{lat:42.0234,lng:-73.3282},
  "Norfolk":{lat:41.9954,lng:-73.1996},"Salisbury":{lat:41.9790,lng:-73.4204},
  "Pittsfield":{lat:42.4501,lng:-73.2553},"Great Barrington":{lat:42.1959,lng:-73.3626},
  "Lenox":{lat:42.3648,lng:-73.2848},"North Adams":{lat:42.7001,lng:-73.1087},
  "Lee":{lat:42.2989,lng:-73.2495},"Sheffield":{lat:42.0968,lng:-73.3582},
  "Springfield":{lat:42.1015,lng:-72.5898},"Chicopee":{lat:42.1487,lng:-72.6079},
  "Holyoke":{lat:42.2042,lng:-72.6162},"Westfield":{lat:42.1495,lng:-72.7496},
  "Agawam":{lat:42.0701,lng:-72.6218},"West Springfield":{lat:42.1056,lng:-72.6398},
  "Southwick":{lat:42.0579,lng:-72.7734},"Ludlow":{lat:42.1614,lng:-72.4801},
};

function TerritoryMap() {
  const [companies, setCompanies]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [activeDay, setActiveDay]   = useState("All");
  const [activeType, setActiveType] = useState("All");
  const [search, setSearch]         = useState("");
  const [selected, setSelected]     = useState(null);
  const [modal, setModal]           = useState(null);
  const [mapReady, setMapReady]         = useState(false);
  const [followUpTarget, setFollowUpTarget] = useState(null);
  const mapDivRef  = useRef(null);
  const leafletRef = useRef(null);
  const cssReadyRef = useRef(false);

  // ── 1. Lazy init map only when tab is visible ────────────────────────────
  useEffect(() => {
    let cancelled = false;

    function initMap() {
      if (cancelled) return;
      if (!mapDivRef.current) return;
      if (leafletRef.current) return; // already inited
      // Don't init if div has no size yet (tab not visible)
      if (mapDivRef.current.offsetWidth === 0) {
        setTimeout(() => { if (!cancelled) initMap(); }, 300);
        return;
      }

      const L = window.L;
      if (!L) return;

      // Fix broken default marker icons (Vite strips them)
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl:       "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl:     "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      });

      const map = L.map(mapDivRef.current, {
        center: [42.05, -73.15],
        zoom: 8,
        zoomControl: true,
      });

      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        { attribution: "© CARTO", maxZoom: 19 }
      ).addTo(map);

      leafletRef.current = { map, markerGroup: L.layerGroup().addTo(map) };
      window._leafletMap = map;
      // Force full render after a tick
      setTimeout(() => { map.invalidateSize(true); }, 100);
      setTimeout(() => { map.invalidateSize(true); }, 500);
      setTimeout(() => { map.invalidateSize(true); }, 1200);
      // Trigger re-render so marker useEffect fires after map is ready
      setMapReady(true);
    }

    // Leaflet is loaded in index.html before React mounts
    // Just init immediately, with a short poll as safety net
    cssReadyRef.current = true;
    if (window.L && mapDivRef.current) {
      initMap();
    }

    // Poll as safety net for slow connections
    const poll = setInterval(() => {
      if (cancelled) { clearInterval(poll); return; }
      if (window.L && mapDivRef.current && !leafletRef.current) {
        cssReadyRef.current = true;
        initMap();
      }
      if (leafletRef.current) clearInterval(poll);
    }, 200);

    return () => { cancelled = true; clearInterval(poll); };
  }, []);

  // ── 2. Re-render markers whenever data or filters change ─────────────────
  useEffect(() => {
    if (!mapReady || !leafletRef.current) return;
    const { map, markerGroup } = leafletRef.current;
    const L = window.L;
    if (!L) return;

    markerGroup.clearLayers();

    const DAY_COLORS = {
      Monday: "#4a9eff", Tuesday: "#b04ae8", Wednesday: "#4ae8a0", Thursday: "#e8c84a"
    };

    const filteredWithCoords = companies.filter(c => {
      if (!c.lat || !c.lng) return false;
      if (activeDay !== "All" && c.day !== activeDay) return false;
      if (activeType !== "All" && c.type !== activeType) return false;
      if (search && !c.name?.toLowerCase().includes(search.toLowerCase()) &&
          !c.town?.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });

    filteredWithCoords.forEach(c => {
      const color = DAY_COLORS[c.day] || "#888";
      const icon = L.divIcon({
        className: "",
        iconSize: [20, 28],
        iconAnchor: [10, 28],
        popupAnchor: [0, -30],
        html: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="28" viewBox="0 0 20 28">
          <path d="M10 0C4.5 0 0 4.5 0 10c0 7.5 10 18 10 18S20 17.5 20 10C20 4.5 15.5 0 10 0z" fill="${color}"/>
          <circle cx="10" cy="10" r="5" fill="#0a0a0a"/>
        </svg>`,
      });

      const marker = L.marker([c.lat, c.lng], { icon });
      marker.bindPopup(`
        <div style="font-family:monospace;min-width:140px;background:#111;color:#f5f5f5;padding:6px;border-radius:4px">
          <div style="color:${color};font-size:10px;letter-spacing:1px;margin-bottom:4px">${c.day || ""} · ${c.type || ""}</div>
          <div style="font-weight:700;font-size:13px;margin-bottom:2px">${c.name}</div>
          <div style="color:#888;font-size:11px;margin-bottom:6px">${c.town}, ${c.state}</div>
          ${c.phone ? `<div style="color:#cc9900;font-size:11px;margin-bottom:6px">${c.phone}</div>` : ""}
          ${c.lat && c.lng ? `<a href="https://waze.com/ul?ll=${c.lat},${c.lng}&navigate=yes" target="_blank"
            style="display:block;padding:5px 8px;background:#05c8f7;border-radius:4px;color:#000;font-weight:700;font-size:11px;text-decoration:none;text-align:center">
            🚗 Waze
          </a>` : ""}
        </div>
      `, { className: "dark-popup" });

      marker.on("click", () => setSelected(c));
      markerGroup.addLayer(marker);
    });

    // Invalidate size in case container resized
    setTimeout(() => map.invalidateSize(), 50);
  }, [companies, activeDay, activeType, search, mapReady]);

  // ── 3. Load companies ────────────────────────────────────────────────────
  useEffect(() => {
    // Load from cache instantly, then refresh from Supabase in background
    const cacheKey = `companies_${getUserId()}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        setCompanies(JSON.parse(cached));
        setLoading(false);
      } catch {}
    }
    const session = JSON.parse(localStorage.getItem("sb_session") || "{}");
    const token = session.access_token || SUPABASE_KEY;
    fetch(`${SUPABASE_URL}/rest/v1/companies?select=*&user_id=eq.${getUserId()}&order=id.asc&limit=1000`, {
      headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${token}` }
    })
    .then(r => r.json())
    .then(data => {
      if (Array.isArray(data)) {
        setCompanies(data);
        localStorage.setItem(cacheKey, JSON.stringify(data));
      }
      setLoading(false);
    })
    .catch(() => setLoading(false));
  }, []);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const filtered = companies.filter(c => {
    if (activeDay !== "All" && c.day !== activeDay) return false;
    if (activeType !== "All" && c.type !== activeType) return false;
    if (search && !c.name?.toLowerCase().includes(search.toLowerCase()) &&
        !c.town?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const saveCompany = async (form) => {
    setSaving(true);
    const COORDS = {
      "Torrington":[41.8005,-73.1212],"Winsted":[41.9282,-73.0626],
      "Pittsfield":[42.4501,-73.2553],"Springfield":[42.1015,-72.5898],
      "New Milford":[41.5776,-73.4082],"Westfield":[42.1495,-72.7496],
      "Great Barrington":[42.1959,-73.3626],"Lenox":[42.3648,-73.2848],
      "Chicopee":[42.1487,-72.6079],"West Springfield":[42.1056,-72.6398]
    };
    let lat = parseFloat(form.lat)||0, lng = parseFloat(form.lng)||0;
    if ((!lat||!lng) && COORDS[form.town]) { lat=COORDS[form.town][0]; lng=COORDS[form.town][1]; }
    const payload = {
      user_id:getUserId(), name:form.name, day:form.day, type:form.type, lat, lng,
      town:form.town, state:form.state, phone:form.phone,
      email:form.email||null, notes:form.notes, priority:form.priority,
      website:form.website||null, contact:form.contact||null
    };
    try {
      if (form.id) {
        await fetch(`${SUPABASE_URL}/rest/v1/companies?id=eq.${form.id}`, {
          method:"PATCH",
          headers:{"apikey":SUPABASE_KEY,"Authorization":`Bearer ${SUPABASE_KEY}`,"Content-Type":"application/json","Prefer":"return=minimal"},
          body:JSON.stringify(payload)
        });
        setCompanies(prev => prev.map(c => c.id===form.id ? {...c,...payload,id:c.id} : c));
      } else {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/companies`, {
          method:"POST",
          headers:{"apikey":SUPABASE_KEY,"Authorization":`Bearer ${SUPABASE_KEY}`,"Content-Type":"application/json","Prefer":"return=representation"},
          body:JSON.stringify(payload)
        });
        const d = await r.json();
        if (d?.[0]) setCompanies(prev => [...prev, d[0]]);
      }
      setModal(null);
    } catch(e) { alert("Save failed: "+e.message); }
    setSaving(false);
  };

  const deleteCompany = async (id) => {
    if (!confirm("Remove this company?")) return;
    await fetch(`${SUPABASE_URL}/rest/v1/companies?id=eq.${id}`, {
      method:"DELETE",
      headers:{"apikey":SUPABASE_KEY,"Authorization":`Bearer ${SUPABASE_KEY}`}
    });
    setCompanies(prev => prev.filter(c => c.id!==id));
    if (selected?.id===id) setSelected(null);
  };

  const types = [...new Set(companies.map(c=>c.type).filter(Boolean))];
  const selDc = selected ? (DAY_CONFIG[selected.day]||DAY_CONFIG.Monday) : null;

  if (loading) return (
    <div style={{height:"calc(100vh - 54px)",background:"#0a0a0a",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{color:"#e8e8e8",fontFamily:"'Bebas Neue',sans-serif",fontSize:24,letterSpacing:3}}>LOADING...</div>
    </div>
  );

  return (
    <div style={{background:"#0a0a0a",color:"#f5f5f5",fontFamily:"'DM Sans',sans-serif"}}>

      {/* ── Dark popup style injected once ── */}
      <style>{`.dark-popup .leaflet-popup-content-wrapper{background:#111;border:1px solid #222;border-radius:6px;padding:0;box-shadow:0 4px 20px rgba(0,0,0,.8)}.dark-popup .leaflet-popup-content{margin:0}.dark-popup .leaflet-popup-tip{background:#111}`}</style>

      {/* ── Filter bar ── */}
      <div style={{background:"#0a0a0a",borderBottom:"1px solid #1e1e1e",padding:"10px 24px",display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
        <span style={{color:"#444",fontSize:10,fontFamily:"monospace",letterSpacing:2}}>ROUTE DAY:</span>
        <button onClick={()=>setActiveDay("All")} style={{padding:"5px 12px",borderRadius:5,border:`1px solid ${activeDay==="All"?"#e8e8e8":"#222"}`,background:activeDay==="All"?"#1a1a1a":"transparent",color:activeDay==="All"?"#ffffff":"#444",cursor:"pointer",fontSize:11,fontWeight:700}}>ALL</button>
        {Object.entries(DAY_CONFIG).map(([day,dc])=>{
          const active = activeDay===day;
          return (
            <button key={day} onClick={()=>setActiveDay(active?"All":day)}
              style={{padding:"5px 12px",borderRadius:5,border:`1px solid ${active?dc.color:dc.border}`,background:active?dc.bg:"transparent",color:active?dc.color:dc.border,cursor:"pointer",fontSize:11,fontWeight:700,display:"flex",alignItems:"center",gap:6,boxShadow:active?`0 0 8px ${dc.color}44`:"none"}}>
              {dc.label} <span style={{opacity:.6,fontSize:9}}>{dc.desc}</span>
              <span style={{background:active?`${dc.color}22`:"#111",border:`1px solid ${active?dc.color:dc.border}`,borderRadius:8,padding:"0 5px",fontSize:9}}>
                {companies.filter(c=>c.day===day).length}
              </span>
            </button>
          );
        })}
        <div style={{marginLeft:"auto",display:"flex",gap:8,alignItems:"center"}}>
          {["All",...types].map(t=>(
            <button key={t} onClick={()=>setActiveType(t)}
              style={{padding:"4px 10px",borderRadius:4,border:`1px solid ${activeType===t?"#e8e8e8":"#222"}`,background:activeType===t?"#1a1a1a":"transparent",color:activeType===t?"#ffffff":"#444",cursor:"pointer",fontSize:10}}>
              {t==="All"?"All":(TYPE_ICONS[t]||"📍")+" "+t}
            </button>
          ))}
          <button onClick={()=>setModal("add")}
            style={{marginLeft:8,padding:"6px 16px",background:"#e8e8e8",border:"none",borderRadius:6,color:"#0a0a0a",cursor:"pointer",fontSize:12,fontWeight:700}}>
            + Add Company
          </button>
        </div>
      </div>

      {/* ── Main layout ── */}
      <div style={{display:"flex",height:"calc(100vh - 110px)"}}>

        {/* Sidebar */}
        <div style={{width:300,background:"#0d0d0d",borderRight:"1px solid #1a1a1a",display:"flex",flexDirection:"column",flexShrink:0,overflow:"hidden"}}>
          <div style={{padding:"8px 12px",borderBottom:"1px solid #1a1a1a",display:"flex",gap:8,alignItems:"center"}}>
            <input placeholder="Search..." value={search} onChange={e=>setSearch(e.target.value)}
              style={{flex:1,background:"#1a1a1a",border:"1px solid #282828",borderRadius:5,color:"#f5f5f5",padding:"6px 10px",fontSize:12,outline:"none"}}/>
            <span style={{color:"#333",fontSize:10,fontFamily:"monospace"}}>{filtered.length}/{companies.length}</span>
          </div>

          <div style={{overflowY:"auto",flex:1}}>
            {Object.entries(DAY_CONFIG).map(([day,dc])=>{
              const dayCos = filtered.filter(c=>c.day===day);
              if (!dayCos.length) return null;
              return (
                <div key={day}>
                  <div style={{padding:"7px 12px",background:"#0a0a0a",borderBottom:"1px solid #151515",display:"flex",alignItems:"center",gap:8,position:"sticky",top:0,zIndex:2}}>
                    <span style={{fontFamily:"monospace",fontSize:9,fontWeight:700,letterSpacing:2,color:dc.color,background:dc.bg,border:`1px solid ${dc.border}`,borderRadius:3,padding:"1px 6px"}}>{dc.label}</span>
                    <span style={{color:"#444",fontSize:10}}>{dc.desc}</span>
                    <span style={{marginLeft:"auto",color:dc.border,fontSize:9}}>{dayCos.length}</span>
                  </div>
                  {dayCos.map(c=>{
                    const isSel = selected?.id===c.id;
                    return (
                      <div key={c.id} onClick={()=>setSelected(isSel?null:c)}
                        style={{padding:"8px 12px",borderBottom:"1px solid #141414",cursor:"pointer",background:isSel?dc.bg:"transparent",borderLeft:isSel?`3px solid ${dc.color}`:"3px solid transparent"}}
                        onMouseEnter={e=>{if(!isSel)e.currentTarget.style.background="#111";}}
                        onMouseLeave={e=>{if(!isSel)e.currentTarget.style.background="transparent";}}>
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <span style={{fontSize:11}}>{TYPE_ICONS[c.type]||"🏗"}</span>
                          <span style={{fontWeight:600,fontSize:12,color:isSel?dc.color:"#f5f5f5",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.name}</span>
                          <div style={{display:"flex",gap:3,flexShrink:0}}>
                            <button onClick={e=>{e.stopPropagation();setFollowUpTarget(c);}} style={{background:"none",border:"1px solid #1a3a1a",borderRadius:3,color:"#3a6a3a",cursor:"pointer",fontSize:9,padding:"1px 5px"}} title="Set follow-up">⏰</button>
                            <button onClick={e=>{e.stopPropagation();setModal(c);}} style={{background:"none",border:"1px solid #333",borderRadius:3,color:"#555",cursor:"pointer",fontSize:9,padding:"1px 5px"}}>✎</button>
                            <button onClick={e=>{e.stopPropagation();deleteCompany(c.id);}} style={{background:"none",border:"1px solid #2a1a1a",borderRadius:3,color:"#553333",cursor:"pointer",fontSize:9,padding:"1px 5px"}}>✕</button>
                          </div>
                        </div>
                        <div style={{fontSize:10,color:"#555",marginTop:2}}>
                          {c.town}, {c.state}
                          {c.phone&&<span style={{color:"#aaaaaa",opacity:.8,marginLeft:8}}>{c.phone}</span>}
                        </div>
                        {isSel&&c.notes&&<div style={{fontSize:10,color:"#555",marginTop:3,fontStyle:"italic"}}>{c.notes.slice(0,80)}</div>}
                        {isSel&&(
                          <div style={{display:"flex",gap:6,marginTop:6,flexWrap:"wrap"}}>
                            {c.lat&&c.lng&&<a href={`https://waze.com/ul?ll=${c.lat},${c.lng}&navigate=yes`} target="_blank" rel="noreferrer"
                              style={{flex:1,padding:"5px",background:"#05c8f7",borderRadius:5,color:"#000",fontWeight:700,fontSize:10,textDecoration:"none",textAlign:"center",minWidth:60}}>🚗 Waze</a>}
                            {c.lat&&c.lng&&<a href={`https://maps.google.com/?q=${c.lat},${c.lng}`} target="_blank" rel="noreferrer"
                              style={{flex:1,padding:"5px",background:"#1a1a1a",border:"1px solid #333",borderRadius:5,color:"#888",fontSize:10,textDecoration:"none",textAlign:"center",minWidth:60}}>🗺 Maps</a>}
                            {c.email&&<a href={`mailto:${c.email}`}
                              style={{flex:1,padding:"5px",background:"#1a1a1a",border:"1px solid #333",borderRadius:5,color:"#4a9eff",fontSize:10,textDecoration:"none",textAlign:"center",minWidth:60}}>✉ Email</a>}
                            {c.phone&&<a href={`tel:${c.phone}`}
                              style={{flex:1,padding:"5px",background:"#1a1a1a",border:"1px solid #333",borderRadius:5,color:"#aaa",fontSize:10,textDecoration:"none",textAlign:"center",minWidth:60}}>📞 Call</a>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          <div style={{borderTop:"1px solid #1a1a1a",padding:"8px",display:"flex",gap:10,justifyContent:"center"}}>
            {Object.entries(DAY_CONFIG).map(([day,dc])=>(
              <div key={day} style={{textAlign:"center"}}>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,color:dc.color}}>{companies.filter(c=>c.day===day).length}</div>
                <div style={{fontSize:8,color:dc.border,fontFamily:"monospace",letterSpacing:1}}>{dc.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Map container — explicit pixel height required by Leaflet */}
        <div style={{flex:1,position:"relative",overflow:"hidden"}}>
          <div ref={mapDivRef} style={{width:"100%",height:"100%",minHeight:"400px"}} />

          {/* Legend overlay */}
          <div style={{position:"absolute",top:12,right:12,background:"rgba(10,10,10,0.92)",border:"1px solid #1e1e1e",borderRadius:8,padding:"10px 14px",zIndex:1000,pointerEvents:"none"}}>
            <div style={{color:"#444",fontSize:9,fontFamily:"monospace",letterSpacing:1,marginBottom:6}}>
              ROUTE DAYS · {filtered.filter(c=>c.lat&&c.lng).length} PINNED
            </div>
            {Object.entries(DAY_CONFIG).map(([day,dc])=>(
              <div key={day} style={{display:"flex",alignItems:"center",gap:7,marginBottom:3}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:dc.color}}/>
                <span style={{fontSize:10,color:dc.color,fontFamily:"monospace"}}>{dc.label}</span>
                <span style={{fontSize:9,color:"#444"}}>{dc.desc}</span>
                <span style={{fontSize:9,color:dc.border,marginLeft:4}}>{companies.filter(c=>c.day===day).length}</span>
              </div>
            ))}
          </div>

          {/* Selected company info card */}
          {selected&&(
            <div style={{position:"absolute",bottom:0,left:0,right:0,background:"rgba(13,13,13,0.97)",borderTop:`2px solid ${selDc.color}`,padding:"12px 20px",zIndex:1000,display:"flex",alignItems:"center",gap:16}}>
              <div style={{flex:1}}>
                <div style={{fontSize:9,color:selDc.color,fontFamily:"monospace",letterSpacing:2,marginBottom:2}}>{selDc.label} · {selected.type}</div>
                <div style={{fontWeight:700,fontSize:16}}>{selected.name}</div>
                <div style={{fontSize:11,color:"#666"}}>{selected.town}, {selected.state}</div>
              </div>
              {selected.phone&&<a href={`tel:${selected.phone}`} style={{padding:"8px 14px",background:"#1a1a1a",border:"1px solid #888",borderRadius:6,color:"#e8e8e8",fontWeight:700,fontSize:12,textDecoration:"none"}}>📞 {selected.phone}</a>}
              {selected.lat&&selected.lng&&<a href={`https://waze.com/ul?ll=${selected.lat},${selected.lng}&navigate=yes`} target="_blank" rel="noreferrer" style={{padding:"8px 14px",background:"#05c8f7",borderRadius:6,color:"#000",fontWeight:700,fontSize:12,textDecoration:"none"}}>🚗 Waze</a>}
              {selected.lat&&selected.lng&&<a href={`https://maps.google.com/?q=${selected.lat},${selected.lng}`} target="_blank" rel="noreferrer" style={{padding:"8px 14px",background:"#1a1a1a",border:"1px solid #333",borderRadius:6,color:"#888",fontSize:12,textDecoration:"none"}}>🗺 Maps</a>}
              <button onClick={()=>setModal(selected)} style={{padding:"8px 12px",background:"#1a1a1a",border:"1px solid #444",borderRadius:6,color:"#aaa",cursor:"pointer",fontSize:11}}>✎ Edit</button>
              <button onClick={()=>setSelected(null)} style={{padding:"8px 12px",background:"none",border:"1px solid #2a2a2a",borderRadius:6,color:"#444",cursor:"pointer",fontSize:11}}>✕</button>
            </div>
          )}
        </div>
      </div>

      {modal&&<CompanyModal company={modal==="add"?null:modal} onClose={()=>setModal(null)} onSave={saveCompany} saving={saving}/>}
      {followUpTarget&&<FollowUpModal company={followUpTarget} onClose={()=>setFollowUpTarget(null)} onSave={()=>{}}/>}
    </div>
  );
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  UNIFIED APP SHELL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  LOGIN SCREEN
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function LoginScreen() {
  const [loading, setLoading] = useState(false);

  const handleGoogle = () => {
    setLoading(true);
    signInWithGoogle();
  };

  return (
    <div style={{minHeight:"100vh",background:"#0a0a0a",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans',sans-serif"}}>
      <div style={{width:380,padding:"48px 40px",background:"#0d0d0d",border:"1px solid #1e1e1e",borderRadius:16,textAlign:"center"}}>
        {/* Logo / Brand */}
        <div style={{marginBottom:32}}>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:42,color:"#e8e8e8",letterSpacing:4,lineHeight:1}}>REPROUTE</div>
          <div style={{fontSize:11,color:"#444",letterSpacing:3,fontFamily:"monospace",marginTop:4}}>FIELD SALES INTELLIGENCE</div>
        </div>

        {/* Divider */}
        <div style={{height:1,background:"#1a1a1a",margin:"0 0 32px"}}/>

        {/* Sign in button */}
        <button
          onClick={handleGoogle}
          disabled={loading}
          style={{width:"100%",padding:"14px 20px",background:"#fff",border:"none",borderRadius:8,cursor:loading?"wait":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:12,fontSize:15,fontWeight:600,color:"#1a1a1a",boxShadow:"0 2px 8px rgba(0,0,0,.3)",opacity:loading?0.7:1,transition:"opacity .2s"}}>
          {/* Google G icon */}
          <svg width="20" height="20" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.35-8.16 2.35-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          {loading ? "Redirecting..." : "Sign in with Google"}
        </button>

        <div style={{marginTop:24,fontSize:11,color:"#333",lineHeight:1.6}}>
          Access restricted to authorized team members only.
        </div>
      </div>
    </div>
  );
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  ACTIVITY LOG  (Google Calendar sync + Share to Manager)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function ActivityLog() {
  const [weekOffset, setWeekOffset]   = useState(0); // 0 = current week
  const [events, setEvents]           = useState({}); // { "2026-04-24": [{title, description, start, end}] }
  const [reports, setReports]         = useState([]); // submitted reports from Supabase
  const [allReports, setAllReports]   = useState([]); // manager view
  const [isManager, setIsManager]     = useState(false);
  const [loading, setLoading]         = useState(true);
  const [syncing, setSyncing]         = useState(false);
  const [sharing, setSharing]         = useState(null); // date being shared
  const [filterRep, setFilterRep]     = useState("All");
  const [calError, setCalError]       = useState(null);

  // ── Get week dates ───────────────────────────────────────────
  const getWeekDates = (offset = 0) => {
    const today = new Date();
    const day = today.getDay(); // 0=Sun
    const monday = new Date(today);
    monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1) + offset * 7);
    return Array.from({length: 7}, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
  };

  const weekDates = getWeekDates(weekOffset);
  const todayStr = new Date().toISOString().split("T")[0];
  const DAY_NAMES = ["MON","TUE","WED","THU","FRI","SAT","SUN"];

  const fmtDate = (d) => d.toISOString().split("T")[0];
  const fmtDisplay = (d) => d.toLocaleDateString("en-US", {month:"short", day:"numeric"});
  const fmtTime = (iso) => {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleTimeString("en-US", {hour:"numeric", minute:"2-digit", hour12:true});
    } catch { return ""; }
  };

  // ── Check if manager ─────────────────────────────────────────
  useEffect(() => {
    const uid = getUserId();
    if (!uid) return;
    fetch(`${SUPABASE_URL}/rest/v1/user_settings?user_id=eq.${uid}&key=eq.role&select=value`, {
      headers: {"apikey": SUPABASE_KEY, "Authorization": `Bearer ${JSON.parse(localStorage.getItem("sb_session")||"{}").access_token || SUPABASE_KEY}`}
    })
    .then(r => r.json())
    .then(d => { if (d?.[0]?.value === "manager") setIsManager(true); })
    .catch(() => {});
  }, []);

  // ── Load submitted reports ────────────────────────────────────
  const loadReports = async () => {
    const session = JSON.parse(localStorage.getItem("sb_session") || "{}");
    const token = session.access_token || SUPABASE_KEY;
    const uid = getUserId();

    // Own reports
    const r = await fetch(`${SUPABASE_URL}/rest/v1/daily_reports?user_id=eq.${uid}&order=report_date.desc&limit=90`, {
      headers: {"apikey": SUPABASE_KEY, "Authorization": `Bearer ${token}`}
    });
    const d = await r.json();
    setReports(Array.isArray(d) ? d : []);

    // Manager: all reports
    if (isManager) {
      const r2 = await fetch(`${SUPABASE_URL}/rest/v1/daily_reports?order=report_date.desc&limit=500`, {
        headers: {"apikey": SUPABASE_KEY, "Authorization": `Bearer ${token}`}
      });
      const d2 = await r2.json();
      setAllReports(Array.isArray(d2) ? d2 : []);
    }
  };

  useEffect(() => {
    loadReports().finally(() => setLoading(false));
  }, [isManager]);

  // ── Sync Google Calendar ──────────────────────────────────────
  const syncCalendar = async () => {
    setSyncing(true);
    setCalError(null);
    const session = JSON.parse(localStorage.getItem("sb_session") || "{}");
    const token = session.provider_token || session.access_token;

    if (!token) {
      setCalError("No Google token found. Please sign out and sign back in.");
      setSyncing(false);
      return;
    }

    try {
      const start = fmtDate(weekDates[0]) + "T00:00:00Z";
      const end   = fmtDate(weekDates[6]) + "T23:59:59Z";
      const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${start}&timeMax=${end}&singleEvents=true&orderBy=startTime&maxResults=100`;

      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || "Calendar sync failed");
      }
      const data = await res.json();
      const grouped = {};
      (data.items || []).forEach(ev => {
        const dateStr = (ev.start?.dateTime || ev.start?.date || "").split("T")[0];
        if (!dateStr) return;
        if (!grouped[dateStr]) grouped[dateStr] = [];
        grouped[dateStr].push({
          id: ev.id,
          title: ev.summary || "Untitled",
          description: ev.description || "",
          start: ev.start?.dateTime || ev.start?.date,
          end: ev.end?.dateTime || ev.end?.date,
          allDay: !!ev.start?.date && !ev.start?.dateTime,
        });
      });
      setEvents(prev => ({...prev, ...grouped}));
    } catch(e) {
      setCalError(e.message);
    }
    setSyncing(false);
  };

  useEffect(() => { syncCalendar(); }, [weekOffset]);

  // ── Share day to manager ──────────────────────────────────────
  const shareDay = async (dateStr) => {
    setSharing(dateStr);
    const session = JSON.parse(localStorage.getItem("sb_session") || "{}");
    const token = session.access_token || SUPABASE_KEY;
    const uid = getUserId();
    const stops = (events[dateStr] || []).map(ev => ({
      title: ev.title,
      description: ev.description,
      time: fmtTime(ev.start),
    }));

    // Get rep name from session
    let repName = "Rep";
    let repEmail = "";
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      repEmail = payload.email || "";
      repName = payload.user_metadata?.full_name || repEmail.split("@")[0] || "Rep";
    } catch {}

    try {
      await fetch(`${SUPABASE_URL}/rest/v1/daily_reports`, {
        method: "POST",
        headers: {
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "Prefer": "resolution=merge-duplicates,return=minimal"
        },
        body: JSON.stringify({
          user_id: uid,
          rep_name: repName,
          rep_email: repEmail,
          report_date: dateStr,
          stops: stops,
          notes: `${stops.length} stops logged`,
        })
      });
      await loadReports();
    } catch(e) { alert("Share failed: " + e.message); }
    setSharing(null);
  };

  // ── Is this date already shared? ─────────────────────────────
  const isShared = (dateStr) => reports.some(r => r.report_date === dateStr);

  // ── Manager: unique reps ──────────────────────────────────────
  const repList = ["All", ...new Set(allReports.map(r => r.rep_name))];

  const filteredReports = isManager
    ? (filterRep === "All" ? allReports : allReports.filter(r => r.rep_name === filterRep))
    : reports;

  if (loading) return (
    <div style={{height:"calc(100vh - 54px)",background:"#0a0a0a",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{color:"#e8e8e8",fontFamily:"'Bebas Neue',sans-serif",fontSize:24,letterSpacing:3}}>LOADING...</div>
    </div>
  );

  return (
    <div style={{background:"#0a0a0a",color:"#f5f5f5",fontFamily:"'DM Sans',sans-serif",minHeight:"calc(100vh - 54px)"}}>

      {/* ── Header bar ── */}
      <div style={{background:"#0d0d0d",borderBottom:"1px solid #1a1a1a",padding:"10px 24px",display:"flex",alignItems:"center",gap:16}}>
        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,letterSpacing:3,color:"#e8e8e8"}}>ACTIVITY LOG</div>
        <div style={{fontSize:10,color:"#444",fontFamily:"monospace",letterSpacing:2}}>GOOGLE CALENDAR SYNC</div>

        <div style={{marginLeft:"auto",display:"flex",gap:8,alignItems:"center"}}>
          {calError && <span style={{fontSize:10,color:"#cc2222",fontFamily:"monospace"}}>{calError}</span>}
          <button onClick={()=>setWeekOffset(0)} style={{padding:"5px 12px",background:weekOffset===0?"#1a1a1a":"transparent",border:"1px solid #2a2a2a",borderRadius:5,color:weekOffset===0?"#e8e8e8":"#555",cursor:"pointer",fontSize:11,fontFamily:"monospace"}}>TODAY</button>
          <button onClick={()=>setWeekOffset(w=>w-1)} style={{padding:"5px 10px",background:"transparent",border:"1px solid #2a2a2a",borderRadius:5,color:"#555",cursor:"pointer",fontSize:13}}>‹</button>
          <span style={{fontSize:11,color:"#444",fontFamily:"monospace",minWidth:160,textAlign:"center"}}>
            {fmtDisplay(weekDates[0])} – {fmtDisplay(weekDates[6])}
          </span>
          <button onClick={()=>setWeekOffset(w=>w+1)} style={{padding:"5px 10px",background:"transparent",border:"1px solid #2a2a2a",borderRadius:5,color:"#555",cursor:"pointer",fontSize:13}}>›</button>
          <button onClick={syncCalendar} disabled={syncing} style={{padding:"5px 14px",background:"#1a1a1a",border:"1px solid #333",borderRadius:5,color:syncing?"#444":"#e8e8e8",cursor:syncing?"wait":"pointer",fontSize:11,fontFamily:"monospace",letterSpacing:1}}>
            {syncing?"SYNCING...":"⟳ SYNC"}
          </button>
        </div>
      </div>

      <div style={{display:"flex",gap:0}}>

        {/* ── Weekly calendar ── */}
        <div style={{flex:1,padding:"20px 24px"}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:10}}>
            {weekDates.map((date, i) => {
              const ds = fmtDate(date);
              const isToday = ds === todayStr;
              const dayEvents = events[ds] || [];
              const shared = isShared(ds);
              const isPast = date < new Date() && !isToday;

              return (
                <div key={ds} style={{background:isToday?"#111":"#0d0d0d",border:`1px solid ${isToday?"#cc2222":"#1a1a1a"}`,borderRadius:8,padding:"12px 10px",minHeight:180}}>
                  {/* Day header */}
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                    <div>
                      <div style={{fontSize:9,color:isToday?"#cc2222":"#444",fontFamily:"monospace",letterSpacing:2}}>{DAY_NAMES[i]}</div>
                      <div style={{fontSize:18,fontFamily:"'Bebas Neue',sans-serif",color:isToday?"#e8e8e8":"#555",letterSpacing:1}}>{date.getDate()}</div>
                    </div>
                    {dayEvents.length > 0 && (
                      <button
                        onClick={() => shareDay(ds)}
                        disabled={sharing===ds}
                        style={{fontSize:8,padding:"3px 7px",background:shared?"#0a1a0a":"#1a0a0a",border:`1px solid ${shared?"#2a6a2a":"#cc2222"}`,borderRadius:4,color:shared?"#4a9a4a":"#cc2222",cursor:sharing===ds?"wait":"pointer",fontFamily:"monospace",letterSpacing:0.5}}>
                        {sharing===ds?"...":shared?"✓ SHARED":"SHARE"}
                      </button>
                    )}
                  </div>

                  {/* Events */}
                  {dayEvents.length === 0 ? (
                    <div style={{fontSize:10,color:"#252525",textAlign:"center",marginTop:20,fontFamily:"monospace"}}>—</div>
                  ) : (
                    dayEvents.map((ev, j) => (
                      <div key={j} style={{marginBottom:8,padding:"6px 8px",background:"#111",border:"1px solid #1e1e1e",borderLeft:`3px solid ${isToday?"#cc2222":"#333"}`,borderRadius:4}}>
                        <div style={{fontSize:11,fontWeight:600,color:"#e8e8e8",marginBottom:2}}>{ev.title}</div>
                        {!ev.allDay && <div style={{fontSize:9,color:"#555",fontFamily:"monospace",marginBottom:3}}>{fmtTime(ev.start)}{ev.end?" – "+fmtTime(ev.end):""}</div>}
                        {ev.description && <div style={{fontSize:10,color:"#666",lineHeight:1.4}}>{ev.description.slice(0,80)}{ev.description.length>80?"…":""}</div>}
                      </div>
                    ))
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Submitted reports sidebar ── */}
        <div style={{width:320,background:"#0d0d0d",borderLeft:"1px solid #1a1a1a",display:"flex",flexDirection:"column"}}>
          <div style={{padding:"12px 16px",borderBottom:"1px solid #1a1a1a",display:"flex",alignItems:"center",gap:8}}>
            <div style={{fontSize:10,color:"#555",fontFamily:"monospace",letterSpacing:2,flex:1}}>
              {isManager ? "ALL REP REPORTS" : "SUBMITTED REPORTS"}
            </div>
            {isManager && (
              <select value={filterRep} onChange={e=>setFilterRep(e.target.value)}
                style={{background:"#111",border:"1px solid #222",borderRadius:4,color:"#888",fontSize:10,padding:"3px 6px",fontFamily:"monospace"}}>
                {repList.map(r=><option key={r} value={r}>{r}</option>)}
              </select>
            )}
          </div>

          <div style={{overflowY:"auto",flex:1}}>
            {filteredReports.length === 0 ? (
              <div style={{padding:24,fontSize:11,color:"#333",fontFamily:"monospace",textAlign:"center"}}>No reports yet</div>
            ) : (
              filteredReports.map(rep => (
                <div key={rep.id} style={{padding:"12px 16px",borderBottom:"1px solid #141414"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                    <div style={{fontSize:11,fontWeight:600,color:"#e8e8e8"}}>{rep.report_date}</div>
                    {isManager && <div style={{fontSize:9,color:"#cc2222",fontFamily:"monospace",letterSpacing:1}}>{rep.rep_name}</div>}
                    <div style={{marginLeft:"auto",fontSize:9,color:"#333",fontFamily:"monospace"}}>{(rep.stops||[]).length} stops</div>
                  </div>
                  {(rep.stops||[]).map((stop, i) => (
                    <div key={i} style={{marginBottom:4,paddingLeft:8,borderLeft:"2px solid #1e1e1e"}}>
                      <div style={{fontSize:11,color:"#aaa"}}>{stop.title}</div>
                      {stop.time && <div style={{fontSize:9,color:"#444",fontFamily:"monospace"}}>{stop.time}</div>}
                      {stop.description && <div style={{fontSize:10,color:"#555",marginTop:1}}>{stop.description.slice(0,60)}{stop.description.length>60?"…":""}</div>}
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  ROUTE PLANNER  (Click-to-plan, save & launch in Waze/Maps)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function RoutePlanner() {
  const [companies, setCompanies]   = useState([]);
  const [stops, setStops]           = useState([]);       // ordered array of company objects
  const [savedRoutes, setSavedRoutes] = useState([]);
  const [routeName, setRouteName]   = useState("");
  const [saving, setSaving]         = useState(false);
  const [loading, setLoading]       = useState(true);
  const [activeDay, setActiveDay]   = useState("All");
  const [mapReady, setMapReady]     = useState(false);
  const [viewRoute, setViewRoute]   = useState(null);     // saved route being previewed
  const [showLasso, setShowLasso]   = useState(false);
  const mapDivRef  = useRef(null);
  const leafletRef = useRef(null);

  // ── Load companies from cache then Supabase ───────────────────
  useEffect(() => {
    const cacheKey = `companies_${getUserId()}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try { setCompanies(JSON.parse(cached)); setLoading(false); } catch {}
    }
    const token = JSON.parse(localStorage.getItem("sb_session")||"{}").access_token || SUPABASE_KEY;
    fetch(`${SUPABASE_URL}/rest/v1/companies?select=*&user_id=eq.${getUserId()}&order=id.asc&limit=1000`, {
      headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${token}` }
    })
    .then(r => r.json())
    .then(data => {
      if (Array.isArray(data)) {
        setCompanies(data);
        localStorage.setItem(cacheKey, JSON.stringify(data));
      }
      setLoading(false);
    })
    .catch(() => setLoading(false));
  }, []);

  // ── Load saved routes ─────────────────────────────────────────
  useEffect(() => {
    const token = JSON.parse(localStorage.getItem("sb_session")||"{}").access_token || SUPABASE_KEY;
    fetch(`${SUPABASE_URL}/rest/v1/user_settings?user_id=eq.${getUserId()}&key=like.route_%&order=created_at.desc&limit=50`, {
      headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${token}` }
    })
    .then(r => r.json())
    .then(d => {
      if (Array.isArray(d)) {
        setSavedRoutes(d.map(r => {
          try { return { id: r.id, key: r.key, ...JSON.parse(r.value) }; }
          catch { return null; }
        }).filter(Boolean));
      }
    })
    .catch(() => {});
  }, []);

  // ── Init Leaflet map ──────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    function initMap() {
      if (cancelled || !mapDivRef.current || leafletRef.current) return;
      if (mapDivRef.current.offsetWidth === 0) {
        setTimeout(() => { if (!cancelled) initMap(); }, 300);
        return;
      }
      const L = window.L;
      if (!L) return;

      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl:       "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl:     "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      });

      const map = L.map(mapDivRef.current, { center: [42.05, -73.15], zoom: 8 });
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: "© CARTO", maxZoom: 19
      }).addTo(map);

      leafletRef.current = {
        map,
        companyLayer: L.layerGroup().addTo(map),
        routeLayer:   L.layerGroup().addTo(map),
      };
      setTimeout(() => { map.invalidateSize(true); }, 100);
      setTimeout(() => { map.invalidateSize(true); }, 500);
      setMapReady(true);
    }

    if (window.L && mapDivRef.current) initMap();
    const poll = setInterval(() => {
      if (cancelled) { clearInterval(poll); return; }
      if (window.L && mapDivRef.current && !leafletRef.current) initMap();
      if (leafletRef.current) clearInterval(poll);
    }, 200);

    return () => { cancelled = true; clearInterval(poll); };
  }, []);

  // ── Render company pins + route on map ────────────────────────
  useEffect(() => {
    if (!mapReady || !leafletRef.current) return;
    const { map, companyLayer, routeLayer } = leafletRef.current;
    const L = window.L;
    if (!L) return;

    companyLayer.clearLayers();
    routeLayer.clearLayers();

    const filtered = companies.filter(c => {
      if (!c.lat || !c.lng) return false;
      if (activeDay !== "All" && c.day !== activeDay) return false;
      return true;
    });

    const stopIds = stops.map(s => s.id);

    filtered.forEach(c => {
      const isStop = stopIds.includes(c.id);
      const stopIdx = stopIds.indexOf(c.id);
      const dc = DAY_CONFIG[c.day] || DAY_CONFIG.Monday;
      const color = isStop ? "#cc2222" : dc.color;

      const icon = L.divIcon({
        className: "",
        iconSize: isStop ? [28, 36] : [18, 24],
        iconAnchor: isStop ? [14, 36] : [9, 24],
        popupAnchor: [0, -38],
        html: isStop
          ? `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
              <path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.3 21.7 0 14 0z" fill="#cc2222"/>
              <circle cx="14" cy="14" r="8" fill="#0a0a0a"/>
              <text x="14" y="18" text-anchor="middle" font-size="9" fill="#fff" font-weight="bold" font-family="Arial,sans-serif">${stopIdx + 1}</text>
            </svg>`
          : `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="24" viewBox="0 0 18 24">
              <path d="M9 0C4 0 0 4 0 9c0 6.75 9 15 9 15s9-8.25 9-15C18 4 14 0 9 0z" fill="${color}" opacity="0.7"/>
              <circle cx="9" cy="9" r="4" fill="#0a0a0a"/>
            </svg>`,
      });

      const marker = L.marker([c.lat, c.lng], { icon });

      marker.on("click", () => {
        setStops(prev => {
          const exists = prev.find(s => s.id === c.id);
          if (exists) {
            // Remove from route
            return prev.filter(s => s.id !== c.id);
          } else {
            // Add to route
            return [...prev, c];
          }
        });
      });

      marker.bindTooltip(`<div style="font-family:monospace;font-size:11px;background:#111;color:#f5f5f5;padding:4px 8px;border-radius:4px;border:1px solid #333">${isStop ? `#${stopIdx+1} · ` : ""}${c.name}<br><span style="color:#666;font-size:9px">${c.town} · click to ${isStop?"remove":"add"}</span></div>`, {
        permanent: false, direction: "top", className: "rp-tip"
      });

      companyLayer.addLayer(marker);
    });

    // Draw route line between stops
    if (stops.length >= 2) {
      const coords = stops.filter(s => s.lat && s.lng).map(s => [s.lat, s.lng]);
      L.polyline(coords, {
        color: "#cc2222",
        weight: 2.5,
        opacity: 0.7,
        dashArray: "6 5",
      }).addTo(routeLayer);
    }

    setTimeout(() => map.invalidateSize(), 50);
  }, [companies, stops, activeDay, mapReady]);

  // ── Build navigation URLs ─────────────────────────────────────
  const buildWazeUrl = () => {
    const valid = stops.filter(s => s.lat && s.lng);
    if (valid.length === 0) return null;
    if (valid.length === 1) {
      return `https://waze.com/ul?ll=${valid[0].lat},${valid[0].lng}&navigate=yes`;
    }
    // Waze supports: first stop + up to 3 waypoints via app deeplink
    const dest = valid[valid.length - 1];
    const waypoints = valid.slice(0, -1).map(s => `${s.lat},${s.lng}`).join("|");
    return `https://waze.com/ul?ll=${dest.lat},${dest.lng}&navigate=yes&waypoints=${waypoints}`;
  };

  const buildGoogleMapsUrl = () => {
    const valid = stops.filter(s => s.lat && s.lng);
    if (valid.length === 0) return null;
    const origin = valid[0];
    const dest = valid[valid.length - 1];
    const waypoints = valid.slice(1, -1).map(s => `${s.lat},${s.lng}`).join("|");
    let url = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${dest.lat},${dest.lng}&travelmode=driving`;
    if (waypoints) url += `&waypoints=${waypoints}`;
    return url;
  };

  // ── Save route ────────────────────────────────────────────────
  const saveRoute = async () => {
    if (stops.length === 0 || !routeName.trim()) return;
    setSaving(true);
    const token = JSON.parse(localStorage.getItem("sb_session")||"{}").access_token || SUPABASE_KEY;
    const key = `route_${Date.now()}`;
    const value = JSON.stringify({
      name: routeName.trim(),
      stops: stops.map(s => ({ id: s.id, name: s.name, town: s.town, lat: s.lat, lng: s.lng, phone: s.phone })),
      date: new Date().toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" }),
      stopCount: stops.length,
    });
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/user_settings`, {
        method: "POST",
        headers: {
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "Prefer": "return=representation",
        },
        body: JSON.stringify({ user_id: getUserId(), key, value }),
      });
      setSavedRoutes(prev => [{ key, name: routeName.trim(), stops: stops.map(s => ({ id: s.id, name: s.name, town: s.town, lat: s.lat, lng: s.lng, phone: s.phone })), date: new Date().toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" }), stopCount: stops.length }, ...prev]);
      setRouteName("");
      alert(`Route "${routeName.trim()}" saved!`);
    } catch(e) { alert("Save failed: " + e.message); }
    setSaving(false);
  };

  // ── Delete saved route ────────────────────────────────────────
  const deleteRoute = async (key) => {
    if (!confirm("Delete this route?")) return;
    const token = JSON.parse(localStorage.getItem("sb_session")||"{}").access_token || SUPABASE_KEY;
    await fetch(`${SUPABASE_URL}/rest/v1/user_settings?user_id=eq.${getUserId()}&key=eq.${key}`, {
      method: "DELETE",
      headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${token}` },
    });
    setSavedRoutes(prev => prev.filter(r => r.key !== key));
    if (viewRoute?.key === key) setViewRoute(null);
  };

  // ── Load saved route onto map ─────────────────────────────────
  const loadRoute = (route) => {
    setViewRoute(route);
    // Match saved stop IDs to current companies for full data
    const matched = route.stops.map(s => companies.find(c => c.id === s.id) || s);
    setStops(matched);
  };

  const wazeUrl = buildWazeUrl();
  const mapsUrl = buildGoogleMapsUrl();

  if (loading) return (
    <div style={{height:"calc(100vh - 54px)",background:"#0a0a0a",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{color:"#e8e8e8",fontFamily:"'Bebas Neue',sans-serif",fontSize:24,letterSpacing:3}}>LOADING...</div>
    </div>
  );

  return (
    <div style={{background:"#0a0a0a",color:"#f5f5f5",fontFamily:"'DM Sans',sans-serif"}}>
      <style>{`.rp-tip { background: transparent !important; border: none !important; box-shadow: none !important; }`}</style>

      {/* ── Filter bar ── */}
      <div style={{background:"#0d0d0d",borderBottom:"1px solid #1a1a1a",padding:"10px 24px",display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
        <span style={{color:"#444",fontSize:10,fontFamily:"monospace",letterSpacing:2}}>FILTER BY DAY:</span>
        <button onClick={()=>setActiveDay("All")} style={{padding:"5px 12px",borderRadius:5,border:`1px solid ${activeDay==="All"?"#e8e8e8":"#222"}`,background:activeDay==="All"?"#1a1a1a":"transparent",color:activeDay==="All"?"#fff":"#444",cursor:"pointer",fontSize:11,fontWeight:700}}>ALL</button>
        {Object.entries(DAY_CONFIG).map(([day,dc])=>{
          const active = activeDay===day;
          return (
            <button key={day} onClick={()=>setActiveDay(active?"All":day)}
              style={{padding:"5px 12px",borderRadius:5,border:`1px solid ${active?dc.color:dc.border}`,background:active?dc.bg:"transparent",color:active?dc.color:dc.border,cursor:"pointer",fontSize:11,fontWeight:700,boxShadow:active?`0 0 8px ${dc.color}44`:"none"}}>
              {dc.label} <span style={{opacity:.5,fontSize:9}}>{dc.desc}</span>
            </button>
          );
        })}
        <div style={{marginLeft:"auto",display:"flex",gap:8,alignItems:"center"}}>
          <span style={{fontSize:10,color:"#444",fontFamily:"monospace"}}>
            {stops.length} STOP{stops.length!==1?"S":""} PLANNED
          </span>
          <button onClick={()=>setShowLasso(true)} style={{padding:"5px 14px",background:"#1a0a0a",border:"1px solid #cc2222",borderRadius:5,color:"#cc2222",cursor:"pointer",fontSize:10,fontFamily:"monospace",fontWeight:700,letterSpacing:1}}>
            ⭕ LASSO
          </button>
          {stops.length > 0 && (
            <button onClick={()=>setStops([])} style={{padding:"5px 10px",background:"none",border:"1px solid #2a2a2a",borderRadius:5,color:"#555",cursor:"pointer",fontSize:10,fontFamily:"monospace"}}>
              CLEAR
            </button>
          )}
        </div>
      </div>

      {/* ── Main layout ── */}
      <div style={{display:"flex",height:"calc(100vh - 110px)"}}>

        {/* ── Left sidebar: stop list + saved routes ── */}
        <div style={{width:300,background:"#0d0d0d",borderRight:"1px solid #1a1a1a",display:"flex",flexDirection:"column",overflow:"hidden",flexShrink:0}}>

          {/* Current route stops */}
          <div style={{borderBottom:"1px solid #1a1a1a",flex:stops.length>0?1:0,overflow:"auto",minHeight:stops.length>0?120:0,transition:"all .2s"}}>
            <div style={{padding:"8px 12px",background:"#0a0a0a",borderBottom:"1px solid #151515",display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:9,color:"#cc2222",fontFamily:"monospace",letterSpacing:2,fontWeight:700}}>CURRENT ROUTE</span>
              <span style={{fontSize:9,color:"#333",fontFamily:"monospace",marginLeft:"auto"}}>{stops.length} stops</span>
            </div>
            {stops.length === 0 ? (
              <div style={{padding:"20px 12px",fontSize:11,color:"#2a2a2a",fontFamily:"monospace",textAlign:"center",lineHeight:1.8}}>
                Click pins on the map<br/>to build your route
              </div>
            ) : (
              stops.map((s, i) => (
                <div key={s.id||i} style={{padding:"8px 12px",borderBottom:"1px solid #141414",display:"flex",alignItems:"center",gap:8}}>
                  <div style={{width:20,height:20,borderRadius:"50%",background:"#cc2222",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    <span style={{fontSize:9,color:"#fff",fontWeight:700,fontFamily:"monospace"}}>{i+1}</span>
                  </div>
                  <div style={{flex:1,overflow:"hidden"}}>
                    <div style={{fontSize:11,fontWeight:600,color:"#e8e8e8",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.name}</div>
                    <div style={{fontSize:9,color:"#555",fontFamily:"monospace"}}>{s.town}</div>
                  </div>
                  <div style={{display:"flex",gap:4,flexShrink:0}}>
                    {i > 0 && (
                      <button onClick={()=>setStops(prev=>{const a=[...prev];[a[i-1],a[i]]=[a[i],a[i-1]];return a;})}
                        style={{background:"none",border:"1px solid #222",borderRadius:3,color:"#444",cursor:"pointer",fontSize:10,padding:"1px 4px"}}>↑</button>
                    )}
                    {i < stops.length-1 && (
                      <button onClick={()=>setStops(prev=>{const a=[...prev];[a[i],a[i+1]]=[a[i+1],a[i]];return a;})}
                        style={{background:"none",border:"1px solid #222",borderRadius:3,color:"#444",cursor:"pointer",fontSize:10,padding:"1px 4px"}}>↓</button>
                    )}
                    <button onClick={()=>setStops(prev=>prev.filter((_,j)=>j!==i))}
                      style={{background:"none",border:"1px solid #2a1a1a",borderRadius:3,color:"#553333",cursor:"pointer",fontSize:9,padding:"1px 4px"}}>✕</button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Launch + Save */}
          {stops.length > 0 && (
            <div style={{padding:"10px 12px",borderBottom:"1px solid #1a1a1a",background:"#0a0a0a"}}>
              <div style={{display:"flex",gap:6,marginBottom:8}}>
                {wazeUrl && (
                  <a href={wazeUrl} target="_blank" rel="noreferrer"
                    style={{flex:1,padding:"9px 0",background:"#05c8f7",borderRadius:6,color:"#000",fontWeight:700,fontSize:12,textDecoration:"none",textAlign:"center",display:"block"}}>
                    🚗 Waze
                  </a>
                )}
                {mapsUrl && (
                  <a href={mapsUrl} target="_blank" rel="noreferrer"
                    style={{flex:1,padding:"9px 0",background:"#1a1a1a",border:"1px solid #333",borderRadius:6,color:"#888",fontSize:12,textDecoration:"none",textAlign:"center",display:"block"}}>
                    🗺 Maps
                  </a>
                )}
              </div>
              <div style={{display:"flex",gap:6}}>
                <input
                  value={routeName}
                  onChange={e=>setRouteName(e.target.value)}
                  placeholder="Name this route..."
                  style={{flex:1,background:"#111",border:"1px solid #2a2a2a",borderRadius:5,color:"#e8e8e8",padding:"6px 8px",fontSize:11,outline:"none",fontFamily:"'DM Sans',sans-serif"}}
                />
                <button onClick={saveRoute} disabled={!routeName.trim()||saving}
                  style={{padding:"6px 10px",background:routeName.trim()?"#cc2222":"#1a1a1a",border:"none",borderRadius:5,color:routeName.trim()?"#fff":"#444",cursor:routeName.trim()?"pointer":"default",fontSize:11,fontWeight:700,flexShrink:0}}>
                  {saving?"...":"Save"}
                </button>
              </div>
            </div>
          )}

          {/* Saved routes */}
          <div style={{flex:1,overflowY:"auto"}}>
            <div style={{padding:"8px 12px",background:"#0a0a0a",borderBottom:"1px solid #151515",position:"sticky",top:0}}>
              <span style={{fontSize:9,color:"#444",fontFamily:"monospace",letterSpacing:2}}>SAVED ROUTES ({savedRoutes.length})</span>
            </div>
            {savedRoutes.length === 0 ? (
              <div style={{padding:"20px 12px",fontSize:10,color:"#252525",fontFamily:"monospace",textAlign:"center"}}>No saved routes yet</div>
            ) : (
              savedRoutes.map(route => (
                <div key={route.key} style={{padding:"10px 12px",borderBottom:"1px solid #141414",background:viewRoute?.key===route.key?"#110a0a":"transparent"}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                    <span style={{fontSize:12,fontWeight:600,color:"#e8e8e8",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{route.name}</span>
                    <button onClick={()=>deleteRoute(route.key)} style={{background:"none",border:"none",color:"#333",cursor:"pointer",fontSize:10,flexShrink:0}} onMouseEnter={e=>e.currentTarget.style.color="#cc2222"} onMouseLeave={e=>e.currentTarget.style.color="#333"}>✕</button>
                  </div>
                  <div style={{fontSize:9,color:"#444",fontFamily:"monospace",marginBottom:6}}>{route.date} · {route.stopCount||route.stops?.length||0} stops</div>
                  <div style={{display:"flex",gap:5}}>
                    <button onClick={()=>loadRoute(route)}
                      style={{flex:1,padding:"5px 0",background:"#1a1a1a",border:"1px solid #cc2222",borderRadius:4,color:"#cc2222",cursor:"pointer",fontSize:10,fontFamily:"monospace",letterSpacing:1}}>
                      LOAD
                    </button>
                    {route.stops?.length > 0 && route.stops[0].lat && (
                      <a href={`https://www.google.com/maps/dir/?api=1&origin=${route.stops[0].lat},${route.stops[0].lng}&destination=${route.stops[route.stops.length-1].lat},${route.stops[route.stops.length-1].lng}&travelmode=driving${route.stops.length>2?"&waypoints="+route.stops.slice(1,-1).map(s=>`${s.lat},${s.lng}`).join("|"):""}`}
                        target="_blank" rel="noreferrer"
                        style={{flex:1,padding:"5px 0",background:"#05c8f7",borderRadius:4,color:"#000",fontWeight:700,fontSize:10,textDecoration:"none",textAlign:"center",display:"block"}}>
                        GO
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Map ── */}
        <div style={{flex:1,position:"relative",overflow:"hidden"}}>
          <div ref={mapDivRef} style={{width:"100%",height:"100%",minHeight:"400px"}}/>

          {/* Instructions overlay — shown when no stops yet */}
          {stops.length === 0 && mapReady && (
            <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",background:"rgba(10,10,10,0.85)",border:"1px solid #1e1e1e",borderRadius:10,padding:"20px 28px",textAlign:"center",pointerEvents:"none",zIndex:900}}>
              <div style={{fontSize:28,marginBottom:8}}>📍</div>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:3,color:"#e8e8e8",marginBottom:6}}>PLAN YOUR ROUTE</div>
              <div style={{fontSize:11,color:"#555",lineHeight:1.7,fontFamily:"monospace"}}>
                Click any pin to add it as a stop.<br/>
                Click again to remove it.<br/>
                Use ↑↓ in the sidebar to reorder.
              </div>
            </div>
          )}

          {/* Legend */}
          <div style={{position:"absolute",top:12,right:12,background:"rgba(10,10,10,0.92)",border:"1px solid #1e1e1e",borderRadius:8,padding:"10px 14px",zIndex:1000,pointerEvents:"none"}}>
            <div style={{color:"#444",fontSize:9,fontFamily:"monospace",letterSpacing:1,marginBottom:6}}>ROUTE PLANNER</div>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
              <div style={{width:10,height:10,borderRadius:"50%",background:"#cc2222"}}/>
              <span style={{fontSize:10,color:"#cc2222",fontFamily:"monospace"}}>Route stop (numbered)</span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:"#4a9eff",opacity:0.7}}/>
              <span style={{fontSize:10,color:"#555",fontFamily:"monospace"}}>Available company</span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <div style={{width:14,height:2,background:"#cc2222",opacity:0.7,borderTop:"2px dashed #cc2222"}}/>
              <span style={{fontSize:10,color:"#555",fontFamily:"monospace"}}>Planned route</span>
            </div>
            {stops.length > 0 && (
              <div style={{marginTop:8,paddingTop:8,borderTop:"1px solid #1a1a1a",fontSize:9,color:"#cc2222",fontFamily:"monospace",letterSpacing:1}}>
                {stops.length} STOP{stops.length!==1?"S":""} PLANNED
              </div>
            )}
          </div>
        </div>
      </div>
      {showLasso && (
        <LassoModal
          companies={companies}
          onClose={() => setShowLasso(false)}
          onAccept={(route) => { setStops(route); setShowLasso(false); }}
        />
      )}
    </div>
  );
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  CHECK-IN  (GPS-verified rep location tracking)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Haversine distance in feet between two lat/lng points
function distanceFeet(lat1, lng1, lat2, lng2) {
  const R = 20925524; // Earth radius in feet
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 +
    Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

const CHECK_IN_RADIUS_FT = 1000; // within 1000 feet = valid check-in

function CheckIn() {
  const [companies, setCompanies]     = useState([]);
  const [checkIns, setCheckIns]       = useState([]);
  const [allCheckIns, setAllCheckIns] = useState([]);
  const [isManager, setIsManager]     = useState(false);
  const [loading, setLoading]         = useState(true);
  const [locating, setLocating]       = useState(false);
  const [activeDay, setActiveDay]     = useState("All");
  const [search, setSearch]           = useState("");
  const [filterRep, setFilterRep]     = useState("All");
  const [filterDate, setFilterDate]   = useState("");
  const [currentPos, setCurrentPos]   = useState(null);
  const [posError, setPosError]       = useState(null);
  const [checkingIn, setCheckingIn]   = useState(null); // company id being checked in
  const [successId, setSuccessId]     = useState(null); // recently checked in company id
  const [activeTab, setActiveTab]     = useState("checkin"); // checkin | history
  const [checkInFormTarget, setCheckInFormTarget] = useState(null);

  const token = JSON.parse(localStorage.getItem("sb_session")||"{}").access_token || SUPABASE_KEY;

  // ── Check if manager ─────────────────────────────────────────
  useEffect(() => {
    const uid = getUserId();
    if (!uid) return;
    fetch(`${SUPABASE_URL}/rest/v1/user_settings?user_id=eq.${uid}&key=eq.role&select=value`, {
      headers: {"apikey": SUPABASE_KEY, "Authorization": `Bearer ${token}`}
    })
    .then(r => r.json())
    .then(d => { if (d?.[0]?.value === "manager") setIsManager(true); })
    .catch(() => {});
  }, []);

  // ── Load companies ────────────────────────────────────────────
  useEffect(() => {
    const cacheKey = `companies_${getUserId()}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try { setCompanies(JSON.parse(cached)); } catch {}
    }
    fetch(`${SUPABASE_URL}/rest/v1/companies?select=*&user_id=eq.${getUserId()}&order=id.asc&limit=1000`, {
      headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${token}` }
    })
    .then(r => r.json())
    .then(data => { if (Array.isArray(data)) setCompanies(data); })
    .catch(() => {});
  }, []);

  // ── Load check-ins ────────────────────────────────────────────
  const loadCheckIns = async () => {
    const uid = getUserId();
    // Own check-ins
    const r = await fetch(`${SUPABASE_URL}/rest/v1/check_ins?user_id=eq.${uid}&order=checked_in_at.desc&limit=200`, {
      headers: {"apikey": SUPABASE_KEY, "Authorization": `Bearer ${token}`}
    });
    const d = await r.json();
    setCheckIns(Array.isArray(d) ? d : []);

    // Manager: all check-ins
    if (isManager) {
      const r2 = await fetch(`${SUPABASE_URL}/rest/v1/check_ins?order=checked_in_at.desc&limit=1000`, {
        headers: {"apikey": SUPABASE_KEY, "Authorization": `Bearer ${token}`}
      });
      const d2 = await r2.json();
      setAllCheckIns(Array.isArray(d2) ? d2 : []);
    }
  };

  useEffect(() => {
    loadCheckIns().finally(() => setLoading(false));
  }, [isManager]);

  // ── Get current GPS position ──────────────────────────────────
  const getPosition = () => new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation not supported on this device."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      err => reject(new Error(err.code === 1 ? "Location permission denied. Enable in browser settings." :
                              err.code === 2 ? "Location unavailable. Try again." :
                              "Location timed out. Try again.")),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });

  // ── Manual check-in ───────────────────────────────────────────
  const handleCheckIn = async (company) => {
    setCheckingIn(company.id);
    setPosError(null);
    setLocating(true);

    try {
      const pos = await getPosition();
      setCurrentPos(pos);
      setLocating(false);

      if (!company.lat || !company.lng) {
        // No coords on file — check in without distance verification
        await submitCheckIn(company, pos, null, "no_coords");
        return;
      }

      const dist = distanceFeet(pos.lat, pos.lng, company.lat, company.lng);
      const verified = dist <= CHECK_IN_RADIUS_FT;
      await submitCheckIn(company, pos, Math.round(dist), verified ? "verified" : "out_of_range");

    } catch(e) {
      setPosError(e.message);
      setLocating(false);
    } finally {
      setCheckingIn(null);
    }
  };

  const submitCheckIn = async (company, pos, distFt, status) => {
    const uid = getUserId();
    let repName = "Rep", repEmail = "";
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      repEmail = payload.email || "";
      repName = payload.user_metadata?.full_name || repEmail.split("@")[0] || "Rep";
    } catch {}

    const body = {
      user_id:        uid,
      rep_name:       repName,
      rep_email:      repEmail,
      company_id:     company.id,
      company_name:   company.name,
      company_town:   company.town,
      company_lat:    company.lat || null,
      company_lng:    company.lng || null,
      rep_lat:        pos.lat,
      rep_lng:        pos.lng,
      gps_accuracy_m: Math.round(pos.accuracy || 0),
      distance_ft:    distFt,
      status:         status,
      checked_in_at:  new Date().toISOString(),
      notes:          "",
    };

    try {
      await fetch(`${SUPABASE_URL}/rest/v1/check_ins`, {
        method: "POST",
        headers: {
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "Prefer": "return=minimal",
        },
        body: JSON.stringify(body),
      });
      setSuccessId(company.id);
      setTimeout(() => setSuccessId(null), 3000);
      await loadCheckIns();
    } catch(e) {
      alert("Check-in failed: " + e.message);
    }
  };

  // ── Helpers ───────────────────────────────────────────────────
  const todayStr = new Date().toISOString().split("T")[0];

  const filteredCompanies = companies.filter(c => {
    if (activeDay !== "All" && c.day !== activeDay) return false;
    if (search && !c.name?.toLowerCase().includes(search.toLowerCase()) &&
        !c.town?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const todayCheckIns = checkIns.filter(c => c.checked_in_at?.startsWith(todayStr));

  const historyData = isManager ? allCheckIns : checkIns;
  const filteredHistory = historyData.filter(ci => {
    if (filterRep !== "All" && ci.rep_name !== filterRep) return false;
    if (filterDate && !ci.checked_in_at?.startsWith(filterDate)) return false;
    return true;
  });

  const repList = ["All", ...new Set(allCheckIns.map(r => r.rep_name).filter(Boolean))];

  const fmtTime = (iso) => {
    if (!iso) return "";
    try { return new Date(iso).toLocaleTimeString("en-US", {hour:"numeric", minute:"2-digit", hour12:true}); }
    catch { return ""; }
  };

  const fmtDateShort = (iso) => {
    if (!iso) return "";
    try { return new Date(iso).toLocaleDateString("en-US", {month:"short", day:"numeric"}); }
    catch { return ""; }
  };

  const statusStyle = (s) => ({
    verified:    { color:"#4ae87a", bg:"#0a1a0f", border:"#1a6b35", label:"✓ VERIFIED" },
    out_of_range:{ color:"#e8873a", bg:"#1a0d00", border:"#6b3010", label:"⚠ FAR" },
    no_coords:   { color:"#888",    bg:"#1a1a1a", border:"#333",    label:"• LOGGED" },
  }[s] || { color:"#888", bg:"#111", border:"#222", label:s?.toUpperCase()||"?" });

  // Check if already checked in today
  const checkedInToday = (companyId) => todayCheckIns.some(ci => ci.company_id === companyId);

  if (loading) return (
    <div style={{height:"calc(100vh - 54px)",background:"#0a0a0a",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{color:"#e8e8e8",fontFamily:"'Bebas Neue',sans-serif",fontSize:24,letterSpacing:3}}>LOADING...</div>
    </div>
  );

  return (
    <div style={{background:"#0a0a0a",color:"#f5f5f5",fontFamily:"'DM Sans',sans-serif",minHeight:"calc(100vh - 54px)"}}>

      {/* ── Header ── */}
      <div style={{background:"#0d0d0d",borderBottom:"1px solid #1a1a1a",padding:"10px 24px",display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,letterSpacing:3,color:"#e8e8e8"}}>CHECK-IN</div>
        <div style={{fontSize:10,color:"#444",fontFamily:"monospace",letterSpacing:2}}>GPS-VERIFIED SITE VISITS</div>

        {/* Tab toggle */}
        <div style={{display:"flex",gap:0,background:"#111",border:"1px solid #1a1a1a",borderRadius:6,overflow:"hidden",marginLeft:16}}>
          {[["checkin","📍 Check In"],["history","📋 History"]].map(([tab,label])=>(
            <button key={tab} onClick={()=>setActiveTab(tab)}
              style={{padding:"6px 16px",background:activeTab===tab?"#1a1a1a":"transparent",border:"none",color:activeTab===tab?"#e8e8e8":"#444",cursor:"pointer",fontSize:11,fontFamily:"monospace",letterSpacing:1,borderRight:"1px solid #1a1a1a"}}>
              {label}
            </button>
          ))}
        </div>

        <div style={{marginLeft:"auto",display:"flex",gap:12,alignItems:"center"}}>
          {/* Today's stats */}
          <div style={{textAlign:"center"}}>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:"#4ae87a",lineHeight:1}}>{todayCheckIns.length}</div>
            <div style={{fontSize:8,color:"#444",fontFamily:"monospace",letterSpacing:1}}>TODAY</div>
          </div>
          <div style={{textAlign:"center"}}>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:"#4a9eff",lineHeight:1}}>{checkIns.length}</div>
            <div style={{fontSize:8,color:"#444",fontFamily:"monospace",letterSpacing:1}}>TOTAL</div>
          </div>
        </div>
      </div>

      {/* ── GPS Error Banner ── */}
      {posError && (
        <div style={{background:"#1a0a0a",borderBottom:"1px solid #cc2222",padding:"8px 24px",fontSize:12,color:"#cc6666",fontFamily:"monospace",display:"flex",alignItems:"center",gap:10}}>
          ⚠ {posError}
          <button onClick={()=>setPosError(null)} style={{background:"none",border:"none",color:"#555",cursor:"pointer",marginLeft:"auto",fontSize:12}}>✕</button>
        </div>
      )}

      {/* ── CHECK-IN TAB ── */}
      {activeTab === "checkin" && (
        <div style={{display:"flex",height:"calc(100vh - 160px)"}}>

          {/* Sidebar filters */}
          <div style={{width:280,background:"#0d0d0d",borderRight:"1px solid #1a1a1a",display:"flex",flexDirection:"column",flexShrink:0}}>
            <div style={{padding:"8px 12px",borderBottom:"1px solid #1a1a1a",display:"flex",gap:8,alignItems:"center"}}>
              <input placeholder="Search company..." value={search} onChange={e=>setSearch(e.target.value)}
                style={{flex:1,background:"#1a1a1a",border:"1px solid #282828",borderRadius:5,color:"#f5f5f5",padding:"6px 10px",fontSize:12,outline:"none"}}/>
            </div>
            <div style={{padding:"6px 12px",borderBottom:"1px solid #141414",display:"flex",gap:4,flexWrap:"wrap"}}>
              <button onClick={()=>setActiveDay("All")} style={{padding:"3px 8px",borderRadius:4,border:`1px solid ${activeDay==="All"?"#e8e8e8":"#222"}`,background:"transparent",color:activeDay==="All"?"#fff":"#444",cursor:"pointer",fontSize:9,fontFamily:"monospace"}}>ALL</button>
              {Object.entries(DAY_CONFIG).map(([day,dc])=>(
                <button key={day} onClick={()=>setActiveDay(activeDay===day?"All":day)}
                  style={{padding:"3px 8px",borderRadius:4,border:`1px solid ${activeDay===day?dc.color:dc.border}`,background:"transparent",color:activeDay===day?dc.color:dc.border,cursor:"pointer",fontSize:9,fontFamily:"monospace"}}>
                  {dc.label}
                </button>
              ))}
            </div>
            <div style={{overflowY:"auto",flex:1}}>
              {filteredCompanies.length === 0 ? (
                <div style={{padding:20,fontSize:11,color:"#333",textAlign:"center",fontFamily:"monospace"}}>No companies found</div>
              ) : (
                filteredCompanies.map(c => {
                  const dc = DAY_CONFIG[c.day] || DAY_CONFIG.Monday;
                  const isChecking = checkingIn === c.id;
                  const isSuccess  = successId === c.id;
                  const doneToday  = checkedInToday(c.id);

                  return (
                    <div key={c.id} style={{padding:"10px 12px",borderBottom:"1px solid #141414",background:isSuccess?"#0a1a0f":doneToday?"#0d0d12":"transparent",transition:"background .3s"}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{flex:1,overflow:"hidden"}}>
                          <div style={{fontSize:12,fontWeight:600,color:isSuccess?"#4ae87a":doneToday?"#4a9eff":"#e8e8e8",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                            {TYPE_ICONS[c.type]||"🏗"} {c.name}
                          </div>
                          <div style={{fontSize:10,color:"#555",marginTop:1}}>
                            <span style={{color:dc.color,fontFamily:"monospace",fontSize:9}}>{dc.label}</span>
                            {" · "}{c.town}
                            {doneToday && <span style={{color:"#4a9eff",marginLeft:6,fontSize:9}}>✓ today</span>}
                          </div>
                        </div>
                        <button
                          onClick={() => setCheckInFormTarget(c)}
                          disabled={isChecking || locating}
                          style={{
                            padding:"7px 12px",
                            background: isSuccess ? "#0a3a1a" : doneToday ? "#0d1a2e" : "#cc2222",
                            border: `1px solid ${isSuccess?"#2a6a3a":doneToday?"#1a4a6a":"#cc2222"}`,
                            borderRadius:6,
                            color: isSuccess ? "#4ae87a" : doneToday ? "#4a9eff" : "#fff",
                            cursor: isChecking ? "wait" : "pointer",
                            fontSize:10,
                            fontFamily:"monospace",
                            fontWeight:700,
                            letterSpacing:1,
                            flexShrink:0,
                            minWidth:70,
                            textAlign:"center",
                          }}>
                          {isChecking ? "📡 GPS..." : isSuccess ? "✓ IN" : doneToday ? "↩ AGAIN" : "CHECK IN"}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Today's check-ins panel */}
          <div style={{flex:1,padding:"20px 24px",overflowY:"auto"}}>
            <div style={{marginBottom:16,display:"flex",alignItems:"center",gap:12}}>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:3,color:"#e8e8e8"}}>
                TODAY'S VISITS
              </div>
              <div style={{fontSize:10,color:"#444",fontFamily:"monospace"}}>
                {new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}
              </div>
            </div>

            {/* GPS accuracy indicator */}
            {currentPos && (
              <div style={{marginBottom:16,padding:"8px 14px",background:"#0a1a0f",border:"1px solid #1a4a2a",borderRadius:6,display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:16}}>📍</span>
                <div>
                  <div style={{fontSize:11,color:"#4ae87a",fontFamily:"monospace"}}>GPS ACTIVE · ±{Math.round(currentPos.accuracy||0)}m accuracy</div>
                  <div style={{fontSize:9,color:"#555",fontFamily:"monospace"}}>{currentPos.lat.toFixed(5)}, {currentPos.lng.toFixed(5)}</div>
                </div>
              </div>
            )}

            {todayCheckIns.length === 0 ? (
              <div style={{textAlign:"center",padding:"60px 20px",color:"#252525",fontFamily:"monospace",fontSize:12,lineHeight:2}}>
                No check-ins yet today.<br/>
                <span style={{color:"#1a1a1a"}}>Select a company from the list and tap CHECK IN.</span>
              </div>
            ) : (
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:12}}>
                {todayCheckIns.map(ci => {
                  const ss = statusStyle(ci.status);
                  return (
                    <div key={ci.id} style={{background:"#0d0d0d",border:`1px solid ${ss.border}`,borderRadius:8,padding:"14px 16px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                        <div style={{fontSize:9,padding:"2px 7px",borderRadius:3,background:ss.bg,border:`1px solid ${ss.border}`,color:ss.color,fontFamily:"monospace",letterSpacing:1}}>
                          {ss.label}
                        </div>
                        <div style={{marginLeft:"auto",fontSize:10,color:"#555",fontFamily:"monospace"}}>{fmtTime(ci.checked_in_at)}</div>
                      </div>
                      <div style={{fontSize:14,fontWeight:600,color:"#e8e8e8",marginBottom:2}}>{ci.company_name}</div>
                      <div style={{fontSize:11,color:"#555",marginBottom:6}}>{ci.company_town}</div>
                      {ci.distance_ft !== null && ci.distance_ft !== undefined && (
                        <div style={{fontSize:10,color:ci.distance_ft<=CHECK_IN_RADIUS_FT?"#4ae87a":"#e8873a",fontFamily:"monospace"}}>
                          📍 {ci.distance_ft.toLocaleString()} ft from pin
                          {ci.distance_ft > CHECK_IN_RADIUS_FT && <span style={{color:"#555"}}> (outside radius)</span>}
                        </div>
                      )}
                      {ci.status === "no_coords" && (
                        <div style={{fontSize:10,color:"#555",fontFamily:"monospace"}}>No pin coords on file</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── HISTORY TAB ── */}
      {activeTab === "history" && (
        <div style={{padding:"20px 24px"}}>

          {/* Filters */}
          <div style={{display:"flex",gap:10,marginBottom:16,alignItems:"center",flexWrap:"wrap"}}>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:3,color:"#e8e8e8",marginRight:8}}>
              {isManager ? "ALL REP CHECK-INS" : "MY HISTORY"}
            </div>
            {isManager && (
              <select value={filterRep} onChange={e=>setFilterRep(e.target.value)}
                style={{background:"#111",border:"1px solid #222",borderRadius:5,color:"#888",fontSize:11,padding:"6px 10px",fontFamily:"monospace",outline:"none"}}>
                {repList.map(r=><option key={r} value={r}>{r}</option>)}
              </select>
            )}
            <input type="date" value={filterDate} onChange={e=>setFilterDate(e.target.value)}
              style={{background:"#111",border:"1px solid #222",borderRadius:5,color:"#888",fontSize:11,padding:"6px 10px",fontFamily:"monospace",outline:"none"}}/>
            {filterDate && <button onClick={()=>setFilterDate("")} style={{background:"none",border:"1px solid #222",borderRadius:4,color:"#555",cursor:"pointer",fontSize:10,padding:"5px 8px"}}>Clear</button>}
            <span style={{marginLeft:"auto",fontSize:10,color:"#444",fontFamily:"monospace"}}>{filteredHistory.length} check-ins</span>
          </div>

          {/* Stats row for managers */}
          {isManager && (
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:10,marginBottom:20}}>
              {repList.filter(r=>r!=="All").map(rep => {
                const repCIs = allCheckIns.filter(ci => ci.rep_name === rep);
                const todayCIs = repCIs.filter(ci => ci.checked_in_at?.startsWith(todayStr));
                const verified = repCIs.filter(ci => ci.status === "verified").length;
                return (
                  <div key={rep} style={{background:"#0d0d0d",border:"1px solid #1a1a1a",borderRadius:8,padding:"12px 14px"}}>
                    <div style={{fontSize:11,fontWeight:600,color:"#e8e8e8",marginBottom:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{rep}</div>
                    <div style={{display:"flex",gap:8}}>
                      <div style={{textAlign:"center"}}>
                        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color:"#4ae87a",lineHeight:1}}>{todayCIs.length}</div>
                        <div style={{fontSize:7,color:"#444",fontFamily:"monospace"}}>TODAY</div>
                      </div>
                      <div style={{textAlign:"center"}}>
                        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color:"#4a9eff",lineHeight:1}}>{repCIs.length}</div>
                        <div style={{fontSize:7,color:"#444",fontFamily:"monospace"}}>TOTAL</div>
                      </div>
                      <div style={{textAlign:"center"}}>
                        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color:"#4ae87a",lineHeight:1}}>{repCIs.length>0?Math.round(verified/repCIs.length*100):0}%</div>
                        <div style={{fontSize:7,color:"#444",fontFamily:"monospace"}}>VERIFIED</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Check-in history table */}
          {filteredHistory.length === 0 ? (
            <div style={{textAlign:"center",padding:60,color:"#252525",fontFamily:"monospace",fontSize:12}}>No check-ins found.</div>
          ) : (
            <div style={{background:"#0d0d0d",border:"1px solid #1a1a1a",borderRadius:8,overflow:"hidden"}}>
              <div style={{display:"grid",gridTemplateColumns:isManager?"2fr 1.2fr 1fr 1fr 1fr":"2fr 1fr 1fr 1fr",gap:0,padding:"8px 16px",borderBottom:"1px solid #1a1a1a"}}>
                {(isManager ? ["COMPANY","REP","DATE / TIME","DISTANCE","STATUS"] : ["COMPANY","DATE / TIME","DISTANCE","STATUS"]).map(h=>(
                  <div key={h} style={{fontSize:9,color:"#444",fontFamily:"monospace",letterSpacing:1}}>{h}</div>
                ))}
              </div>
              {filteredHistory.map((ci, i) => {
                const ss = statusStyle(ci.status);
                return (
                  <div key={ci.id||i} style={{display:"grid",gridTemplateColumns:isManager?"2fr 1.2fr 1fr 1fr 1fr":"2fr 1fr 1fr 1fr",gap:0,padding:"10px 16px",borderBottom:"1px solid #111",background:i%2===0?"transparent":"#080808"}}>
                    <div>
                      <div style={{fontSize:12,fontWeight:600,color:"#e8e8e8"}}>{ci.company_name}</div>
                      <div style={{fontSize:10,color:"#555"}}>{ci.company_town}</div>
                    </div>
                    {isManager && <div style={{fontSize:11,color:"#888",alignSelf:"center"}}>{ci.rep_name}</div>}
                    <div style={{alignSelf:"center"}}>
                      <div style={{fontSize:11,color:"#666"}}>{fmtDateShort(ci.checked_in_at)}</div>
                      <div style={{fontSize:10,color:"#444",fontFamily:"monospace"}}>{fmtTime(ci.checked_in_at)}</div>
                    </div>
                    <div style={{alignSelf:"center",fontSize:11,color:ci.distance_ft<=CHECK_IN_RADIUS_FT?"#4ae87a":ci.distance_ft>CHECK_IN_RADIUS_FT?"#e8873a":"#555",fontFamily:"monospace"}}>
                      {ci.distance_ft !== null && ci.distance_ft !== undefined ? `${ci.distance_ft.toLocaleString()} ft` : "—"}
                    </div>
                    <div style={{alignSelf:"center"}}>
                      <span style={{fontSize:9,padding:"2px 7px",borderRadius:3,background:ss.bg,border:`1px solid ${ss.border}`,color:ss.color,fontFamily:"monospace",letterSpacing:0.5}}>
                        {ss.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    {checkInFormTarget && (
      <CheckInFormModal
        company={checkInFormTarget}
        position={currentPos}
        onClose={() => setCheckInFormTarget(null)}
        onSubmit={async (company, pos, formData) => {
          // Get position if not already available
          let position = pos;
          if (!position) {
            try { position = await getPosition(); setCurrentPos(position); } catch(e) { setPosError(e.message); return; }
          }
          setCheckingIn(company.id);
          const dist = company.lat && company.lng ? distanceFeet(position.lat, position.lng, company.lat, company.lng) : null;
          const verified = dist !== null ? dist <= CHECK_IN_RADIUS_FT : false;
          const status = dist === null ? "no_coords" : verified ? "verified" : "out_of_range";

          const uid = getUserId();
          const token = JSON.parse(localStorage.getItem("sb_session")||"{}").access_token || SUPABASE_KEY;
          let repName = "Rep", repEmail = "";
          try {
            const payload = JSON.parse(atob(token.split(".")[1]));
            repEmail = payload.email || "";
            repName = payload.user_metadata?.full_name || repEmail.split("@")[0] || "Rep";
          } catch {}

          const body = {
            user_id: uid, rep_name: repName, rep_email: repEmail,
            company_id: company.id, company_name: company.name, company_town: company.town,
            company_lat: company.lat||null, company_lng: company.lng||null,
            rep_lat: position.lat, rep_lng: position.lng,
            gps_accuracy_m: Math.round(position.accuracy||0),
            distance_ft: dist ? Math.round(dist) : null,
            status, checked_in_at: new Date().toISOString(),
            notes: formData.notes || "",
            form_data: JSON.stringify(formData),
          };

          try {
            if (navigator.onLine) {
              await fetch(`${SUPABASE_URL}/rest/v1/check_ins`, {
                method:"POST",
                headers:{"apikey":SUPABASE_KEY,"Authorization":`Bearer ${token}`,"Content-Type":"application/json","Prefer":"return=minimal"},
                body: JSON.stringify(body),
              });
            } else {
              queueOfflineAction(uid, { table: "check_ins", method: "POST", body });
            }
            setSuccessId(company.id);
            setTimeout(() => setSuccessId(null), 3000);
            await loadCheckIns();
          } catch(e) {
            queueOfflineAction(uid, { table: "check_ins", method: "POST", body });
          }
          setCheckingIn(null);
        }}
      />
    )}
    </div>
  );
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  PIPELINE DASHBOARD  (Visual summary for Bid Intelligence)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function PipelineDashboard({ bids }) {
  const active = bids.filter(b => !["Won","Lost"].includes(b.status));
  const awarded = bids.filter(b => b.status === "Awarded — Contact Now");
  const closing = bids.filter(b => {
    const d = b.bidDate ? Math.ceil((new Date(b.bidDate) - new Date()) / 86400000) : null;
    return d !== null && d >= 0 && d <= 7 && !["Won","Lost","Awarded — Contact Now"].includes(b.status);
  });
  const won = bids.filter(b => b.status === "Won");
  const total = bids.filter(b => ["Won","Lost"].includes(b.status)).length;
  const winRate = total > 0 ? Math.round(won.length / total * 100) : 0;

  const byCounty = {};
  active.forEach(b => {
    const k = b.county || "Other";
    if (!byCounty[k]) byCounty[k] = { count: 0, value: 0 };
    byCounty[k].count++;
    byCounty[k].value += b.value || 0;
  });

  const byType = {};
  active.forEach(b => {
    const k = b.type || "Other";
    if (!byType[k]) byType[k] = 0;
    byType[k]++;
  });

  const fmt$ = v => v >= 1000000 ? `$${(v/1000000).toFixed(1)}M` : v >= 1000 ? `$${(v/1000).toFixed(0)}K` : `$${v}`;
  const totalPipeline = active.reduce((s,b) => s + (b.value||0), 0);
  const maxCountyVal = Math.max(...Object.values(byCounty).map(v => v.value), 1);
  const maxTypeCount = Math.max(...Object.values(byType), 1);

  const COUNTY_COLORS = {
    "Litchfield": "#4a9eff", "Berkshire": "#e8c84a", "Hampden": "#b04ae8",
    "Hartford": "#4ae8a0", "New Haven": "#e8873a", "Fairfield": "#e84a6a",
  };
  const TYPE_COLORS = {
    "Commercial": "#4a9eff", "Municipal": "#4ae8a0", "Residential": "#e8873a",
    "Industrial": "#b04ae8", "Other": "#888",
  };

  return (
    <div style={{padding:"20px 32px 0",background:"#0a0a0a"}}>
      {/* Stat cards row */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:10,marginBottom:20}}>
        {[
          ["PIPELINE","total pipeline",fmt$(totalPipeline),"#e8e8e8"],
          ["ACTIVE BIDS","open projects",active.length,"#4a9eff"],
          ["🏆 AWARDED","contact now",awarded.length,awarded.length>0?"#ffaa00":"#555"],
          ["CLOSING SOON","≤7 days",closing.length,closing.length>0?"#e8e8e8":"#555"],
          ["WIN RATE","closed deals",`${winRate}%`,winRate>50?"#4ae87a":"#888"],
          ["WON","total won",won.length,"#4ae87a"],
        ].map(([label,sub,val,color]) => (
          <div key={label} style={{background:"#0d0d0d",border:"1px solid #1a1a1a",borderRadius:8,padding:"12px 14px"}}>
            <div style={{fontSize:8,color:"#444",fontFamily:"monospace",letterSpacing:2,marginBottom:4}}>{label}</div>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:24,color,lineHeight:1,marginBottom:2}}>{val}</div>
            <div style={{fontSize:9,color:"#333",fontFamily:"monospace"}}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>

        {/* Pipeline by County */}
        <div style={{background:"#0d0d0d",border:"1px solid #1a1a1a",borderRadius:8,padding:"16px 18px"}}>
          <div style={{fontSize:10,color:"#444",fontFamily:"monospace",letterSpacing:2,marginBottom:14}}>PIPELINE BY COUNTY</div>
          {Object.entries(byCounty).sort((a,b)=>b[1].value-a[1].value).slice(0,6).map(([county,data]) => {
            const pct = Math.round(data.value / maxCountyVal * 100);
            const color = COUNTY_COLORS[county] || "#888";
            return (
              <div key={county} style={{marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{fontSize:11,color:"#e8e8e8"}}>{county}</span>
                  <span style={{fontSize:10,color:"#555",fontFamily:"monospace"}}>{fmt$(data.value)} · {data.count}</span>
                </div>
                <div style={{height:6,background:"#1a1a1a",borderRadius:3,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${pct}%`,background:color,borderRadius:3,transition:"width .3s"}}/>
                </div>
              </div>
            );
          })}
        </div>

        {/* Pipeline by Type */}
        <div style={{background:"#0d0d0d",border:"1px solid #1a1a1a",borderRadius:8,padding:"16px 18px"}}>
          <div style={{fontSize:10,color:"#444",fontFamily:"monospace",letterSpacing:2,marginBottom:14}}>BIDS BY PROJECT TYPE</div>
          {Object.entries(byType).sort((a,b)=>b[1]-a[1]).map(([type,count]) => {
            const pct = Math.round(count / maxTypeCount * 100);
            const color = TYPE_COLORS[type] || "#888";
            return (
              <div key={type} style={{marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{fontSize:11,color:"#e8e8e8"}}>{type}</span>
                  <span style={{fontSize:10,color:"#555",fontFamily:"monospace"}}>{count} bids</span>
                </div>
                <div style={{height:6,background:"#1a1a1a",borderRadius:3,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${pct}%`,background:color,borderRadius:3,transition:"width .3s"}}/>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  DAILY REPORT GENERATOR
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function DailyReportModal({ onClose }) {
  const [checkIns, setCheckIns] = useState([]);
  const [notes, setNotes]       = useState("");
  const [loading, setLoading]   = useState(true);
  const [copied, setCopied]     = useState(false);
  const [saving, setSaving]     = useState(false);

  const token = JSON.parse(localStorage.getItem("sb_session")||"{}").access_token || SUPABASE_KEY;
  const todayStr = new Date().toISOString().split("T")[0];

  useEffect(() => {
    fetch(`${SUPABASE_URL}/rest/v1/check_ins?user_id=eq.${getUserId()}&checked_in_at=gte.${todayStr}T00:00:00Z&order=checked_in_at.asc`, {
      headers: {"apikey": SUPABASE_KEY, "Authorization": `Bearer ${token}`}
    })
    .then(r => r.json())
    .then(d => { setCheckIns(Array.isArray(d) ? d : []); setLoading(false); })
    .catch(() => setLoading(false));
  }, []);

  let repName = "Rep", repEmail = "";
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    repEmail = payload.email || "";
    repName = payload.user_metadata?.full_name || repEmail.split("@")[0] || "Rep";
  } catch {}

  const fmtTime = iso => { try { return new Date(iso).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit",hour12:true}); } catch { return ""; }};
  const today = new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"});

  const reportText = `DAILY FIELD REPORT — ${today.toUpperCase()}
Rep: ${repName}
─────────────────────────────────────────

SITE VISITS (${checkIns.length})
${checkIns.length === 0 ? "No check-ins logged today." : checkIns.map((ci,i) =>
  `${i+1}. ${ci.company_name} — ${ci.company_town}
   Time: ${fmtTime(ci.checked_in_at)} | GPS: ${ci.status === "verified" ? "✓ Verified" : ci.status === "out_of_range" ? "⚠ Far from site" : "Logged"}${ci.distance_ft ? ` (${ci.distance_ft.toLocaleString()} ft from pin)` : ""}`
).join("
")}

NOTES
${notes.trim() || "No additional notes."}

─────────────────────────────────────────
Submitted via RepRoute Field Sales Intelligence`;

  const copy = () => {
    navigator.clipboard.writeText(reportText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const saveAndShare = async () => {
    setSaving(true);
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/daily_reports`, {
        method: "POST",
        headers: {"apikey":SUPABASE_KEY,"Authorization":`Bearer ${token}`,"Content-Type":"application/json","Prefer":"resolution=merge-duplicates,return=minimal"},
        body: JSON.stringify({
          user_id: getUserId(),
          rep_name: repName,
          rep_email: repEmail,
          report_date: todayStr,
          stops: checkIns.map(ci => ({ title: ci.company_name, description: ci.notes || "", time: fmtTime(ci.checked_in_at) })),
          notes: notes.trim(),
        })
      });
      copy();
      setTimeout(onClose, 1500);
    } catch(e) { alert("Save failed: " + e.message); }
    setSaving(false);
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.9)",zIndex:600,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{background:"#0d0d0d",border:"1px solid #222",borderRadius:12,width:"100%",maxWidth:600,maxHeight:"90vh",display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <div style={{padding:"20px 24px",borderBottom:"1px solid #1a1a1a",display:"flex",alignItems:"center",gap:12}}>
          <div>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,letterSpacing:3,color:"#e8e8e8"}}>DAILY REPORT</div>
            <div style={{fontSize:10,color:"#444",fontFamily:"monospace"}}>{today}</div>
          </div>
          <button onClick={onClose} style={{marginLeft:"auto",background:"none",border:"none",color:"#555",fontSize:22,cursor:"pointer"}}>×</button>
        </div>

        <div style={{flex:1,overflowY:"auto",padding:"20px 24px"}}>
          {loading ? (
            <div style={{color:"#444",fontFamily:"monospace",textAlign:"center",padding:20}}>Loading check-ins...</div>
          ) : (
            <>
              <div style={{marginBottom:16}}>
                <div style={{fontSize:10,color:"#cc2222",fontFamily:"monospace",letterSpacing:2,marginBottom:8}}>SITE VISITS TODAY — {checkIns.length}</div>
                {checkIns.length === 0 ? (
                  <div style={{fontSize:11,color:"#333",fontFamily:"monospace",padding:"12px 0"}}>No check-ins logged. Use the Check-In tab to log visits.</div>
                ) : checkIns.map((ci,i) => (
                  <div key={ci.id||i} style={{display:"flex",gap:10,padding:"8px 0",borderBottom:"1px solid #111"}}>
                    <div style={{width:20,height:20,borderRadius:"50%",background:"#cc2222",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1}}>
                      <span style={{fontSize:9,color:"#fff",fontWeight:700}}>{i+1}</span>
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:12,fontWeight:600,color:"#e8e8e8"}}>{ci.company_name}</div>
                      <div style={{fontSize:10,color:"#555"}}>{ci.company_town} · {fmtTime(ci.checked_in_at)} · {ci.status==="verified"?"✓ GPS Verified":ci.status==="out_of_range"?"⚠ Far from site":"Logged"}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{marginBottom:16}}>
                <div style={{fontSize:10,color:"#444",fontFamily:"monospace",letterSpacing:2,marginBottom:8}}>ADDITIONAL NOTES</div>
                <textarea
                  value={notes}
                  onChange={e=>setNotes(e.target.value)}
                  placeholder="Prospects contacted, follow-ups needed, equipment opportunities spotted..."
                  rows={4}
                  style={{width:"100%",background:"#111",border:"1px solid #222",borderRadius:6,color:"#e8e8e8",padding:"10px 12px",fontSize:12,outline:"none",resize:"vertical",boxSizing:"border-box",fontFamily:"'DM Sans',sans-serif"}}
                />
              </div>

              <div style={{background:"#080808",border:"1px solid #1a1a1a",borderRadius:6,padding:"14px 16px",fontFamily:"monospace",fontSize:11,color:"#555",whiteSpace:"pre-wrap",lineHeight:1.7,maxHeight:180,overflowY:"auto"}}>
                {reportText}
              </div>
            </>
          )}
        </div>

        <div style={{padding:"16px 24px",borderTop:"1px solid #1a1a1a",display:"flex",gap:10}}>
          <button onClick={copy}
            style={{flex:1,padding:"10px",background:copied?"#0a1a0f":"#1a1a1a",border:`1px solid ${copied?"#2a6a3a":"#333"}`,borderRadius:6,color:copied?"#4ae87a":"#888",cursor:"pointer",fontSize:12,fontFamily:"monospace",letterSpacing:1}}>
            {copied ? "✓ COPIED" : "📋 COPY"}
          </button>
          <button onClick={saveAndShare} disabled={saving}
            style={{flex:2,padding:"10px",background:"#cc2222",border:"none",borderRadius:6,color:"#fff",cursor:saving?"wait":"pointer",fontSize:12,fontWeight:700,letterSpacing:1}}>
            {saving ? "SAVING..." : "💾 SAVE & COPY TO SEND"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  PROSPECT SCORE ENGINE  (Heat-ranked call list)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function scoreCompany(company, checkIns, bids) {
  let score = 0;
  // Priority
  if (company.priority === "High")   score += 40;
  if (company.priority === "Medium") score += 20;
  // Has phone
  if (company.phone) score += 10;
  // Has coordinates (pinned)
  if (company.lat && company.lng) score += 5;
  // Recent check-in (decay)
  const myCheckIns = checkIns.filter(ci => ci.company_id === company.id);
  if (myCheckIns.length === 0) score += 25; // never visited — urgent
  else {
    const lastVisit = new Date(myCheckIns.sort((a,b) => new Date(b.checked_in_at) - new Date(a.checked_in_at))[0].checked_in_at);
    const daysSince = Math.floor((new Date() - lastVisit) / 86400000);
    if (daysSince > 30) score += 20;
    else if (daysSince > 14) score += 10;
    else if (daysSince > 7) score += 5;
    else score -= 10; // visited recently
  }
  // Active bids in same town
  const townBids = bids.filter(b => b.town === company.town && !["Won","Lost"].includes(b.status));
  score += Math.min(townBids.length * 3, 15);
  return Math.max(0, Math.min(100, score));
}

function ProspectScorePanel({ companies, checkIns, bids, onSelectCompany }) {
  const scored = companies
    .map(c => ({ ...c, score: scoreCompany(c, checkIns, bids) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 15);

  const getColor = score => score >= 70 ? "#cc2222" : score >= 50 ? "#e8873a" : score >= 30 ? "#e8c84a" : "#555";
  const getLabel = score => score >= 70 ? "🔥 HOT" : score >= 50 ? "⚡ WARM" : score >= 30 ? "· COOL" : "— COLD";

  return (
    <div style={{background:"#0d0d0d",border:"1px solid #1a1a1a",borderRadius:8,overflow:"hidden"}}>
      <div style={{padding:"12px 16px",borderBottom:"1px solid #1a1a1a",display:"flex",alignItems:"center",gap:10}}>
        <div style={{fontSize:10,color:"#444",fontFamily:"monospace",letterSpacing:2}}>🎯 TOP PROSPECTS TODAY</div>
        <div style={{marginLeft:"auto",fontSize:9,color:"#333",fontFamily:"monospace"}}>scored by priority · visits · local bids</div>
      </div>
      {scored.map((c, i) => {
        const color = getColor(c.score);
        const label = getLabel(c.score);
        const dc = DAY_CONFIG[c.day] || DAY_CONFIG.Monday;
        return (
          <div key={c.id} onClick={() => onSelectCompany && onSelectCompany(c)}
            style={{padding:"9px 16px",borderBottom:"1px solid #111",display:"flex",alignItems:"center",gap:10,cursor:"pointer",background:"transparent"}}
            onMouseEnter={e=>e.currentTarget.style.background="#111"}
            onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
            <div style={{width:22,textAlign:"center",fontSize:10,color:"#333",fontFamily:"monospace",flexShrink:0}}>{i+1}</div>
            <div style={{width:36,height:6,background:"#1a1a1a",borderRadius:3,overflow:"hidden",flexShrink:0}}>
              <div style={{height:"100%",width:`${c.score}%`,background:color,borderRadius:3}}/>
            </div>
            <div style={{flex:1,overflow:"hidden"}}>
              <div style={{fontSize:12,fontWeight:600,color:"#e8e8e8",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.name}</div>
              <div style={{fontSize:9,color:"#555",fontFamily:"monospace"}}><span style={{color:dc.color}}>{dc.label}</span> · {c.town}</div>
            </div>
            <div style={{fontSize:9,color:color,fontFamily:"monospace",fontWeight:700,flexShrink:0}}>{label}</div>
            {c.phone && <a href={`tel:${c.phone}`} onClick={e=>e.stopPropagation()} style={{fontSize:10,color:"#e8e8e8",background:"#1a1a1a",border:"1px solid #333",borderRadius:4,padding:"3px 8px",textDecoration:"none",flexShrink:0}}>📞</a>}
          </div>
        );
      })}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  ONBOARDING WIZARD  (First-time setup)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function OnboardingWizard({ onComplete }) {
  const [step, setStep]         = useState(0);
  const [name, setName]         = useState("");
  const [territory, setTerritory] = useState("");
  const [role, setRole]         = useState("rep");
  const [routes, setRoutes]     = useState({ Monday:"", Tuesday:"", Wednesday:"", Thursday:"", Friday:"" });
  const [saving, setSaving]     = useState(false);

  const token = JSON.parse(localStorage.getItem("sb_session")||"{}").access_token || SUPABASE_KEY;

  // Pre-fill name from Google token
  useEffect(() => {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const gname = payload.user_metadata?.full_name || payload.email?.split("@")[0] || "";
      setName(gname);
    } catch {}
  }, []);

  const save = async () => {
    setSaving(true);
    const uid = getUserId();
    const settings = [
      { key: "onboarded",  value: "true" },
      { key: "rep_name",   value: name.trim() },
      { key: "territory",  value: territory.trim() },
      { key: "role",       value: role },
      { key: "routes",     value: JSON.stringify(routes) },
    ];
    try {
      for (const s of settings) {
        await fetch(`${SUPABASE_URL}/rest/v1/user_settings`, {
          method: "POST",
          headers: {"apikey":SUPABASE_KEY,"Authorization":`Bearer ${token}`,"Content-Type":"application/json","Prefer":"resolution=merge-duplicates,return=minimal"},
          body: JSON.stringify({ user_id: uid, key: s.key, value: s.value }),
        });
      }
      DAY_CONFIG = getDAYCONFIG(routes);
      onComplete({ name, territory, role, routes });
    } catch(e) { alert("Setup failed: " + e.message); }
    setSaving(false);
  };

  const STEPS = ["Welcome", "Your Info", "Route Days", "Done"];

  return (
    <div style={{position:"fixed",inset:0,background:"#0a0a0a",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans',sans-serif"}}>
      <div style={{width:"100%",maxWidth:480,padding:"40px 36px",background:"#0d0d0d",border:"1px solid #1e1e1e",borderRadius:16}}>
        {/* Progress */}
        <div style={{display:"flex",gap:6,marginBottom:32}}>
          {STEPS.map((s,i) => (
            <div key={s} style={{flex:1,height:3,borderRadius:2,background:i<=step?"#cc2222":"#1a1a1a",transition:"background .3s"}}/>
          ))}
        </div>

        {step === 0 && (
          <>
            <div style={{fontSize:11,color:"#cc2222",fontFamily:"monospace",letterSpacing:3,marginBottom:12}}>WELCOME TO</div>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:48,color:"#e8e8e8",letterSpacing:4,lineHeight:1,marginBottom:8}}>
              REP<span style={{color:"#cc2222"}}>ROUTE</span>
            </div>
            <div style={{fontSize:13,color:"#555",marginBottom:32,lineHeight:1.7}}>
              Field sales intelligence for reps on the road.<br/>
              Let's get you set up in 60 seconds.
            </div>
            <button onClick={()=>setStep(1)} style={{width:"100%",padding:"14px",background:"#cc2222",border:"none",borderRadius:8,color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",letterSpacing:1}}>
              GET STARTED →
            </button>
          </>
        )}

        {step === 1 && (
          <>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:26,letterSpacing:3,color:"#e8e8e8",marginBottom:6}}>YOUR INFO</div>
            <div style={{fontSize:11,color:"#444",fontFamily:"monospace",marginBottom:24}}>Tell us about yourself</div>

            <label style={{fontSize:10,color:"#666",fontFamily:"monospace",letterSpacing:1,display:"block",marginBottom:6}}>YOUR NAME</label>
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Thomas Provitz"
              style={{width:"100%",background:"#111",border:"1px solid #333",borderRadius:6,color:"#e8e8e8",padding:"10px 12px",fontSize:13,outline:"none",boxSizing:"border-box",marginBottom:16}}/>

            <label style={{fontSize:10,color:"#666",fontFamily:"monospace",letterSpacing:1,display:"block",marginBottom:6}}>TERRITORY / REGION</label>
            <input value={territory} onChange={e=>setTerritory(e.target.value)} placeholder="e.g. Western CT + Berkshires MA"
              style={{width:"100%",background:"#111",border:"1px solid #333",borderRadius:6,color:"#e8e8e8",padding:"10px 12px",fontSize:13,outline:"none",boxSizing:"border-box",marginBottom:16}}/>

            <label style={{fontSize:10,color:"#666",fontFamily:"monospace",letterSpacing:1,display:"block",marginBottom:8}}>YOUR ROLE</label>
            <div style={{display:"flex",gap:8,marginBottom:28}}>
              {[["rep","Field Rep"],["manager","Manager"]].map(([val,label]) => (
                <button key={val} onClick={()=>setRole(val)}
                  style={{flex:1,padding:"10px",background:role===val?"#1a0a0a":"#111",border:`1px solid ${role===val?"#cc2222":"#222"}`,borderRadius:6,color:role===val?"#cc2222":"#555",cursor:"pointer",fontSize:12,fontWeight:600}}>
                  {label}
                </button>
              ))}
            </div>

            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setStep(0)} style={{flex:1,padding:"12px",background:"none",border:"1px solid #222",borderRadius:6,color:"#555",cursor:"pointer",fontSize:12}}>Back</button>
              <button onClick={()=>setStep(2)} disabled={!name.trim()}
                style={{flex:2,padding:"12px",background:name.trim()?"#cc2222":"#222",border:"none",borderRadius:6,color:name.trim()?"#fff":"#444",cursor:name.trim()?"pointer":"default",fontSize:12,fontWeight:700}}>
                Next →
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:26,letterSpacing:3,color:"#e8e8e8",marginBottom:6}}>ROUTE DAYS</div>
            <div style={{fontSize:11,color:"#444",fontFamily:"monospace",marginBottom:20}}>Name each day's route (or skip to use defaults)</div>

            {Object.entries(DEFAULT_DAY_CONFIG).map(([day,dc]) => (
              <div key={day} style={{marginBottom:12,display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:36,height:36,borderRadius:6,background:dc.bg,border:`1px solid ${dc.border}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <span style={{fontFamily:"monospace",fontSize:9,fontWeight:700,color:dc.color,letterSpacing:1}}>{dc.label}</span>
                </div>
                <input value={routes[day]} onChange={e=>setRoutes(r=>({...r,[day]:e.target.value}))}
                  placeholder={dc.desc}
                  style={{flex:1,background:"#111",border:`1px solid ${dc.border}`,borderRadius:5,color:"#e8e8e8",padding:"8px 10px",fontSize:12,outline:"none",fontFamily:"'DM Sans',sans-serif"}}/>
              </div>
            ))}

            <div style={{display:"flex",gap:10,marginTop:20}}>
              <button onClick={()=>setStep(1)} style={{flex:1,padding:"12px",background:"none",border:"1px solid #222",borderRadius:6,color:"#555",cursor:"pointer",fontSize:12}}>Back</button>
              <button onClick={()=>setStep(3)} style={{flex:2,padding:"12px",background:"#cc2222",border:"none",borderRadius:6,color:"#fff",cursor:"pointer",fontSize:12,fontWeight:700}}>Next →</button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div style={{textAlign:"center",marginBottom:28}}>
              <div style={{fontSize:48,marginBottom:12}}>🎯</div>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:30,letterSpacing:3,color:"#e8e8e8",marginBottom:8}}>YOU'RE ALL SET</div>
              <div style={{fontSize:12,color:"#555",lineHeight:1.8}}>
                Welcome, {name}.<br/>
                Your territory: {territory || "Not set"}<br/>
                Role: {role === "manager" ? "Manager" : "Field Rep"}
              </div>
            </div>
            <button onClick={save} disabled={saving}
              style={{width:"100%",padding:"14px",background:"#cc2222",border:"none",borderRadius:8,color:"#fff",fontSize:14,fontWeight:700,cursor:saving?"wait":"pointer",letterSpacing:1}}>
              {saving ? "SETTING UP..." : "LAUNCH REPROUTE →"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  OFFLINE CACHE  (Service worker + localStorage fallback)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const OFFLINE_KEYS = {
  companies: uid => `offline_companies_${uid}`,
  bids:      uid => `offline_bids_${uid}`,
  checkIns:  uid => `offline_checkins_${uid}`,
  pending:   uid => `offline_pending_${uid}`,
};

function saveOffline(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch(e) { console.warn("Offline save failed:", e); }
}

function loadOffline(key) {
  try { const d = localStorage.getItem(key); return d ? JSON.parse(d) : null; } catch { return null; }
}

function queueOfflineAction(uid, action) {
  const key = OFFLINE_KEYS.pending(uid);
  const pending = loadOffline(key) || [];
  pending.push({ ...action, queuedAt: new Date().toISOString() });
  saveOffline(key, pending);
}

async function flushOfflineQueue(uid, token) {
  const key = OFFLINE_KEYS.pending(uid);
  const pending = loadOffline(key) || [];
  if (!pending.length) return 0;
  let flushed = 0;
  const remaining = [];
  for (const action of pending) {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/${action.table}`, {
        method: action.method || "POST",
        headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${token}`, "Content-Type": "application/json", "Prefer": "return=minimal" },
        body: JSON.stringify(action.body),
      });
      flushed++;
    } catch { remaining.push(action); }
  }
  saveOffline(key, remaining);
  return flushed;
}

function useOnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on  = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  return online;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  FOLLOW-UP REMINDERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function FollowUpModal({ company, onClose, onSave }) {
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const today = new Date();
  const presets = [
    { label: "Tomorrow",  days: 1 },
    { label: "3 Days",    days: 3 },
    { label: "1 Week",    days: 7 },
    { label: "2 Weeks",   days: 14 },
    { label: "1 Month",   days: 30 },
  ];

  const setPreset = (days) => {
    const d = new Date(today);
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().split("T")[0]);
  };

  const save = async () => {
    if (!date) return;
    setSaving(true);
    const token = JSON.parse(localStorage.getItem("sb_session")||"{}").access_token || SUPABASE_KEY;
    const uid = getUserId();
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/user_settings`, {
        method: "POST",
        headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${token}`, "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({
          user_id: uid,
          key: `followup_${company.id}`,
          value: JSON.stringify({ companyId: company.id, companyName: company.name, town: company.town, date, note, createdAt: new Date().toISOString() })
        })
      });
      onSave && onSave({ companyId: company.id, companyName: company.name, town: company.town, date, note });
      onClose();
    } catch(e) { alert("Failed: " + e.message); }
    setSaving(false);
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",zIndex:800,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{background:"#0d0d0d",border:"1px solid #cc2222",borderRadius:12,width:"100%",maxWidth:400,padding:28}}>
        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,letterSpacing:3,color:"#e8e8e8",marginBottom:4}}>SET FOLLOW-UP</div>
        <div style={{fontSize:11,color:"#555",fontFamily:"monospace",marginBottom:20}}>{company.name} · {company.town}</div>

        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
          {presets.map(p => (
            <button key={p.label} onClick={() => setPreset(p.days)}
              style={{padding:"6px 12px",background:"#111",border:"1px solid #222",borderRadius:5,color:"#888",cursor:"pointer",fontSize:11,fontFamily:"monospace"}}>
              {p.label}
            </button>
          ))}
        </div>

        <label style={{fontSize:10,color:"#555",fontFamily:"monospace",letterSpacing:1,display:"block",marginBottom:6}}>DATE</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          style={{width:"100%",background:"#111",border:"1px solid #333",borderRadius:5,color:"#e8e8e8",padding:"8px 10px",fontSize:13,outline:"none",boxSizing:"border-box",marginBottom:14}}/>

        <label style={{fontSize:10,color:"#555",fontFamily:"monospace",letterSpacing:1,display:"block",marginBottom:6}}>NOTE (optional)</label>
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Follow up on T3 quote"
          style={{width:"100%",background:"#111",border:"1px solid #333",borderRadius:5,color:"#e8e8e8",padding:"8px 10px",fontSize:13,outline:"none",boxSizing:"border-box",marginBottom:20}}/>

        <div style={{display:"flex",gap:10}}>
          <button onClick={onClose} style={{flex:1,padding:"10px",background:"none",border:"1px solid #222",borderRadius:6,color:"#555",cursor:"pointer",fontSize:12}}>Cancel</button>
          <button onClick={save} disabled={!date||saving}
            style={{flex:2,padding:"10px",background:date?"#cc2222":"#222",border:"none",borderRadius:6,color:date?"#fff":"#444",cursor:date?"pointer":"default",fontSize:12,fontWeight:700}}>
            {saving ? "Saving..." : "Set Reminder"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  MILEAGE TRACKER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function MileageTracker() {
  const [routes, setRoutes]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);
  const token = JSON.parse(localStorage.getItem("sb_session")||"{}").access_token || SUPABASE_KEY;

  useEffect(() => {
    const uid = getUserId();
    fetch(`${SUPABASE_URL}/rest/v1/user_settings?user_id=eq.${uid}&key=like.route_%&order=created_at.desc&limit=100`, {
      headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${token}` }
    })
    .then(r => r.json())
    .then(d => {
      if (Array.isArray(d)) {
        setRoutes(d.map(r => { try { return { key: r.key, ...JSON.parse(r.value) }; } catch { return null; } }).filter(Boolean));
      }
      setLoading(false);
    })
    .catch(() => setLoading(false));
  }, []);

  // Calculate distance between two lat/lng points in miles
  function distanceMiles(lat1, lng1, lat2, lng2) {
    const R = 3958.8;
    const dLat = (lat2-lat1)*Math.PI/180;
    const dLng = (lng2-lng1)*Math.PI/180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  function routeMiles(stops) {
    if (!stops || stops.length < 2) return 0;
    let total = 0;
    for (let i = 0; i < stops.length-1; i++) {
      if (stops[i].lat && stops[i].lng && stops[i+1].lat && stops[i+1].lng) {
        total += distanceMiles(stops[i].lat, stops[i].lng, stops[i+1].lat, stops[i+1].lng);
      }
    }
    return total;
  }

  // Get week bounds
  function weekBounds(offset) {
    const today = new Date();
    const day = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (day===0?6:day-1) + offset*7);
    monday.setHours(0,0,0,0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate()+6);
    sunday.setHours(23,59,59,999);
    return { start: monday, end: sunday };
  }

  const { start, end } = weekBounds(weekOffset);
  const IRS_RATE = 0.67; // 2024 IRS standard mileage rate

  const weekRoutes = routes.filter(r => {
    const d = new Date(r.date || r.createdAt || 0);
    return d >= start && d <= end;
  });

  const totalMiles = weekRoutes.reduce((s, r) => s + routeMiles(r.stops || []), 0);
  const totalReimbursement = totalMiles * IRS_RATE;

  const fmtDate = d => new Date(d).toLocaleDateString("en-US", {month:"short",day:"numeric"});

  if (loading) return <div style={{padding:40,color:"#444",fontFamily:"monospace",textAlign:"center"}}>Loading...</div>;

  return (
    <div style={{background:"#0a0a0a",color:"#f5f5f5",fontFamily:"'DM Sans',sans-serif",minHeight:"calc(100vh - 54px)"}}>
      {/* Header */}
      <div style={{background:"#0d0d0d",borderBottom:"1px solid #1a1a1a",padding:"10px 24px",display:"flex",alignItems:"center",gap:16}}>
        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,letterSpacing:3,color:"#e8e8e8"}}>MILEAGE TRACKER</div>
        <div style={{fontSize:10,color:"#444",fontFamily:"monospace",letterSpacing:2}}>IRS RATE ${IRS_RATE}/MILE</div>
        <div style={{marginLeft:"auto",display:"flex",gap:8,alignItems:"center"}}>
          <button onClick={()=>setWeekOffset(w=>w-1)} style={{padding:"5px 10px",background:"transparent",border:"1px solid #222",borderRadius:5,color:"#555",cursor:"pointer",fontSize:13}}>‹</button>
          <span style={{fontSize:11,color:"#555",fontFamily:"monospace",minWidth:180,textAlign:"center"}}>
            {fmtDate(start)} – {fmtDate(end)}
          </span>
          <button onClick={()=>setWeekOffset(w=>w+1)} style={{padding:"5px 10px",background:"transparent",border:"1px solid #222",borderRadius:5,color:"#555",cursor:"pointer",fontSize:13}}>›</button>
          <button onClick={()=>setWeekOffset(0)} style={{padding:"5px 12px",background:"#111",border:"1px solid #222",borderRadius:5,color:"#888",cursor:"pointer",fontSize:11,fontFamily:"monospace"}}>THIS WEEK</button>
        </div>
      </div>

      <div style={{padding:"20px 24px"}}>
        {/* Summary cards */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:24}}>
          {[
            ["MILES THIS WEEK", totalMiles.toFixed(1) + " mi", "#4a9eff"],
            ["REIMBURSEMENT", "$" + totalReimbursement.toFixed(2), "#4ae87a"],
            ["ROUTES RUN", weekRoutes.length, "#e8e8e8"],
            ["AVG PER ROUTE", weekRoutes.length > 0 ? (totalMiles/weekRoutes.length).toFixed(1)+" mi" : "—", "#888"],
          ].map(([label, val, color]) => (
            <div key={label} style={{background:"#0d0d0d",border:"1px solid #1a1a1a",borderRadius:8,padding:"14px 16px"}}>
              <div style={{fontSize:8,color:"#444",fontFamily:"monospace",letterSpacing:2,marginBottom:4}}>{label}</div>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:26,color,lineHeight:1}}>{val}</div>
            </div>
          ))}
        </div>

        {/* Route breakdown */}
        {weekRoutes.length === 0 ? (
          <div style={{textAlign:"center",padding:40,color:"#252525",fontFamily:"monospace",fontSize:12}}>
            No routes saved this week.<br/>Use Route Planner to plan and save routes.
          </div>
        ) : (
          <div style={{background:"#0d0d0d",border:"1px solid #1a1a1a",borderRadius:8,overflow:"hidden"}}>
            <div style={{padding:"10px 16px",borderBottom:"1px solid #1a1a1a",display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",gap:0}}>
              {["ROUTE NAME","DATE","STOPS","MILES"].map(h => (
                <div key={h} style={{fontSize:9,color:"#444",fontFamily:"monospace",letterSpacing:1}}>{h}</div>
              ))}
            </div>
            {weekRoutes.map((r, i) => {
              const miles = routeMiles(r.stops || []);
              return (
                <div key={r.key||i} style={{padding:"12px 16px",borderBottom:"1px solid #111",display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",gap:0,background:i%2===0?"transparent":"#080808"}}>
                  <div style={{fontSize:12,fontWeight:600,color:"#e8e8e8"}}>{r.name}</div>
                  <div style={{fontSize:11,color:"#666"}}>{r.date || "—"}</div>
                  <div style={{fontSize:11,color:"#888",fontFamily:"monospace"}}>{(r.stops||[]).length}</div>
                  <div style={{fontSize:11,color:"#4a9eff",fontFamily:"monospace"}}>{miles.toFixed(1)} mi</div>
                </div>
              );
            })}
            <div style={{padding:"12px 16px",background:"#0f0f0f",display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",gap:0,borderTop:"1px solid #222"}}>
              <div style={{fontSize:11,fontWeight:700,color:"#e8e8e8",fontFamily:"monospace",letterSpacing:1}}>TOTAL</div>
              <div/>
              <div style={{fontSize:11,color:"#888",fontFamily:"monospace"}}>{weekRoutes.reduce((s,r)=>s+(r.stops||[]).length,0)}</div>
              <div style={{fontSize:13,color:"#4ae87a",fontFamily:"monospace",fontWeight:700}}>{totalMiles.toFixed(1)} mi · ${totalReimbursement.toFixed(2)}</div>
            </div>
          </div>
        )}

        {/* Export button */}
        <div style={{marginTop:16,display:"flex",gap:10}}>
          <button onClick={() => {
            const csv = ["Route Name,Date,Stops,Miles,Reimbursement",
              ...weekRoutes.map(r => {
                const m = routeMiles(r.stops||[]);
                return `"${r.name}","${r.date||""}","${(r.stops||[]).length}","${m.toFixed(1)}","$${(m*IRS_RATE).toFixed(2)}"`;
              }),
              `"TOTAL","","${weekRoutes.reduce((s,r)=>s+(r.stops||[]).length,0)}","${totalMiles.toFixed(1)}","$${totalReimbursement.toFixed(2)}"`,
            ].join("
");
            const blob = new Blob([csv], {type:"text/csv"});
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url; a.download = `mileage_${start.toISOString().split("T")[0]}.csv`; a.click();
          }} style={{padding:"10px 20px",background:"#1a1a1a",border:"1px solid #333",borderRadius:6,color:"#888",cursor:"pointer",fontSize:12,fontFamily:"monospace",letterSpacing:1}}>
            ⬇ EXPORT CSV
          </button>
        </div>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  CUSTOM CHECK-IN FORM FIELDS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const CHECKIN_FIELDS = [
  { key: "contacted_dm",    label: "Contacted Decision Maker?", type: "bool" },
  { key: "left_materials",  label: "Left Materials?",           type: "bool" },
  { key: "quoted",          label: "Quoted Equipment?",         type: "bool" },
  { key: "quote_value",     label: "Quote Value ($)",           type: "number" },
  { key: "next_step",       label: "Next Step",                 type: "select", options: ["Follow up call","Schedule demo","Send proposal","Check back in 30 days","Not interested","Won"] },
  { key: "notes",           label: "Visit Notes",               type: "text" },
];

function CheckInFormModal({ company, position, onClose, onSubmit }) {
  const [form, setForm] = useState({ contacted_dm: false, left_materials: false, quoted: false, quote_value: "", next_step: "Follow up call", notes: "" });
  const [submitting, setSubmitting] = useState(false);
  const set = (k, v) => setForm(f => ({...f, [k]: v}));

  const submit = async () => {
    setSubmitting(true);
    await onSubmit(company, position, form);
    setSubmitting(false);
    onClose();
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",zIndex:900,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{background:"#0d0d0d",border:"1px solid #cc2222",borderRadius:12,width:"100%",maxWidth:440,maxHeight:"90vh",overflowY:"auto",padding:28}}>
        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,letterSpacing:3,color:"#e8e8e8",marginBottom:4}}>LOG VISIT</div>
        <div style={{fontSize:11,color:"#555",fontFamily:"monospace",marginBottom:20}}>{company.name} · {company.town}</div>

        {CHECKIN_FIELDS.map(field => (
          <div key={field.key} style={{marginBottom:14}}>
            <label style={{fontSize:10,color:"#666",fontFamily:"monospace",letterSpacing:1,display:"block",marginBottom:5}}>{field.label.toUpperCase()}</label>
            {field.type === "bool" && (
              <div style={{display:"flex",gap:8}}>
                {["Yes","No"].map(opt => (
                  <button key={opt} onClick={() => set(field.key, opt==="Yes")}
                    style={{flex:1,padding:"8px",background:(form[field.key]&&opt==="Yes")||(!form[field.key]&&opt==="No")?"#1a0a0a":"#111",border:`1px solid ${(form[field.key]&&opt==="Yes")||(!form[field.key]&&opt==="No")?"#cc2222":"#222"}`,borderRadius:5,color:(form[field.key]&&opt==="Yes")||(!form[field.key]&&opt==="No")?"#cc2222":"#555",cursor:"pointer",fontSize:12,fontWeight:600}}>
                    {opt}
                  </button>
                ))}
              </div>
            )}
            {field.type === "number" && (
              <input type="number" value={form[field.key]} onChange={e=>set(field.key,e.target.value)} placeholder="0"
                style={{width:"100%",background:"#111",border:"1px solid #222",borderRadius:5,color:"#e8e8e8",padding:"8px 10px",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
            )}
            {field.type === "select" && (
              <select value={form[field.key]} onChange={e=>set(field.key,e.target.value)}
                style={{width:"100%",background:"#111",border:"1px solid #222",borderRadius:5,color:"#e8e8e8",padding:"8px 10px",fontSize:13,outline:"none"}}>
                {field.options.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            )}
            {field.type === "text" && (
              <textarea value={form[field.key]} onChange={e=>set(field.key,e.target.value)} rows={3} placeholder="What happened on this visit..."
                style={{width:"100%",background:"#111",border:"1px solid #222",borderRadius:5,color:"#e8e8e8",padding:"8px 10px",fontSize:12,outline:"none",resize:"vertical",boxSizing:"border-box",fontFamily:"inherit"}}/>
            )}
          </div>
        ))}

        <div style={{display:"flex",gap:10,marginTop:20}}>
          <button onClick={onClose} style={{flex:1,padding:"10px",background:"none",border:"1px solid #222",borderRadius:6,color:"#555",cursor:"pointer",fontSize:12}}>Cancel</button>
          <button onClick={submit} disabled={submitting}
            style={{flex:2,padding:"10px",background:"#cc2222",border:"none",borderRadius:6,color:"#fff",cursor:submitting?"wait":"pointer",fontSize:12,fontWeight:700}}>
            {submitting?"Logging...":"Log Visit"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  NEARBY PROSPECTS (Lead Generation on the Map)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function NearbyProspects({ onAddCompany, onClose }) {
  const [results, setResults]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [pos, setPos]           = useState(null);
  const [error, setError]       = useState(null);
  const [radius, setRadius]     = useState(10); // miles
  const [type, setType]         = useState("general_contractor");

  const TYPES = [
    { value: "general_contractor", label: "General Contractor" },
    { value: "excavating_contractor", label: "Excavation" },
    { value: "paving_contractor", label: "Paving" },
    { value: "roofing_contractor", label: "Roofing" },
    { value: "construction_company", label: "Construction" },
    { value: "industrial_contractor", label: "Industrial" },
  ];

  const search = async () => {
    setLoading(true);
    setError(null);
    try {
      const position = await new Promise((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 10000 })
      );
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      setPos({ lat, lng });

      // Use Google Places nearby search via proxy-free approach
      const radiusMeters = radius * 1609.34;
      const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radiusMeters}&keyword=${encodeURIComponent(type.replace(/_/g," "))}&type=establishment&key=`;
      // Since we don't have a Places API key, use OpenStreetMap Nominatim as free fallback
      const osmUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(type.replace(/_/g," "))}&lat=${lat}&lon=${lng}&radius=${radius}&format=json&limit=20&addressdetails=1`;
      const r = await fetch(osmUrl, { headers: { "Accept-Language": "en" } });
      const data = await r.json();
      setResults(data.slice(0, 15).map(p => ({
        name: p.display_name.split(",")[0],
        address: p.display_name,
        lat: parseFloat(p.lat),
        lng: parseFloat(p.lon),
        town: p.address?.city || p.address?.town || p.address?.village || "",
        state: p.address?.state_code || "CT",
      })));
    } catch(e) {
      setError(e.message || "Search failed");
    }
    setLoading(false);
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",zIndex:700,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{background:"#0d0d0d",border:"1px solid #333",borderRadius:12,width:"100%",maxWidth:520,maxHeight:"85vh",display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <div style={{padding:"20px 24px",borderBottom:"1px solid #1a1a1a",display:"flex",alignItems:"center"}}>
          <div>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,letterSpacing:3,color:"#e8e8e8"}}>FIND NEARBY PROSPECTS</div>
            <div style={{fontSize:10,color:"#444",fontFamily:"monospace",letterSpacing:1}}>GPS-BASED LEAD GENERATION</div>
          </div>
          <button onClick={onClose} style={{marginLeft:"auto",background:"none",border:"none",color:"#555",fontSize:22,cursor:"pointer"}}>×</button>
        </div>

        <div style={{padding:"16px 24px",borderBottom:"1px solid #1a1a1a",display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
          <select value={type} onChange={e=>setType(e.target.value)}
            style={{background:"#111",border:"1px solid #222",borderRadius:5,color:"#e8e8e8",padding:"7px 10px",fontSize:12,outline:"none",flex:1}}>
            {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <select value={radius} onChange={e=>setRadius(Number(e.target.value))}
            style={{background:"#111",border:"1px solid #222",borderRadius:5,color:"#888",padding:"7px 10px",fontSize:12,outline:"none",width:100}}>
            {[5,10,20,50].map(r => <option key={r} value={r}>{r} mi</option>)}
          </select>
          <button onClick={search} disabled={loading}
            style={{padding:"7px 16px",background:"#cc2222",border:"none",borderRadius:5,color:"#fff",cursor:loading?"wait":"pointer",fontSize:12,fontWeight:700,whiteSpace:"nowrap"}}>
            {loading ? "Searching..." : "📍 Search Near Me"}
          </button>
        </div>

        {error && <div style={{padding:"10px 24px",color:"#cc6666",fontSize:11,fontFamily:"monospace"}}>{error}</div>}

        <div style={{overflowY:"auto",flex:1}}>
          {results.length === 0 && !loading && (
            <div style={{padding:32,textAlign:"center",color:"#333",fontFamily:"monospace",fontSize:11,lineHeight:2}}>
              Click "Search Near Me" to find<br/>construction companies in your area.
            </div>
          )}
          {results.map((r, i) => (
            <div key={i} style={{padding:"12px 24px",borderBottom:"1px solid #111",display:"flex",alignItems:"center",gap:12}}>
              <div style={{flex:1,overflow:"hidden"}}>
                <div style={{fontSize:12,fontWeight:600,color:"#e8e8e8",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.name}</div>
                <div style={{fontSize:10,color:"#555",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.address}</div>
              </div>
              <button onClick={() => { onAddCompany(r); }}
                style={{padding:"6px 12px",background:"#1a0a0a",border:"1px solid #cc2222",borderRadius:5,color:"#cc2222",cursor:"pointer",fontSize:11,fontFamily:"monospace",fontWeight:700,flexShrink:0}}>
                + ADD
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  REP LEADERBOARD  (Manager view)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function RepLeaderboard() {
  const [data, setData]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("week"); // week | month | all
  const token = JSON.parse(localStorage.getItem("sb_session")||"{}").access_token || SUPABASE_KEY;

  useEffect(() => {
    Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/check_ins?order=checked_in_at.desc&limit=1000`, {
        headers: {"apikey":SUPABASE_KEY,"Authorization":`Bearer ${token}`}
      }).then(r=>r.json()),
      fetch(`${SUPABASE_URL}/rest/v1/daily_reports?order=report_date.desc&limit=500`, {
        headers: {"apikey":SUPABASE_KEY,"Authorization":`Bearer ${token}`}
      }).then(r=>r.json()),
    ]).then(([checkIns, reports]) => {
      // Group by rep
      const reps = {};
      (Array.isArray(checkIns)?checkIns:[]).forEach(ci => {
        if (!reps[ci.rep_name]) reps[ci.rep_name] = { name: ci.rep_name, checkIns: [], reports: [] };
        reps[ci.rep_name].checkIns.push(ci);
      });
      (Array.isArray(reports)?reports:[]).forEach(r => {
        if (!reps[r.rep_name]) reps[r.rep_name] = { name: r.rep_name, checkIns: [], reports: [] };
        reps[r.rep_name].reports.push(r);
      });

      const now = new Date();
      const weekAgo = new Date(now - 7*86400000);
      const monthAgo = new Date(now - 30*86400000);
      const cutoff = period === "week" ? weekAgo : period === "month" ? monthAgo : new Date(0);

      setData(Object.values(reps).map(rep => {
        const periodCIs = rep.checkIns.filter(ci => new Date(ci.checked_in_at) >= cutoff);
        const verified = periodCIs.filter(ci => ci.status === "verified").length;
        const todayCIs = rep.checkIns.filter(ci => ci.checked_in_at?.startsWith(new Date().toISOString().split("T")[0]));
        const totalReports = rep.reports.filter(r => new Date(r.report_date) >= cutoff).length;
        const score = periodCIs.length * 10 + verified * 5 + totalReports * 3;
        return { ...rep, periodCIs: periodCIs.length, verified, todayCIs: todayCIs.length, reports: totalReports, score };
      }).sort((a,b) => b.score - a.score));

      setLoading(false);
    }).catch(() => setLoading(false));
  }, [period]);

  const medals = ["🥇","🥈","🥉"];

  if (loading) return <div style={{padding:40,color:"#444",fontFamily:"monospace",textAlign:"center"}}>Loading leaderboard...</div>;

  return (
    <div style={{background:"#0a0a0a",color:"#f5f5f5",fontFamily:"'DM Sans',sans-serif",minHeight:"calc(100vh-54px)"}}>
      <div style={{background:"#0d0d0d",borderBottom:"1px solid #1a1a1a",padding:"10px 24px",display:"flex",alignItems:"center",gap:16}}>
        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,letterSpacing:3,color:"#e8e8e8"}}>REP LEADERBOARD</div>
        <div style={{marginLeft:"auto",display:"flex",gap:6}}>
          {[["week","7 DAYS"],["month","30 DAYS"],["all","ALL TIME"]].map(([val,label]) => (
            <button key={val} onClick={()=>setPeriod(val)}
              style={{padding:"5px 12px",background:period===val?"#1a0a0a":"transparent",border:`1px solid ${period===val?"#cc2222":"#222"}`,borderRadius:5,color:period===val?"#cc2222":"#444",cursor:"pointer",fontSize:10,fontFamily:"monospace"}}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{padding:"20px 24px"}}>
        {data.length === 0 ? (
          <div style={{textAlign:"center",padding:60,color:"#252525",fontFamily:"monospace",fontSize:12}}>No rep data yet.</div>
        ) : (
          <div style={{display:"grid",gap:10,maxWidth:700,margin:"0 auto"}}>
            {data.map((rep, i) => (
              <div key={rep.name} style={{background:"#0d0d0d",border:`1px solid ${i===0?"#cc2222":i===1?"#555":i===2?"#6b4400":"#1a1a1a"}`,borderRadius:10,padding:"16px 20px",display:"flex",alignItems:"center",gap:16}}>
                <div style={{fontSize:28,width:40,textAlign:"center",flexShrink:0}}>{medals[i] || `${i+1}`}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:15,fontWeight:700,color:"#e8e8e8",marginBottom:4}}>{rep.name}</div>
                  <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
                    {[
                      [rep.todayCIs, "today"],
                      [rep.periodCIs, "check-ins"],
                      [rep.verified, "verified"],
                      [rep.reports, "reports"],
                    ].map(([val, label]) => (
                      <div key={label} style={{textAlign:"center"}}>
                        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color:i===0?"#cc2222":"#e8e8e8",lineHeight:1}}>{val}</div>
                        <div style={{fontSize:8,color:"#444",fontFamily:"monospace",letterSpacing:1}}>{label.toUpperCase()}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,color:i===0?"#cc2222":i===1?"#aaa":i===2?"#cd7f32":"#555",lineHeight:1}}>{rep.score}</div>
                  <div style={{fontSize:8,color:"#444",fontFamily:"monospace",letterSpacing:1}}>SCORE</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  DIGITAL PROPOSAL BUILDER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const EQUIPMENT_LIST = [
  "Excavator (Mini)",
  "Excavator (Mid)",
  "Excavator (Large)",
  "Skid Steer",
  "Track Loader",
  "Wheel Loader",
  "Dozer",
  "Motor Grader",
  "Compactor (Plate)",
  "Compactor (Roller)",
  "Boom Lift",
  "Scissor Lift",
  "Telehandler",
  "Dump Truck",
  "Light Tower",
  "Generator",
  "Air Compressor",
  "Concrete Mixer",
  "Trencher",
  "Other",
];

function ProposalBuilder({ onClose }) {
  const [company, setCompany]   = useState("");
  const [contact, setContact]   = useState("");
  const [email, setEmail]       = useState("");
  const [items, setItems]       = useState([{ equipment: "Excavator (Mini)", qty: 1, duration: "1 week", rate: "" }]);
  const [notes, setNotes]       = useState("");
  const [sending, setSending]   = useState(false);
  const [preview, setPreview]   = useState(false);

  let repName = "";
  try {
    const token = JSON.parse(localStorage.getItem("sb_session")||"{}").access_token || SUPABASE_KEY;
    const payload = JSON.parse(atob(token.split(".")[1]));
    repName = payload.user_metadata?.full_name || payload.email?.split("@")[0] || "Rep";
  } catch {}

  const addItem = () => setItems(prev => [...prev, { equipment: "Skid Steer", qty: 1, duration: "1 week", rate: "" }]);
  const updateItem = (i, k, v) => setItems(prev => prev.map((item, j) => j===i ? {...item,[k]:v} : item));
  const removeItem = (i) => setItems(prev => prev.filter((_,j)=>j!==i));

  const totalValue = items.reduce((s,item) => s + (parseFloat(item.rate)||0) * (parseInt(item.qty)||1), 0);

  const proposalText = `EQUIPMENT RENTAL PROPOSAL
${"─".repeat(50)}
Date: ${new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}
Prepared by: ${repName} — EquipmentShare

TO:
${company}
${contact}

PROPOSED EQUIPMENT
${"─".repeat(50)}
${items.map((item,i) => `${i+1}. ${item.equipment}
   Qty: ${item.qty} | Duration: ${item.duration} | Rate: ${item.rate?`$${item.rate}/day`:"TBD"}
`).join("")}
${"─".repeat(50)}
ESTIMATED TOTAL: ${totalValue > 0 ? `$${totalValue.toLocaleString()}` : "TBD"}

NOTES:
${notes || "N/A"}

${"─".repeat(50)}
This proposal is for discussion purposes only.
Contact ${repName} to finalize terms.
EquipmentShare | T3 Technology Platform`;

  const sendEmail = () => {
    const subject = encodeURIComponent(`Equipment Rental Proposal — EquipmentShare`);
    const body = encodeURIComponent(proposalText);
    window.open(`mailto:${email}?subject=${subject}&body=${body}`);
    setSending(false);
  };

  const copyProposal = () => {
    navigator.clipboard.writeText(proposalText);
    alert("Proposal copied to clipboard!");
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.9)",zIndex:700,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:"#0d0d0d",border:"1px solid #333",borderRadius:12,width:"100%",maxWidth:600,maxHeight:"95vh",display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <div style={{padding:"16px 20px",borderBottom:"1px solid #1a1a1a",display:"flex",alignItems:"center"}}>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,letterSpacing:3,color:"#e8e8e8"}}>
            {preview ? "PROPOSAL PREVIEW" : "BUILD PROPOSAL"}
          </div>
          <button onClick={onClose} style={{marginLeft:"auto",background:"none",border:"none",color:"#555",fontSize:22,cursor:"pointer"}}>×</button>
        </div>

        <div style={{flex:1,overflowY:"auto",padding:"16px 20px"}}>
          {preview ? (
            <pre style={{fontFamily:"monospace",fontSize:11,color:"#888",lineHeight:1.8,whiteSpace:"pre-wrap"}}>{proposalText}</pre>
          ) : (
            <>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
                {[["Company Name","company",company,setCompany],["Contact Name","contact",contact,setContact]].map(([label,key,val,setter]) => (
                  <div key={key}>
                    <label style={{fontSize:9,color:"#555",fontFamily:"monospace",letterSpacing:1,display:"block",marginBottom:4}}>{label.toUpperCase()}</label>
                    <input value={val} onChange={e=>setter(e.target.value)} placeholder={label}
                      style={{width:"100%",background:"#111",border:"1px solid #222",borderRadius:5,color:"#e8e8e8",padding:"8px 10px",fontSize:12,outline:"none",boxSizing:"border-box"}}/>
                  </div>
                ))}
                <div style={{gridColumn:"1/-1"}}>
                  <label style={{fontSize:9,color:"#555",fontFamily:"monospace",letterSpacing:1,display:"block",marginBottom:4}}>CONTACT EMAIL</label>
                  <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="contact@company.com"
                    style={{width:"100%",background:"#111",border:"1px solid #222",borderRadius:5,color:"#4a9eff",padding:"8px 10px",fontSize:12,outline:"none",boxSizing:"border-box"}}/>
                </div>
              </div>

              <div style={{fontSize:9,color:"#555",fontFamily:"monospace",letterSpacing:1,marginBottom:8}}>EQUIPMENT ITEMS</div>
              {items.map((item, i) => (
                <div key={i} style={{background:"#111",border:"1px solid #1a1a1a",borderRadius:6,padding:"10px 12px",marginBottom:8}}>
                  <div style={{display:"grid",gridTemplateColumns:"2fr 60px 1fr 80px 24px",gap:8,alignItems:"center"}}>
                    <select value={item.equipment} onChange={e=>updateItem(i,"equipment",e.target.value)}
                      style={{background:"#0d0d0d",border:"1px solid #222",borderRadius:4,color:"#e8e8e8",padding:"6px 8px",fontSize:11,outline:"none"}}>
                      {EQUIPMENT_LIST.map(eq => <option key={eq} value={eq}>{eq}</option>)}
                    </select>
                    <input type="number" value={item.qty} onChange={e=>updateItem(i,"qty",e.target.value)} min="1" placeholder="Qty"
                      style={{background:"#0d0d0d",border:"1px solid #222",borderRadius:4,color:"#e8e8e8",padding:"6px 8px",fontSize:11,outline:"none",width:"100%",boxSizing:"border-box"}}/>
                    <select value={item.duration} onChange={e=>updateItem(i,"duration",e.target.value)}
                      style={{background:"#0d0d0d",border:"1px solid #222",borderRadius:4,color:"#888",padding:"6px 8px",fontSize:11,outline:"none"}}>
                      {["1 day","3 days","1 week","2 weeks","1 month","3 months","6 months"].map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <input type="number" value={item.rate} onChange={e=>updateItem(i,"rate",e.target.value)} placeholder="$/day"
                      style={{background:"#0d0d0d",border:"1px solid #222",borderRadius:4,color:"#4ae87a",padding:"6px 8px",fontSize:11,outline:"none",width:"100%",boxSizing:"border-box"}}/>
                    <button onClick={()=>removeItem(i)} style={{background:"none",border:"none",color:"#553333",cursor:"pointer",fontSize:14,padding:0}}>✕</button>
                  </div>
                </div>
              ))}
              <button onClick={addItem} style={{width:"100%",padding:"8px",background:"transparent",border:"1px dashed #222",borderRadius:5,color:"#444",cursor:"pointer",fontSize:11,fontFamily:"monospace",marginBottom:14}}>
                + ADD EQUIPMENT
              </button>

              {totalValue > 0 && (
                <div style={{textAlign:"right",fontSize:13,color:"#4ae87a",fontFamily:"monospace",marginBottom:14,fontWeight:700}}>
                  EST. TOTAL: ${totalValue.toLocaleString()}
                </div>
              )}

              <div>
                <label style={{fontSize:9,color:"#555",fontFamily:"monospace",letterSpacing:1,display:"block",marginBottom:5}}>NOTES</label>
                <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3} placeholder="Special terms, delivery notes, T3 platform value props..."
                  style={{width:"100%",background:"#111",border:"1px solid #222",borderRadius:5,color:"#888",padding:"8px 10px",fontSize:12,outline:"none",resize:"vertical",boxSizing:"border-box",fontFamily:"inherit"}}/>
              </div>
            </>
          )}
        </div>

        <div style={{padding:"12px 20px",borderTop:"1px solid #1a1a1a",display:"flex",gap:8}}>
          <button onClick={()=>setPreview(p=>!p)} style={{padding:"9px 14px",background:"#111",border:"1px solid #333",borderRadius:5,color:"#888",cursor:"pointer",fontSize:11,fontFamily:"monospace"}}>
            {preview?"✎ EDIT":"👁 PREVIEW"}
          </button>
          <button onClick={copyProposal} style={{padding:"9px 14px",background:"#111",border:"1px solid #333",borderRadius:5,color:"#888",cursor:"pointer",fontSize:11,fontFamily:"monospace"}}>
            📋 COPY
          </button>
          {email && (
            <button onClick={sendEmail} style={{flex:1,padding:"9px",background:"#cc2222",border:"none",borderRadius:5,color:"#fff",cursor:"pointer",fontSize:12,fontWeight:700}}>
              ✉ SEND TO {email.split("@")[0].toUpperCase()}
            </button>
          )}
          {!email && (
            <button disabled style={{flex:1,padding:"9px",background:"#1a1a1a",border:"none",borderRadius:5,color:"#333",fontSize:12}}>
              ADD EMAIL TO SEND
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  WEATHER OVERLAY HELPER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function WeatherWidget() {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      async pos => {
        try {
          const { latitude: lat, longitude: lon } = pos.coords;
          const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weathercode,windspeed_10m,precipitation&temperature_unit=fahrenheit&windspeed_unit=mph&forecast_days=1`);
          const d = await r.json();
          const code = d.current?.weathercode;
          const desc = code <= 1 ? "Clear" : code <= 3 ? "Partly Cloudy" : code <= 9 ? "Cloudy" : code <= 29 ? "Drizzle" : code <= 39 ? "Fog" : code <= 49 ? "Freezing Drizzle" : code <= 59 ? "Rain" : code <= 69 ? "Snow" : code <= 79 ? "Snow" : code <= 99 ? "Thunderstorm" : "Unknown";
          const icon = code <= 1 ? "☀️" : code <= 3 ? "⛅" : code <= 9 ? "☁️" : code <= 69 ? "🌧️" : code <= 79 ? "❄️" : code <= 99 ? "⛈️" : "🌡️";
          setWeather({ temp: Math.round(d.current.temperature_2m), desc, icon, wind: Math.round(d.current.windspeed_10m), precip: d.current.precipitation });
        } catch(e) { setError("Weather unavailable"); }
        setLoading(false);
      },
      () => { setError("Location needed"); setLoading(false); },
      { timeout: 8000 }
    );
  }, []);

  if (loading) return <div style={{fontSize:10,color:"#333",fontFamily:"monospace"}}>⏳ WEATHER</div>;
  if (error || !weather) return <div style={{fontSize:10,color:"#333",fontFamily:"monospace"}}>{error||"—"}</div>;

  const fieldSafe = weather.precip < 0.1 && weather.wind < 25;
  return (
    <div style={{display:"flex",alignItems:"center",gap:8,padding:"4px 12px",background:"#111",border:`1px solid ${fieldSafe?"#1a4a1a":"#4a2a1a"}`,borderRadius:20}}>
      <span style={{fontSize:14}}>{weather.icon}</span>
      <span style={{fontSize:11,color:"#e8e8e8",fontFamily:"monospace"}}>{weather.temp}°F</span>
      <span style={{fontSize:9,color:fieldSafe?"#4ae87a":"#e8873a",fontFamily:"monospace",fontWeight:700}}>{fieldSafe?"✓ FIELD OK":"⚠ CHECK CONDITIONS"}</span>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  AUTOPLAY FOLLOW-UP ENGINE  (Surfaces overdue prospects)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function AutoPlayPanel({ companies, checkIns, followUps }) {
  const today = new Date();

  // Overdue follow-ups
  const overdue = followUps.filter(f => new Date(f.date) <= today);

  // Companies not visited in 30+ days
  const stale = companies.filter(c => {
    const myCIs = checkIns.filter(ci => ci.company_id === c.id);
    if (myCIs.length === 0) return true;
    const last = new Date(myCIs.sort((a,b) => new Date(b.checked_in_at)-new Date(a.checked_in_at))[0].checked_in_at);
    return Math.floor((today - last) / 86400000) >= 30;
  }).filter(c => c.priority === "High").slice(0, 5);

  if (overdue.length === 0 && stale.length === 0) return null;

  return (
    <div style={{background:"#0d0d0d",border:"1px solid #1a1a1a",borderRadius:8,overflow:"hidden",marginBottom:16}}>
      <div style={{padding:"10px 16px",borderBottom:"1px solid #1a1a1a",display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontSize:14}}>⚡</span>
        <div style={{fontSize:10,color:"#e8873a",fontFamily:"monospace",letterSpacing:2,fontWeight:700}}>ACTION REQUIRED</div>
        <div style={{marginLeft:"auto",fontSize:9,color:"#444",fontFamily:"monospace"}}>{overdue.length + stale.length} items</div>
      </div>
      {overdue.map((f, i) => (
        <div key={i} style={{padding:"10px 16px",borderBottom:"1px solid #111",display:"flex",gap:10,alignItems:"center"}}>
          <span style={{fontSize:11}}>📅</span>
          <div style={{flex:1}}>
            <div style={{fontSize:12,fontWeight:600,color:"#e8e8e8"}}>{f.companyName}</div>
            <div style={{fontSize:10,color:"#cc2222",fontFamily:"monospace"}}>Follow-up due {new Date(f.date).toLocaleDateString("en-US",{month:"short",day:"numeric"})}{f.note && ` · ${f.note}`}</div>
          </div>
        </div>
      ))}
      {stale.map((c, i) => {
        const dc = DAY_CONFIG[c.day] || DAY_CONFIG.Monday;
        return (
          <div key={c.id} style={{padding:"10px 16px",borderBottom:"1px solid #111",display:"flex",gap:10,alignItems:"center"}}>
            <span style={{fontSize:11}}>⏰</span>
            <div style={{flex:1}}>
              <div style={{fontSize:12,fontWeight:600,color:"#e8e8e8"}}>{c.name}</div>
              <div style={{fontSize:10,color:"#555"}}><span style={{color:dc.color,fontFamily:"monospace"}}>{dc.label}</span> · {c.town} · Not visited in 30+ days</div>
            </div>
            {c.phone && <a href={`tel:${c.phone}`} style={{padding:"5px 10px",background:"#1a1a1a",border:"1px solid #333",borderRadius:4,color:"#e8e8e8",fontSize:10,textDecoration:"none"}}>📞</a>}
          </div>
        );
      })}
    </div>
  );
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  LASSO ROUTE OPTIMIZER
//  Draw a circle → auto-generates optimal route through all
//  companies inside it using nearest-neighbor algorithm
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Nearest-neighbor TSP heuristic — fast and good enough for <50 stops
function optimizeRoute(stops) {
  if (stops.length <= 2) return stops;
  const unvisited = [...stops];
  const route = [unvisited.shift()]; // start with first stop

  while (unvisited.length > 0) {
    const last = route[route.length - 1];
    let nearest = 0;
    let nearestDist = Infinity;

    unvisited.forEach((stop, i) => {
      if (!stop.lat || !stop.lng || !last.lat || !last.lng) return;
      const d = Math.sqrt(
        Math.pow(stop.lat - last.lat, 2) +
        Math.pow(stop.lng - last.lng, 2)
      );
      if (d < nearestDist) { nearestDist = d; nearest = i; }
    });

    route.push(unvisited.splice(nearest, 1)[0]);
  }
  return route;
}

// Point in circle check
function pointInCircle(lat, lng, centerLat, centerLng, radiusDeg) {
  const d = Math.sqrt(
    Math.pow(lat - centerLat, 2) +
    Math.pow(lng - centerLng, 2)
  );
  return d <= radiusDeg;
}

function LassoModal({ companies, onAccept, onClose }) {
  const [mode, setMode]           = useState("draw");   // draw | result
  const [selected, setSelected]   = useState([]);
  const [optimized, setOptimized] = useState([]);
  const [radiusMiles, setRadiusMiles] = useState(15);
  const [centerTown, setCenterTown]   = useState("");
  const mapRef  = useRef(null);
  const leafRef = useRef(null);

  // Town center coords for lasso center
  const TOWN_COORDS = {
    "Torrington":{lat:41.8005,lng:-73.1212},
    "Winsted":{lat:41.9282,lng:-73.0626},
    "New Milford":{lat:41.5776,lng:-73.4082},
    "Litchfield":{lat:41.7490,lng:-73.1876},
    "Waterbury":{lat:41.5582,lng:-73.0515},
    "Pittsfield":{lat:42.4501,lng:-73.2553},
    "Springfield":{lat:42.1015,lng:-72.5898},
    "Salisbury":{lat:41.9790,lng:-73.4204},
    "Great Barrington":{lat:42.1959,lng:-73.3626},
    "Hartford":{lat:41.7620,lng:-72.6850},
  };

  useEffect(() => {
    if (!mapRef.current || leafRef.current) return;
    const L = window.L;
    if (!L) return;

    const map = L.map(mapRef.current, { center:[42.05,-73.15], zoom:8 });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      { attribution:"© CARTO", maxZoom:19 }).addTo(map);

    const companyLayer = L.layerGroup().addTo(map);
    const lassoLayer   = L.layerGroup().addTo(map);

    leafRef.current = { map, companyLayer, lassoLayer };
    setTimeout(() => map.invalidateSize(), 100);

    // Plot all companies
    const withCoords = companies.filter(c => c.lat && c.lng);
    withCoords.forEach(c => {
      const dc = DAY_CONFIG[c.day] || DAY_CONFIG.Monday;
      const icon = L.divIcon({
        className:"",
        iconSize:[16,22], iconAnchor:[8,22],
        html:`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="22" viewBox="0 0 16 22">
          <path d="M8 0C3.6 0 0 3.6 0 8c0 6 8 14 8 14s8-8 8-14C16 3.6 12.4 0 8 0z" fill="${dc.color}" opacity="0.8"/>
          <circle cx="8" cy="8" r="4" fill="#0a0a0a"/>
        </svg>`,
      });
      L.marker([c.lat, c.lng], { icon })
        .bindTooltip(`<div style="font-family:monospace;font-size:11px;background:#111;color:#f5f5f5;padding:4px 8px;border-radius:4px">${c.name}</div>`, { direction:"top" })
        .addTo(companyLayer);
    });
  }, []);

  const runLasso = () => {
    const tc = TOWN_COORDS[centerTown];
    if (!tc) { alert("Select a town center first"); return; }
    const { map, lassoLayer } = leafRef.current;
    const L = window.L;

    lassoLayer.clearLayers();

    // Convert miles to approximate degrees (1 deg lat ≈ 69 miles)
    const radiusDeg = radiusMiles / 69;

    // Draw circle on map
    L.circle([tc.lat, tc.lng], {
      radius: radiusMiles * 1609.34,
      color: "#cc2222", weight: 2,
      fillColor: "#cc2222", fillOpacity: 0.08,
      dashArray: "6 4",
    }).addTo(lassoLayer);

    // Find companies inside circle
    const inside = companies.filter(c =>
      c.lat && c.lng && pointInCircle(c.lat, c.lng, tc.lat, tc.lng, radiusDeg)
    );

    if (inside.length === 0) {
      alert("No companies found in that radius. Try a larger radius or different town.");
      return;
    }

    // Optimize route
    const optimizedRoute = optimizeRoute(inside);
    setSelected(inside);
    setOptimized(optimizedRoute);

    // Draw optimized route on map
    const coords = optimizedRoute.filter(s => s.lat && s.lng).map(s => [s.lat, s.lng]);
    L.polyline(coords, { color:"#cc2222", weight:2.5, opacity:0.8, dashArray:"5 4" }).addTo(lassoLayer);

    // Numbered markers
    optimizedRoute.forEach((c, i) => {
      if (!c.lat || !c.lng) return;
      L.divIcon({
        className:"",
        iconSize:[22,22], iconAnchor:[11,11],
        html:`<div style="width:22px;height:22px;border-radius:50%;background:#cc2222;border:2px solid #fff;display:flex;align-items:center;justify-content:center;font-family:monospace;font-size:9px;font-weight:bold;color:#fff">${i+1}</div>`,
      });
      L.marker([c.lat, c.lng], {
        icon: L.divIcon({
          className:"",
          iconSize:[22,22], iconAnchor:[11,11],
          html:`<div style="width:22px;height:22px;border-radius:50%;background:#cc2222;border:2px solid #0a0a0a;display:flex;align-items:center;justify-content:center;font-family:monospace;font-size:9px;font-weight:bold;color:#fff">${i+1}</div>`,
        })
      }).addTo(lassoLayer);
    });

    // Fit map to circle
    map.fitBounds(L.circle([tc.lat, tc.lng], { radius: radiusMiles * 1609.34 }).getBounds(), { padding:[20,20] });
    setMode("result");
  };

  const totalMiles = () => {
    if (optimized.length < 2) return 0;
    let total = 0;
    for (let i = 0; i < optimized.length-1; i++) {
      const a = optimized[i], b = optimized[i+1];
      if (!a.lat||!a.lng||!b.lat||!b.lng) continue;
      const R = 3958.8;
      const dLat = (b.lat-a.lat)*Math.PI/180;
      const dLng = (b.lng-a.lng)*Math.PI/180;
      const x = Math.sin(dLat/2)**2 + Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.sin(dLng/2)**2;
      total += R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
    }
    return total;
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",zIndex:800,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:"#0a0a0a",border:"1px solid #cc2222",borderRadius:12,width:"100%",maxWidth:900,height:"85vh",display:"flex",flexDirection:"column",overflow:"hidden"}}>

        {/* Header */}
        <div style={{padding:"14px 20px",borderBottom:"1px solid #1a1a1a",display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
          <div>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,letterSpacing:3,color:"#e8e8e8"}}>LASSO ROUTE OPTIMIZER</div>
            <div style={{fontSize:10,color:"#444",fontFamily:"monospace",letterSpacing:1}}>SELECT A ZONE · AUTO-OPTIMIZE ROUTE</div>
          </div>
          <button onClick={onClose} style={{marginLeft:"auto",background:"none",border:"none",color:"#555",fontSize:22,cursor:"pointer"}}>×</button>
        </div>

        {/* Controls */}
        <div style={{padding:"12px 20px",borderBottom:"1px solid #1a1a1a",display:"flex",gap:10,alignItems:"center",flexWrap:"wrap",flexShrink:0}}>
          <div>
            <div style={{fontSize:9,color:"#444",fontFamily:"monospace",letterSpacing:1,marginBottom:4}}>CENTER ON TOWN</div>
            <select value={centerTown} onChange={e=>setCenterTown(e.target.value)}
              style={{background:"#111",border:"1px solid #333",borderRadius:5,color:"#e8e8e8",padding:"7px 12px",fontSize:12,outline:"none"}}>
              <option value="">Select town...</option>
              {Object.keys(TOWN_COORDS).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <div style={{fontSize:9,color:"#444",fontFamily:"monospace",letterSpacing:1,marginBottom:4}}>RADIUS</div>
            <select value={radiusMiles} onChange={e=>setRadiusMiles(Number(e.target.value))}
              style={{background:"#111",border:"1px solid #333",borderRadius:5,color:"#888",padding:"7px 12px",fontSize:12,outline:"none"}}>
              {[5,10,15,20,30,50].map(r => <option key={r} value={r}>{r} miles</option>)}
            </select>
          </div>
          <button onClick={runLasso} disabled={!centerTown}
            style={{padding:"8px 20px",background:centerTown?"#cc2222":"#222",border:"none",borderRadius:6,color:centerTown?"#fff":"#444",cursor:centerTown?"pointer":"default",fontSize:12,fontWeight:700,fontFamily:"monospace",letterSpacing:1,marginTop:16}}>
            ⭕ LASSO ROUTE
          </button>
          {mode==="result" && (
            <>
              <div style={{marginLeft:"auto",textAlign:"right"}}>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:"#cc2222",lineHeight:1}}>{optimized.length}</div>
                <div style={{fontSize:8,color:"#444",fontFamily:"monospace",letterSpacing:1}}>STOPS</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:"#4a9eff",lineHeight:1}}>{totalMiles().toFixed(1)}</div>
                <div style={{fontSize:8,color:"#444",fontFamily:"monospace",letterSpacing:1}}>MILES</div>
              </div>
              <button onClick={()=>onAccept(optimized)} style={{padding:"8px 20px",background:"#0a3a1a",border:"1px solid #2a6a2a",borderRadius:6,color:"#4ae87a",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"monospace",letterSpacing:1,marginTop:16}}>
                ✓ USE THIS ROUTE
              </button>
            </>
          )}
        </div>

        {/* Map + stop list */}
        <div style={{display:"flex",flex:1,overflow:"hidden"}}>
          <div ref={mapRef} style={{flex:1,minHeight:0}}/>
          {mode==="result" && optimized.length > 0 && (
            <div style={{width:220,borderLeft:"1px solid #1a1a1a",overflowY:"auto",background:"#0d0d0d",flexShrink:0}}>
              <div style={{padding:"8px 12px",borderBottom:"1px solid #141414",fontSize:9,color:"#444",fontFamily:"monospace",letterSpacing:1}}>OPTIMIZED ORDER</div>
              {optimized.map((c, i) => {
                const dc = DAY_CONFIG[c.day] || DAY_CONFIG.Monday;
                return (
                  <div key={c.id||i} style={{padding:"8px 12px",borderBottom:"1px solid #111",display:"flex",gap:8,alignItems:"center"}}>
                    <div style={{width:20,height:20,borderRadius:"50%",background:"#cc2222",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      <span style={{fontSize:9,color:"#fff",fontWeight:700,fontFamily:"monospace"}}>{i+1}</span>
                    </div>
                    <div style={{flex:1,overflow:"hidden"}}>
                      <div style={{fontSize:11,fontWeight:600,color:"#e8e8e8",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.name}</div>
                      <div style={{fontSize:9,color:"#555",fontFamily:"monospace"}}><span style={{color:dc.color}}>{dc.label}</span> · {c.town}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState("bids");
  const [session, setSession] = useState(() => getSession());
  const [userRoutes, setUserRoutes] = useState({});
  const [editingRoutes, setEditingRoutes] = useState(false);
  const [routeDraft, setRouteDraft] = useState({});
  const [onboarded, setOnboarded] = useState(null); // null=loading, false=show wizard, true=done
  const [companies_app, setAppCompanies] = useState([]);
  const [checkIns_app, setAppCheckIns] = useState([]);
  const [bids_app, setAppBids] = useState([]);
  const [followUps, setFollowUps]       = useState([]);
  const [showProposal, setShowProposal] = useState(false);
  const [showNearby, setShowNearby]     = useState(false);
  const isOnline = useOnlineStatus();

  // Listen for auth state
  useEffect(() => {
    const s = getSession();
    setSession(s);
  }, []);

  // Check onboarding status
  useEffect(() => {
    const uid = getUserId();
    if (!uid) { setOnboarded(false); return; }
    const token = JSON.parse(localStorage.getItem("sb_session")||"{}").access_token || SUPABASE_KEY;
    fetch(`${SUPABASE_URL}/rest/v1/user_settings?user_id=eq.${uid}&key=eq.onboarded&select=value`, {
      headers: {"apikey": SUPABASE_KEY, "Authorization": `Bearer ${token}`}
    })
    .then(r => r.json())
    .then(d => setOnboarded(d?.[0]?.value === "true"))
    .catch(() => setOnboarded(true)); // fail open
  }, [session]);

  // Load companies + check-ins for prospect score panel
  useEffect(() => {
    const uid = getUserId();
    if (!uid) return;
    const token = JSON.parse(localStorage.getItem("sb_session")||"{}").access_token || SUPABASE_KEY;
    // Companies
    const cacheKey = `companies_${uid}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) { try { setAppCompanies(JSON.parse(cached)); } catch {} }
    fetch(`${SUPABASE_URL}/rest/v1/companies?select=*&user_id=eq.${uid}&order=id.asc&limit=1000`, {
      headers: {"apikey": SUPABASE_KEY, "Authorization": `Bearer ${token}`}
    }).then(r => r.json()).then(d => { if (Array.isArray(d)) { setAppCompanies(d); localStorage.setItem(cacheKey, JSON.stringify(d)); } }).catch(() => {});
    // Check-ins
    fetch(`${SUPABASE_URL}/rest/v1/check_ins?user_id=eq.${uid}&order=checked_in_at.desc&limit=200`, {
      headers: {"apikey": SUPABASE_KEY, "Authorization": `Bearer ${token}`}
    }).then(r => r.json()).then(d => { if (Array.isArray(d)) setAppCheckIns(d); }).catch(() => {});
    // Bids
    fetch(`${SUPABASE_URL}/rest/v1/projects?select=*&user_id=eq.${uid}&order=id.asc&limit=2000`, {
      headers: {"apikey": SUPABASE_KEY, "Authorization": `Bearer ${token}`}
    }).then(r => r.json()).then(d => { if (Array.isArray(d)) setAppBids(d.map ? d.map(fromDB) : []); }).catch(() => {});
    // Follow-ups
    fetch(`${SUPABASE_URL}/rest/v1/user_settings?user_id=eq.${uid}&key=like.followup_%&select=value`, {
      headers: {"apikey": SUPABASE_KEY, "Authorization": `Bearer ${token}`}
    }).then(r => r.json()).then(d => {
      if (Array.isArray(d)) setFollowUps(d.map(s => { try { return JSON.parse(s.value); } catch { return null; } }).filter(Boolean));
    }).catch(() => {});
    // Flush any offline queued actions
    if (navigator.onLine) flushOfflineQueue(uid, token).then(n => n > 0 && console.log(`Flushed ${n} offline actions`)).catch(() => {});
  }, [session]);

  // Load user route names from Supabase
  useEffect(() => {
    const uid = getUserId();
    if (!uid) return;
    const token = JSON.parse(localStorage.getItem("sb_session")||"{}").access_token || SUPABASE_KEY;
    fetch(`${SUPABASE_URL}/rest/v1/user_settings?user_id=eq.${uid}&key=eq.routes&select=value`, {
      headers: {"apikey": SUPABASE_KEY, "Authorization": `Bearer ${token}`}
    })
    .then(r => r.json())
    .then(d => {
      if (d?.[0]?.value) {
        try {
          const routes = JSON.parse(d[0].value);
          setUserRoutes(routes);
          DAY_CONFIG = getDAYCONFIG(routes);
        } catch {}
      }
    })
    .catch(() => {});
  }, []);

  const saveRoutes = async (draft) => {
    const uid = getUserId();
    const token = JSON.parse(localStorage.getItem("sb_session")||"{}").access_token || SUPABASE_KEY;
    await fetch(`${SUPABASE_URL}/rest/v1/user_settings`, {
      method: "POST",
      headers: {"apikey": SUPABASE_KEY, "Authorization": `Bearer ${token}`, "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates,return=minimal"},
      body: JSON.stringify({user_id: uid, key: "routes", value: JSON.stringify(draft)})
    });
    setUserRoutes(draft);
    DAY_CONFIG = getDAYCONFIG(draft);
    setEditingRoutes(false);
  };

  // Not logged in — show login screen
  if (!session?.access_token) {
    return <LoginScreen />;
  }

  // Still checking onboarding status
  if (onboarded === null) {
    return (
      <div style={{minHeight:"100vh",background:"#0a0a0a",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div style={{color:"#333",fontFamily:"monospace",fontSize:12,letterSpacing:2}}>LOADING...</div>
      </div>
    );
  }

  // Show onboarding wizard for new users
  if (onboarded === false) {
    return <OnboardingWizard onComplete={({ name, territory, role, routes }) => {
      DAY_CONFIG = getDAYCONFIG(routes);
      setUserRoutes(routes);
      setOnboarded(true);
    }} />;
  }

  const NAV_ITEMS = [
    { id: "bids", label: "BID INTELLIGENCE", icon: "📋" },
    { id: "map",  label: "TERRITORY MAP",    icon: "🗺" },
    { id: "log",  label: "ACTIVITY LOG",      icon: "📅" },
    { id: "route", label: "ROUTE PLANNER",    icon: "🗺" },
    { id: "checkin",   label: "CHECK-IN",        icon: "📍" },
    { id: "mileage",   label: "MILEAGE",          icon: "🚗" },
    { id: "leaderboard", label: "LEADERBOARD",    icon: "🏆" },
  ];

  return (
    <div style={{ minHeight:"100vh", background:"#0a0a0a", fontFamily:"'DM Sans','Segoe UI',sans-serif", color:"#f5f5f5" }}>
      <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet"/>
      <style>{`
        * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }
        body { overscroll-behavior: none; }
        input, select, textarea, button { font-family: inherit; }
        @media (max-width: 768px) {
          .rr-nav { padding: 0 12px !important; height: 50px !important; overflow-x: auto; }
          .rr-nav-logo { display: none !important; }
          .rr-nav-right { gap: 6px !important; }
          .rr-nav-right span { display: none !important; }
          .rr-view { padding: 8px !important; }
          .rr-hide-mobile { display: none !important; }
          .rr-table-grid { grid-template-columns: 1fr 80px 70px 24px !important; }
        }
      `}</style>

      {/* ── Global Nav Bar ── */}
      <div className="rr-nav" style={{
        background:"#0f0f0f",
        borderBottom:"1px solid #1e1e1e",
        padding:"0 32px",
        display:"flex",
        alignItems:"stretch",
        height:54,
        position:"sticky",
        top:0,
        zIndex:999,
      }}>
        {/* Logo */}
        <div style={{ display:"flex", alignItems:"center", gap:12, marginRight:32, paddingRight:32, borderRight:"1px solid #1e1e1e" }}>
          {/* SVG Logo */}
          <a href="/" style={{textDecoration:"none",display:"flex",alignItems:"center"}}>
          <svg width="160" height="44" viewBox="0 0 160 44" style={{display:"block",flexShrink:0}}>
            {/* Route path */}
            <circle cx="10" cy="14" r="7" fill="#cc2222"/>
            <circle cx="10" cy="14" r="3" fill="#0a0a0a"/>
            <line x1="10" y1="21" x2="10" y2="28" stroke="#cc2222" strokeWidth="1.5"/>
            <line x1="10" y1="28" x2="28" y2="28" stroke="#333" strokeWidth="1.5"/>
            <circle cx="28" cy="28" r="2.5" fill="#444"/>
            <line x1="28" y1="28" x2="42" y2="20" stroke="#333" strokeWidth="1.5"/>
            <circle cx="42" cy="20" r="2.5" fill="#444"/>
            <line x1="42" y1="20" x2="56" y2="28" stroke="#333" strokeWidth="1.5"/>
            <circle cx="56" cy="28" r="2.5" fill="#444"/>
            <line x1="56" y1="28" x2="68" y2="22" stroke="#cc2222" strokeWidth="1.8"/>
            <circle cx="68" cy="22" r="3" fill="#cc2222"/>
            <circle cx="68" cy="22" r="1.5" fill="#0a0a0a"/>
            {/* Wordmark */}
            <text x="78" y="20" style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:2,fill:"#f0f0f0"}}>REP<tspan style={{fill:"#cc2222"}}>ROUTE</tspan></text>
            <text x="78" y="32" style={{fontFamily:"monospace",fontSize:7,letterSpacing:2,fill:"#555"}}>FIELD SALES · ROUTE INTELLIGENCE</text>
          </svg>
          </a>
        </div>

        {/* Nav tabs */}
        <div style={{ display:"flex", alignItems:"stretch", gap:4 }}>
          {NAV_ITEMS.map(item => {
            const active = view === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                style={{
                  background:"none",
                  border:"none",
                  borderBottom: active ? "2px solid #e8e8e8" : "2px solid transparent",
                  color: active ? "#ffffff" : "#555",
                  cursor:"pointer",
                  padding:"0 20px",
                  fontSize:11,
                  fontWeight:700,
                  letterSpacing:2,
                  fontFamily:"monospace",
                  display:"flex",
                  alignItems:"center",
                  gap:8,
                  transition:"all 0.15s",
                }}
                onMouseEnter={e => { if(!active) e.currentTarget.style.color = "#999"; }}
                onMouseLeave={e => { if(!active) e.currentTarget.style.color = "#555"; }}
              >
                <span style={{ fontSize:14 }}>{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Right side — sign out */}
        <div className="rr-nav-right" style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:8 }}>
          {!isOnline && <div style={{padding:"3px 10px",background:"#1a0a0a",border:"1px solid #cc2222",borderRadius:10,fontSize:9,color:"#cc2222",fontFamily:"monospace",letterSpacing:1}}>● OFFLINE</div>}
          <WeatherWidget />
          <button onClick={()=>setShowNearby(true)} style={{padding:"5px 10px",background:"none",border:"1px solid #2a2a2a",borderRadius:5,color:"#555",cursor:"pointer",fontSize:10}}>📍 NEARBY</button>
          <button onClick={()=>setShowProposal(true)} style={{padding:"5px 10px",background:"none",border:"1px solid #2a2a2a",borderRadius:5,color:"#555",cursor:"pointer",fontSize:10}}>📄 PROPOSAL</button>
          <span style={{ fontSize:9, color:"#333", fontFamily:"monospace", letterSpacing:1 }}>
            v2
          </span>
          <button onClick={()=>setView("prospects")} style={{padding:"5px 12px",background:view==="prospects"?"#1a0a0a":"none",border:`1px solid ${view==="prospects"?"#cc2222":"#2a2a2a"}`,borderRadius:5,color:view==="prospects"?"#cc2222":"#555",cursor:"pointer",fontSize:11}}>
            🎯 TOP PROSPECTS
          </button>
          <button onClick={()=>{setRouteDraft({...userRoutes});setEditingRoutes(true);}} style={{padding:"5px 12px",background:"none",border:"1px solid #2a2a2a",borderRadius:5,color:"#555",cursor:"pointer",fontSize:11}}>
            ⚙ ROUTES
          </button>
          <a href="/help" target="_blank" style={{padding:"5px 10px",background:"none",border:"1px solid #2a2a2a",borderRadius:5,color:"#444",cursor:"pointer",fontSize:10,fontFamily:"monospace",letterSpacing:1,textDecoration:"none"}}>?</a>
          <button onClick={signOut} style={{padding:"5px 12px",background:"none",border:"1px solid #2a2a2a",borderRadius:5,color:"#444",cursor:"pointer",fontSize:10,fontFamily:"monospace",letterSpacing:1}}>
            SIGN OUT
          </button>
        </div>
      </div>

      {/* ── View Content ── */}
      <div style={{ display: view === "bids" ? "block" : "none" }}>
        <BidTracker />
      </div>
      <div style={{ display: view === "map" ? "block" : "none" }}>
        <TerritoryMap />
      </div>
      <div style={{ display: view === "log" ? "block" : "none" }}>
        <ActivityLog />
      </div>
      <div style={{ display: view === "route" ? "block" : "none" }}>
        <RoutePlanner />
      </div>
      <div style={{ display: view === "checkin" ? "block" : "none" }}>
        <CheckIn />
      </div>
      {view === "prospects" && (
        <div style={{padding:"20px 32px",background:"#0a0a0a",minHeight:"calc(100vh - 54px)"}}>
          <div style={{maxWidth:800,margin:"0 auto"}}>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:24,letterSpacing:3,color:"#e8e8e8",marginBottom:6}}>TOP PROSPECTS</div>
            <div style={{fontSize:10,color:"#444",fontFamily:"monospace",letterSpacing:2,marginBottom:20}}>RANKED BY PRIORITY · VISIT HISTORY · LOCAL BIDS</div>
            <AutoPlayPanel companies={companies_app} checkIns={checkIns_app} followUps={followUps}/>
            <ProspectScorePanel
              companies={companies_app}
              checkIns={checkIns_app}
              bids={bids_app}
              onSelectCompany={c => { setView("map"); }}
            />
          </div>
        </div>
      )}
      {view === "mileage" && <MileageTracker />}
      {view === "leaderboard" && <RepLeaderboard />}

      {/* ── Global modals (available from any view) ── */}
      {showProposal && <ProposalBuilder onClose={()=>setShowProposal(false)} />}
      {showNearby && (
        <NearbyProspects
          onClose={()=>setShowNearby(false)}
          onAddCompany={c => {
            setShowNearby(false);
            setView("map");
          }}
        />
      )}

      {/* ── Route names modal ── */}
      {editingRoutes && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"#0d0d0d",border:"1px solid #222",borderRadius:12,padding:32,width:420,fontFamily:"'DM Sans',sans-serif"}}>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,letterSpacing:3,color:"#e8e8e8",marginBottom:6}}>CUSTOMIZE ROUTES</div>
            <div style={{fontSize:11,color:"#444",fontFamily:"monospace",letterSpacing:1,marginBottom:20}}>Name each day route for your territory</div>
            {Object.entries(DEFAULT_DAY_CONFIG).map(([day, dc]) => (
              <div key={day} style={{marginBottom:12,display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:36,height:36,borderRadius:6,background:dc.bg,border:`1px solid ${dc.border}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <span style={{fontFamily:"monospace",fontSize:9,fontWeight:700,color:dc.color,letterSpacing:1}}>{dc.label}</span>
                </div>
                <input
                  value={routeDraft[day] ?? dc.desc}
                  onChange={e => setRouteDraft(d => ({...d, [day]: e.target.value}))}
                  placeholder={dc.desc}
                  style={{flex:1,background:"#111",border:`1px solid ${dc.border}`,borderRadius:5,color:"#e8e8e8",padding:"8px 10px",fontSize:12,outline:"none",fontFamily:"'DM Sans',sans-serif"}}
                />
              </div>
            ))}
            <div style={{display:"flex",gap:10,marginTop:24,justifyContent:"flex-end"}}>
              <button onClick={()=>setEditingRoutes(false)} style={{padding:"8px 16px",background:"none",border:"1px solid #333",borderRadius:6,color:"#555",cursor:"pointer",fontSize:12}}>Cancel</button>
              <button onClick={()=>saveRoutes(routeDraft)} style={{padding:"8px 20px",background:"#cc2222",border:"none",borderRadius:6,color:"#fff",cursor:"pointer",fontSize:12,fontWeight:600}}>Save Routes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
