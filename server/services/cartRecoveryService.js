const { google } = require('googleapis');
const trackingUtils = require('../utils/trackingUtils');
const whatsappProvider = require('./whatsapp/provider');
const googleSheetsService = require('./googleSheetsService');

// State tracking for DRY RUN
const IS_DRY_RUN = true; 

const SHEET_NAME = 'Cart Recovery Analytics';
const ONE_HOUR = 60 * 60 * 1000;
const ONE_DAY = 24 * ONE_HOUR;

function getStrategy(ageHours, cartValue, isHighIntent) {
  if (ageHours >= 72) {
    if (cartValue > 500 || isHighIntent) {
      return { id: 'C', name: 'Discount Coupon Offer', coupon: 'RECOVER10' };
    }
  }
  if (ageHours >= 48) {
    return { id: 'B', name: 'Personalized Follow-Up', coupon: null };
  }
  if (ageHours >= 24) {
    return { id: 'A', name: 'Friendly Reminder', coupon: null };
  }
  return null;
}

/**
 * Main cart recovery job. 
 * Reads raw events, builds aggregation, matches against recovery history, triggers strategies.
 */
async function runRecoveryJob() {
  console.log('[CART_RECOVERY] Starting Agentic Cart Recovery Job... (DRY_RUN=' + IS_DRY_RUN + ')');
  
  const s = await googleSheetsService.sheets();
  const SHEET_ID = process.env.GOOGLE_SHEET_ID;

  // 1. Fetch current aggregation
  console.log('[CART_RECOVERY] Fetching current site aggregation...');
  const agg = await googleSheetsService.getAggregations();
  
  // 2. Fetch existing Recovery History to ensure exclusions
  console.log('[CART_RECOVERY] Fetching existing recovery logs...');
  let existingLogs = [];
  try {
    const res = await s.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${SHEET_NAME}!A2:Z` });
    existingLogs = res.data.values || [];
  } catch (e) {
    console.log('[CART_RECOVERY] No existing recovery sheet found. It will be created.');
  }

  // Build lookup maps for exclusions
  // Format: VisitorID_ProductID -> count / max level sent
  const recoveryHistory = new Map();
  existingLogs.forEach(row => {
    // VisitorID(0), Product(5), Status(10), Strategy(11)
    const vId = row[0];
    const pName = row[5];
    const status = row[10];
    const strat = row[11];
    
    if (vId && pName) {
      const key = `${vId}_${pName}`;
      if (!recoveryHistory.has(key)) recoveryHistory.set(key, { attempts: 0, lastStrategy: null, recovered: false });
      const hist = recoveryHistory.get(key);
      hist.attempts += 1;
      hist.lastStrategy = strat;
      if (row[15] === 'TRUE' || status === 'Recovered') hist.recovered = true;
    }
  });

  const now = Date.now();
  const newRecoveryRows = [];

  // 3. Scan Active Carts
  let messagesSent = 0;
  for (const inst of agg.cartInstances) {
    // Only looking at abandoned carts
    if (inst.purchasedAt) continue;

    const ageMs = now - inst.addedAt;
    const ageHours = ageMs / ONE_HOUR;

    // ELIGIBILITY WINDOW: >= 24h and <= 7 Days
    if (ageHours < 24 || ageHours > (7 * 24)) continue;

    const visitor = agg.visitorProfiles.find(v => v.visitorId === inst.visitorId);
    if (!visitor || !visitor.phone) continue; // Cannot recover without phone

    const key = `${inst.visitorId}_${inst.productId}`;
    const hist = recoveryHistory.get(key) || { attempts: 0, lastStrategy: null, recovered: false };

    // EXCLUSIONS
    if (hist.recovered) continue;
    if (hist.attempts >= 2) continue; // Max 2 attempts
    
    const isHighIntent = visitor.addToCarts > 2 || visitor.orders > 0;
    const strategy = getStrategy(ageHours, inst.price, isHighIntent);

    if (!strategy) continue;
    
    // Prevent resending the same strategy (e.g. don't send two "Friendly Reminders")
    if (hist.lastStrategy && hist.lastStrategy.includes(strategy.name)) continue;
    
    // DRY RUN LOGGING
    console.log(`[CART_RECOVERY_IDENTIFIED] Eligible cart: ${key} | Age: ${Math.round(ageHours)}h | Strategy: ${strategy.name}`);
    
    let waSent = 'FALSE';
    if (!IS_DRY_RUN) {
       console.log(`[WHATSAPP_RECOVERY_SENT] Sending WhatsApp to ${visitor.phone}`);
       // await whatsappProvider.sendRecoveryMessage(visitor.phone, strategy.name, inst.productId, strategy.coupon);
       waSent = 'TRUE';
    }

    if (strategy.coupon) {
      console.log(`[COUPON_GENERATED] Coupon ${strategy.coupon} generated for ${visitor.phone}`);
    }

    // Append to sheet array
    const createdAt = new Date(inst.addedAt).toISOString();
    const sentAt = new Date().toISOString();

    newRecoveryRows.push([
      inst.visitorId,
      visitor.phone,
      visitor.country,
      visitor.state,
      visitor.city,
      inst.productId,
      inst.category,
      inst.price,
      createdAt,
      Math.round(ageHours * 10) / 10,
      'Sent',
      strategy.name,
      waSent,
      sentAt,
      strategy.coupon || 'N/A',
      'FALSE', // Recovered
      0        // Recovered Revenue
    ]);
    
    messagesSent++;
  }

  // 4. Update the Google Sheet
  if (newRecoveryRows.length > 0) {
    console.log(`[CART_RECOVERY] Appending ${newRecoveryRows.length} rows to Google Sheets...`);
    
    if (existingLogs.length === 0) {
       // Setup KPI Formulas and Headers
       const kpisAndHeaders = [
         ['CART RECOVERY KPIs', '', '', '', ''],
         ['Recovered Revenue', '=SUMIF(P9:P, "TRUE", H9:H)', 'Recovered Orders', '=COUNTIF(P9:P, "TRUE")'],
         ['Recovery Rate', '=IF(COUNTA(A9:A)>0, COUNTIF(P9:P, "TRUE")/COUNTA(A9:A), 0)', 'Pending Recoveries', '=COUNTIF(K9:K, "Sent")'],
         ['High Value Recoveries', '=COUNTIFS(P9:P, "TRUE", H9:H, ">500")', '', ''],
         ['', '', '', '', ''],
         ['', '', '', '', ''],
         [
           'Visitor ID', 'Phone Number', 'Country', 'State', 'City', 'Product Name', 'Category', 
           'Cart Value', 'Cart Created At', 'Cart Age Hours', 'Recovery Status', 'Recovery Strategy', 
           'WhatsApp Sent', 'WhatsApp Sent At', 'Coupon Issued', 'Recovered', 'Recovered Revenue'
         ]
       ];
       await s.spreadsheets.values.update({
         spreadsheetId: SHEET_ID,
         range: `${SHEET_NAME}!A1:Q7`,
         valueInputOption: 'USER_ENTERED',
         requestBody: { values: kpisAndHeaders }
       });
       
       // Format Recovery Rate as percentage
       // Note: formatting requires batchUpdate which we skip to save API calls, formulas will handle the raw values
    }

    // Append rows
    await s.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A8:Q`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: newRecoveryRows }
    });
  }

  console.log('[RECOVERY_SUCCESS] Job completed successfully. Messages processed:', messagesSent);
  return { success: true, processed: messagesSent };
}

module.exports = {
  runRecoveryJob
};
