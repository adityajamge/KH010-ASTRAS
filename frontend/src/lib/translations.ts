import type { Lang } from "./i18n";

/**
 * UI copy translations, keyed by the exact English string used in JSX.
 * `t(key)` falls back to `key` itself when a language's map has no entry —
 * so this file only needs `hi` and `mr` entries; `en` is the identity map.
 *
 * Scope: static UI chrome (nav, headings, buttons, table headers, form
 * labels, empty/error states, known backend enum values). NOT translated:
 * free-text the backend generates dynamically (allocation "reason"/evidence
 * sentences, notification titles/messages, recent-activity text) — those
 * are assembled server-side with embedded numbers and would need a
 * server-side i18n pass, not a client-side dictionary lookup.
 */

const hi: Record<string, string> = {
  // Common / shared
  Language: "भाषा",
  "Try again": "फिर से कोशिश करें",
  units: "इकाई",
  "Loading…": "लोड हो रहा है…",
  Canal: "नहर",
  Farmer: "किसान",
  Date: "तारीख",
  Time: "समय",
  Status: "स्थिति",
  Quantity: "मात्रा",
  Village: "गांव",
  Phone: "फ़ोन",
  Location: "स्थान",
  Flow: "प्रवाह",
  "Water level": "जल स्तर",
  Capacity: "क्षमता",
  Utilization: "उपयोग",
  Requested: "अनुरोधित",
  Allocated: "आवंटित",
  Delivered: "वितरित",
  Shortfall: "कमी",
  Save: "सहेजें",
  "Saving…": "सहेजा जा रहा है…",
  "Not assigned": "असाइन नहीं",
  "Dashboard navigation": "डैशबोर्ड नेविगेशन",
  to: "से",

  // Nav
  Dashboard: "डैशबोर्ड",
  Request: "अनुरोध",
  Allocation: "आवंटन",
  Mediation: "मध्यस्थता",
  Schedule: "अनुसूची",
  Delivery: "वितरण",
  Alerts: "अलर्ट",
  History: "इतिहास",
  Help: "सहायता",
  Farmers: "किसान",
  Monitoring: "निगरानी",
  Allocations: "आवंटन",
  Conflicts: "विवाद",
  Anomalies: "विसंगतियां",
  Reservoir: "जलाशय",
  Rainfall: "वर्षा",
  Releases: "निर्गमन",

  // Role labels
  "Jal Vigyani": "जल विज्ञानी",
  "Dam Operator": "बांध संचालक",

  // Sidebar footer
  "Canal A": "नहर A",
  "Rampur · Morning slot": "रामपुर · सुबह का स्लॉट",
  "No canal assigned": "कोई नहर आवंटित नहीं",
  "No slot scheduled": "कोई स्लॉट निर्धारित नहीं",
  "Morning slot": "सुबह का स्लॉट",
  "Afternoon slot": "दोपहर का स्लॉट",
  "Evening slot": "शाम का स्लॉट",

  // Assistant
  "JalSetu Assistant": "जलसेतु सहायक",
  "Assistant chat": "सहायक चैट",
  "Open assistant chat": "सहायक चैट खोलें",
  "Close assistant chat": "सहायक चैट बंद करें",
  "How can I help?": "मैं कैसे मदद कर सकता हूँ?",
  "Chat message": "चैट संदेश",
  "Send message": "संदेश भेजें",
  "Ask about your water…": "अपने पानी के बारे में पूछें…",
  "Ask about your allocation, schedule, or why your water changed.":
    "अपने आवंटन, अनुसूची, या पानी में बदलाव के बारे में पूछें।",
  "Ask about canal flows, conflicts, or anomalies on your network.":
    "अपने नेटवर्क पर नहर के प्रवाह, विवाद, या विसंगतियों के बारे में पूछें।",
  "Ask about reservoir levels, releases, or supply planning.":
    "जलाशय स्तर, निर्गमन, या आपूर्ति योजना के बारे में पूछें।",
  "Ask about your water status.": "अपनी पानी की स्थिति के बारे में पूछें।",
  "Thinking…": "सोच रहा है…",
  "The assistant isn't connected yet — chat answers will appear here once the language model is configured.":
    "सहायक अभी कनेक्ट नहीं है — भाषा मॉडल कॉन्फ़िगर होने पर चैट के उत्तर यहां दिखाई देंगे।",

  // Farmer dashboard home
  "Good Morning": "सुप्रभात",
  "Good Afternoon": "शुभ दोपहर",
  "Good Evening": "शुभ संध्या",
  "Here's your water status for today": "आज आपकी पानी की स्थिति यह है",
  Available: "उपलब्ध",
  Remaining: "शेष",
  "Current allocation": "वर्तमान आवंटन",
  "Current Allocation": "वर्तमान आवंटन",
  "No allocation yet.": "अभी तक कोई आवंटन नहीं।",
  "View Allocation": "आवंटन देखें",
  "JalSetu mediation": "जलसेतु मध्यस्थता",
  "JalSetu Mediation": "जलसेतु मध्यस्थता",
  "Your request": "आपका अनुरोध",
  "No proposal yet.": "अभी तक कोई प्रस्ताव नहीं।",
  "Open Mediation": "मध्यस्थता खोलें",
  "Today's schedule": "आज की अनुसूची",
  "Today's Schedule": "आज की अनुसूची",
  "No slots scheduled yet.": "अभी तक कोई स्लॉट निर्धारित नहीं।",
  "View Schedule": "अनुसूची देखें",
  "Delivery status": "वितरण स्थिति",
  "Delivery Status": "वितरण स्थिति",
  "No deliveries yet.": "अभी तक कोई वितरण नहीं।",
  "View Delivery": "वितरण देखें",
  "Weather and water": "मौसम और पानी",
  "Weather / Water": "मौसम / पानी",
  "View Alerts": "अलर्ट देखें",
  "Recent activity": "हाल की गतिविधि",
  "Recent Activity": "हाल की गतिविधि",
  "No activity yet.": "अभी तक कोई गतिविधि नहीं।",
  "View History": "इतिहास देखें",

  // Delivery summary
  Authorized: "अधिकृत",
  "Delivered progress": "वितरण प्रगति",
  "Shortfall:": "कमी:",

  // Request form
  "Quantity (units)": "मात्रा (इकाई)",
  "Preferred time": "पसंदीदा समय",
  Morning: "सुबह",
  Afternoon: "दोपहर",
  Evening: "शाम",
  "Duration (hrs)": "अवधि (घंटे)",
  Crop: "फ़सल",
  "e.g. Sugarcane": "जैसे गन्ना",
  Urgency: "तात्कालिकता",
  Normal: "सामान्य",
  High: "उच्च",
  Critical: "गंभीर",
  "Critical — crop stress": "गंभीर — फ़सल तनाव",
  "Please fill in quantity, date, and crop.": "कृपया मात्रा, तारीख और फ़सल भरें।",
  "Request date cannot be in the past.": "अनुरोध की तारीख अतीत में नहीं हो सकती।",
  "Duration must be greater than 0.": "अवधि 0 से अधिक होनी चाहिए।",
  "Could not submit. Please try again.": "सबमिट नहीं हो सका। कृपया फिर से कोशिश करें।",
  "Submitting…": "सबमिट हो रहा है…",
  "Submit request": "अनुरोध सबमिट करें",

  // Allocation section
  "No allocation yet — submit a water request first.":
    "अभी तक कोई आवंटन नहीं — पहले पानी का अनुरोध सबमिट करें।",
  "Request Water": "पानी का अनुरोध करें",
  "Time slot": "समय स्लॉट",
  "Reason for adjustment:": "समायोजन का कारण:",

  // Mediation panel
  "No proposal yet — submit a water request to get your first allocation.":
    "अभी तक कोई प्रस्ताव नहीं — अपना पहला आवंटन पाने के लिए पानी का अनुरोध सबमिट करें।",
  "Reason:": "कारण:",
  "Conflict:": "विवाद:",
  Accepted: "स्वीकृत",
  Accept: "स्वीकार करें",
  "Accepting…": "स्वीकार हो रहा है…",
  Object: "आपत्ति करें",
  "Proposal unchanged — supply and priority constraints leave no room.":
    "प्रस्ताव अपरिवर्तित — आपूर्ति और प्राथमिकता की सीमाओं के कारण कोई गुंजाइश नहीं।",
  "Something went wrong. Please try again.": "कुछ गलत हो गया। कृपया फिर से कोशिश करें।",
  "Could not verify your session. Please sign in again.":
    "आपका सत्र सत्यापित नहीं हो सका। कृपया फिर से साइन इन करें।",
  "Could not verify your session.": "आपका सत्र सत्यापित नहीं हो सका।",
  "Could not reach JalSetu. Please try again.": "जलसेतु से संपर्क नहीं हो सका। कृपया फिर से कोशिश करें।",
  "Revised proposal: {allocated} units (was {previous}).":
    "संशोधित प्रस्ताव: {allocated} इकाई (पहले {previous} थी)।",
  "— agreement {code} recorded (version {version}).":
    "— समझौता {code} दर्ज किया गया (संस्करण {version})।",
  "Optional: describe your situation in your own words…":
    "वैकल्पिक: अपनी स्थिति अपने शब्दों में बताएं…",

  // Objection reasons (raw backend option labels)
  "Need more water": "अधिक पानी चाहिए",
  "Need different time": "अलग समय चाहिए",
  "Crop critical": "फ़सल गंभीर स्थिति में",
  Emergency: "आपातकाल",
  Other: "अन्य",

  // Schedule section
  "Upcoming slots": "आगामी स्लॉट",
  "Your confirmed and upcoming water slots.": "आपके पुष्ट और आगामी पानी के स्लॉट।",

  // Delivery section
  "No deliveries recorded yet.": "अभी तक कोई वितरण दर्ज नहीं।",
  "Status:": "स्थिति:",
  "Report Issue": "समस्या रिपोर्ट करें",

  // Alerts section
  "Water status": "पानी की स्थिति",
  Notifications: "सूचनाएं",
  "No notifications yet.": "अभी तक कोई सूचना नहीं।",

  // History section
  "Past requests": "पिछले अनुरोध",
  "No requests yet.": "अभी तक कोई अनुरोध नहीं।",
  Schedules: "अनुसूचियां",
  "Past requests, allocations and schedules.": "पिछले अनुरोध, आवंटन और अनुसूचियां।",

  // Help section
  "Get support for schedules and shortfalls.": "अनुसूची और कमी के लिए सहायता प्राप्त करें।",
  "Contact your Jal Vigyani for schedule changes or shortfall reports. For urgent crop stress, mark your next request as Critical so it is prioritized in mediation.":
    "अनुसूची में बदलाव या कमी की रिपोर्ट के लिए अपने जल विज्ञानी से संपर्क करें। तत्काल फ़सल तनाव के लिए, अपने अगले अनुरोध को गंभीर के रूप में चिह्नित करें ताकि मध्यस्थता में इसे प्राथमिकता मिले।",

  // Farmer SECTION_META
  "Request water": "पानी का अनुरोध करें",
  "Submit a new requirement for {canal}.": "{canal} के लिए नई आवश्यकता सबमिट करें।",
  "Submit a new requirement — you'll need a canal assigned first.":
    "नई आवश्यकता सबमिट करें — पहले आपको एक नहर आवंटित करनी होगी।",
  "My allocation": "मेरा आवंटन",
  "What was requested versus what was allocated.": "क्या अनुरोध किया गया था बनाम क्या आवंटित किया गया।",
  "Negotiation center": "बातचीत केंद्र",
  "Review the proposal and respond.": "प्रस्ताव की समीक्षा करें और जवाब दें।",
  "Authorized versus actually delivered water.": "अधिकृत बनाम वास्तव में वितरित पानी।",
  "Water status and system notifications.": "पानी की स्थिति और सिस्टम सूचनाएं।",

  // Jal Vigyani dashboard
  "Total canal flow": "कुल नहर प्रवाह",
  "Canal capacity": "नहर क्षमता",
  "Capacity utilization": "क्षमता उपयोग",
  "Number of farmers": "किसानों की संख्या",
  "Active conflicts": "सक्रिय विवाद",
  "Active anomalies": "सक्रिय विसंगतियां",
  "Under-delivery cases": "कम वितरण के मामले",
  "Loading farmer allocations…": "किसान आवंटन लोड हो रहे हैं…",
  "No farmers are assigned to this dam's canals yet.": "इस बांध की नहरों पर अभी तक कोई किसान आवंटित नहीं है।",
  "Assign canals": "नहरें आवंटित करें",
  "Unassigned farmers plus farmers already on this dam's canals.":
    "गैर-आवंटित किसान और वे किसान जो पहले से इस बांध की नहरों पर हैं।",
  "No farmers to assign right now.": "अभी आवंटित करने के लिए कोई किसान नहीं।",
  "Loading farmers…": "किसान लोड हो रहे हैं…",
  "Could not assign the canal.": "नहर आवंटित नहीं हो सकी।",
  "No canals are configured for this dam yet.": "इस बांध के लिए अभी तक कोई नहर कॉन्फ़िगर नहीं है।",
  "Live canal monitoring": "लाइव नहर निगरानी",
  "Record measurement": "माप दर्ज करें",
  "JV-US-02 — log an observed water-flow reading.": "JV-US-02 — देखी गई जल-प्रवाह रीडिंग दर्ज करें।",
  "No canals to record a measurement against.": "माप दर्ज करने के लिए कोई नहर नहीं।",
  "Recent readings": "हाल की रीडिंग",
  "No measurements recorded yet.": "अभी तक कोई माप दर्ज नहीं।",
  "Flow (units/min)": "प्रवाह (इकाई/मिनट)",
  "Water level (m)": "जल स्तर (मी)",
  "Please fill in every field with valid values.": "कृपया हर फ़ील्ड में मान्य मान भरें।",
  "Could not save the measurement.": "माप सहेजा नहीं जा सका।",
  "e.g. Gate G2": "जैसे गेट G2",
  Recorded: "दर्ज किया गया",
  "Loading canal state…": "नहर की स्थिति लोड हो रही है…",
  "Loading conflicts…": "विवाद लोड हो रहे हैं…",
  "No conflicts detected for this dam right now.": "इस बांध के लिए अभी कोई विवाद नहीं मिला।",
  Participants: "प्रतिभागी",
  "No participants recorded.": "कोई प्रतिभागी दर्ज नहीं।",
  Objections: "आपत्तियां",
  "No objections filed.": "कोई आपत्ति दर्ज नहीं की गई।",
  "Could not load conflict detail.": "विवाद का विवरण लोड नहीं हो सका।",
  "Could not record the decision.": "निर्णय दर्ज नहीं हो सका।",
  Demand: "मांग",
  Shortage: "कमी",
  Priority: "प्राथमिकता",
  "Proposal:": "प्रस्ताव:",
  Hide: "छिपाएं",
  Review: "समीक्षा करें",
  Approve: "स्वीकृत करें",
  "Request revision": "संशोधन का अनुरोध करें",
  Escalate: "आगे बढ़ाएं",
  "Loading schedule…": "अनुसूची लोड हो रही है…",
  "No irrigation slots scheduled yet.": "अभी तक कोई सिंचाई स्लॉट निर्धारित नहीं।",
  "Farmer allocation": "किसान आवंटन",
  "e.g. Distributary 2": "जैसे वितरिका 2",
  "Expected flow": "अपेक्षित प्रवाह",
  "Measured flow": "मापा गया प्रवाह",
  "Possible causes": "संभावित कारण",
  "Reported as investigation required — not a conclusion of theft.":
    "जांच आवश्यक के रूप में रिपोर्ट किया गया — यह चोरी का निष्कर्ष नहीं है।",
  "Please fill in every field and select at least one possible cause.":
    "कृपया हर फ़ील्ड भरें और कम से कम एक संभावित कारण चुनें।",
  "Could not report the issue.": "समस्या रिपोर्ट नहीं हो सकी।",
  "Reporting…": "रिपोर्ट हो रहा है…",
  "Report issue": "समस्या रिपोर्ट करें",
  "Under-delivery detection": "कम वितरण का पता लगाना",
  "No under-delivery cases right now.": "अभी कोई कम वितरण का मामला नहीं।",
  "Water loss / anomaly": "जल हानि / विसंगति",
  "No anomalies reported.": "कोई विसंगति रिपोर्ट नहीं की गई।",
  "Report infrastructure issue": "बुनियादी ढांचे की समस्या रिपोर्ट करें",
  "JV-US-03 — leakage, blockage, gate mismatch, or a flow discrepancy.":
    "JV-US-03 — रिसाव, अवरोध, गेट बेमेल, या प्रवाह विसंगति।",
  "No canals to report against.": "रिपोर्ट करने के लिए कोई नहर नहीं।",
  "Expected / measured": "अपेक्षित / मापा गया",
  Difference: "अंतर",
  "Not a conclusion of theft — possible causes for investigation:":
    "यह चोरी का निष्कर्ष नहीं है — जांच के लिए संभावित कारण:",
  Investigating: "जांच जारी",
  Resolved: "सुलझाया गया",
  Dismiss: "खारिज करें",
  "Could not update the anomaly.": "विसंगति अपडेट नहीं हो सकी।",

  // Possible causes chips
  Leakage: "रिसाव",
  Seepage: "रिसन",
  "Unauthorized withdrawal": "अनधिकृत निकासी",
  "Gate mismatch": "गेट बेमेल",
  "Sensor error": "सेंसर त्रुटि",
  "Unexpected discharge": "अप्रत्याशित निकासी",
  "Evaporation / physical loss": "वाष्पीकरण / भौतिक हानि",

  // Jal Vigyani SECTION_META extra
  "Contact the system administrator for sensor issues or escalate unresolved conflicts to the canal authority.":
    "सेंसर समस्याओं के लिए सिस्टम प्रशासक से संपर्क करें या अनसुलझे विवादों को नहर प्राधिकरण तक पहुंचाएं।",

  // Dam operator dashboard
  "Loading supply state…": "आपूर्ति स्थिति लोड हो रही है…",
  "Loading flow chain…": "प्रवाह श्रृंखला लोड हो रही है…",
  "Differences within tolerance — no canal-level investigation needed.":
    "अंतर सहनशीलता सीमा के भीतर — नहर-स्तर की जांच की आवश्यकता नहीं।",
  "Last 24 hours": "पिछले 24 घंटे",
  "Catchment affected": "प्रभावित जलग्रहण क्षेत्र",
  "Forecast: {forecast}. Rainfall triggers a recalculation rather than automatically reducing every farmer's requirement.":
    "पूर्वानुमान: {forecast}। वर्षा हर किसान की आवश्यकता को स्वतः कम करने के बजाय पुनर्गणना को ट्रिगर करती है।",
  "No canals found for this dam.": "इस बांध के लिए कोई नहर नहीं मिली।",
  Approved: "स्वीकृत",
  Released: "जारी",
  Received: "प्राप्त",
  "Numbers only, please.": "कृपया केवल संख्याएं दर्ज करें।",
  "Change at least one field.": "कम से कम एक फ़ील्ड बदलें।",
  "Could not publish. Please try again.": "प्रकाशित नहीं हो सका। कृपया फिर से कोशिश करें।",
  "Storage volume (units)": "भंडारण मात्रा (इकाई)",
  "e.g. 5000": "जैसे 5000",
  "Inflow (units/day)": "अंतर्वाह (इकाई/दिन)",
  "e.g. 850": "जैसे 850",
  "Outflow (units/day)": "बहिर्वाह (इकाई/दिन)",
  "e.g. 700": "जैसे 700",
  "Reservoir level (m)": "जलाशय स्तर (मी)",
  "e.g. 118.4": "जैसे 118.4",
  "Rainfall last 24h (mm)": "पिछले 24 घंटे की वर्षा (मिमी)",
  "e.g. 18": "जैसे 18",
  "Rainfall forecast": "वर्षा पूर्वानुमान",
  "e.g. Medium — 12mm expected": "जैसे मध्यम — 12मिमी अपेक्षित",
  "Supply state published.": "आपूर्ति स्थिति प्रकाशित की गई।",
  "Publishing…": "प्रकाशित हो रहा है…",
  "Publish update": "अपडेट प्रकाशित करें",
  "Reservoir monitoring": "जलाशय निगरानी",
  "Rainfall monitoring": "वर्षा निगरानी",
  "Canal-wise release": "नहर-वार निर्गमन",
  "Publish supply update": "आपूर्ति अपडेट प्रकाशित करें",
  "Numbers you publish here drive every dashboard immediately.":
    "यहां प्रकाशित संख्याएं तुरंत हर डैशबोर्ड को प्रभावित करती हैं।",
  "Contact the system administrator for release approvals or emergency alerts.":
    "निर्गमन अनुमोदन या आपातकालीन अलर्ट के लिए सिस्टम प्रशासक से संपर्क करें।",

  // Dam stat labels (from backend)
  "Reservoir Level": "जलाशय स्तर",
  "Storage Volume": "भंडारण मात्रा",
  "Available Irrigation Water": "उपलब्ध सिंचाई जल",
  Outflow: "बहिर्वाह",
  Inflow: "अंतर्वाह",
  "Release Rate": "निर्गमन दर",
  "Dam Status": "बांध स्थिति",
  "Emergency Alerts": "आपातकालीन अलर्ट",
  Unknown: "अज्ञात",
  Watch: "निगरानी में",

  // Flow chain stage labels
  "Reservoir Release": "जलाशय निर्गमन",
  "Canal Received": "नहर को प्राप्त",
  "Farmer Allocations": "किसान आवंटन",
  "Actual Delivery": "वास्तविक वितरण",
  "Expected Physical Loss": "अपेक्षित भौतिक हानि",
  "Unaccounted Difference": "अस्पष्ट अंतर",

  // Release status
  "Minor Difference": "मामूली अंतर",
  "Needs Investigation": "जांच आवश्यक",

  // Status enum words (formatStatus output)
  Pending: "लंबित",
  Processing: "प्रक्रियारत",
  Proposed: "प्रस्तावित",
  Rejected: "अस्वीकृत",
  Cancelled: "रद्द",
  Scheduled: "निर्धारित",
  "In Progress": "प्रगति पर",
  "In progress": "प्रगति पर",
  Completed: "पूर्ण",
  Complete: "पूर्ण",
  Modified: "संशोधित",
  Disputed: "विवादित",
  "On Track": "समय पर",
  "Under Delivery": "कम वितरण",
  "Over Delivery": "अधिक वितरण",
  "Investigation Required": "जांच आवश्यक",
  Detected: "पहचाना गया",
  "Under Review": "समीक्षाधीन",
  Negotiation: "बातचीत",
  "Revision Requested": "संशोधन का अनुरोध",
  Escalated: "आगे बढ़ाया गया",
  "Need More Water": "अधिक पानी चाहिए",
  "Need Different Time": "अलग समय चाहिए",
  "Crop Critical": "फ़सल गंभीर",
  Dismissed: "खारिज",

  // Loading state (farmer)
  "Loading your water status…": "आपकी पानी की स्थिति लोड हो रही है…",

  // Month abbreviations
  Jan: "जनवरी",
  Feb: "फ़रवरी",
  Mar: "मार्च",
  Apr: "अप्रैल",
  May: "मई",
  Jun: "जून",
  Jul: "जुलाई",
  Aug: "अगस्त",
  Sept: "सितंबर",
  Oct: "अक्टूबर",
  Nov: "नवंबर",
  Dec: "दिसंबर",
};

const mr: Record<string, string> = {
  // Common / shared
  Language: "भाषा",
  "Try again": "पुन्हा प्रयत्न करा",
  units: "एकके",
  "Loading…": "लोड होत आहे…",
  Canal: "कालवा",
  Farmer: "शेतकरी",
  Date: "तारीख",
  Time: "वेळ",
  Status: "स्थिती",
  Quantity: "प्रमाण",
  Village: "गाव",
  Phone: "फोन",
  Location: "ठिकाण",
  Flow: "प्रवाह",
  "Water level": "पाण्याची पातळी",
  Capacity: "क्षमता",
  Utilization: "वापर",
  Requested: "विनंती केलेले",
  Allocated: "वाटप केलेले",
  Delivered: "वितरित",
  Shortfall: "तूट",
  Save: "जतन करा",
  "Saving…": "जतन करत आहे…",
  "Not assigned": "नियुक्त नाही",
  "Dashboard navigation": "डॅशबोर्ड नेव्हिगेशन",
  to: "ते",

  // Nav
  Dashboard: "डॅशबोर्ड",
  Request: "विनंती",
  Allocation: "वाटप",
  Mediation: "मध्यस्थी",
  Schedule: "वेळापत्रक",
  Delivery: "वितरण",
  Alerts: "सूचना",
  History: "इतिहास",
  Help: "मदत",
  Farmers: "शेतकरी",
  Monitoring: "देखरेख",
  Allocations: "वाटप",
  Conflicts: "वाद",
  Anomalies: "विसंगती",
  Reservoir: "जलाशय",
  Rainfall: "पाऊस",
  Releases: "विसर्ग",

  // Role labels
  "Jal Vigyani": "जल वैज्ञानिक",
  "Dam Operator": "धरण चालक",

  // Sidebar footer
  "Canal A": "कालवा A",
  "Rampur · Morning slot": "रामपूर · सकाळचा स्लॉट",
  "No canal assigned": "कालवा नियुक्त केलेला नाही",
  "No slot scheduled": "कोणताही स्लॉट नियोजित नाही",
  "Morning slot": "सकाळचा स्लॉट",
  "Afternoon slot": "दुपारचा स्लॉट",
  "Evening slot": "संध्याकाळचा स्लॉट",

  // Assistant
  "JalSetu Assistant": "जलसेतू सहाय्यक",
  "Assistant chat": "सहाय्यक चॅट",
  "Open assistant chat": "सहाय्यक चॅट उघडा",
  "Close assistant chat": "सहाय्यक चॅट बंद करा",
  "How can I help?": "मी कशी मदत करू शकतो?",
  "Chat message": "चॅट संदेश",
  "Send message": "संदेश पाठवा",
  "Ask about your water…": "तुमच्या पाण्याबद्दल विचारा…",
  "Ask about your allocation, schedule, or why your water changed.":
    "तुमच्या वाटप, वेळापत्रक, किंवा पाण्यात झालेल्या बदलाबद्दल विचारा.",
  "Ask about canal flows, conflicts, or anomalies on your network.":
    "तुमच्या नेटवर्कवरील कालवा प्रवाह, वाद, किंवा विसंगतींबद्दल विचारा.",
  "Ask about reservoir levels, releases, or supply planning.":
    "जलाशयाची पातळी, विसर्ग, किंवा पुरवठा नियोजनाबद्दल विचारा.",
  "Ask about your water status.": "तुमच्या पाण्याच्या स्थितीबद्दल विचारा.",
  "Thinking…": "विचार करत आहे…",
  "The assistant isn't connected yet — chat answers will appear here once the language model is configured.":
    "सहाय्यक अजून कनेक्ट झालेला नाही — भाषा मॉडेल कॉन्फिगर झाल्यावर चॅट उत्तरे इथे दिसतील.",

  // Farmer dashboard home
  "Good Morning": "सुप्रभात",
  "Good Afternoon": "शुभ दुपार",
  "Good Evening": "शुभ संध्याकाळ",
  "Here's your water status for today": "आज तुमची पाण्याची स्थिती अशी आहे",
  Available: "उपलब्ध",
  Remaining: "शिल्लक",
  "Current allocation": "सध्याचे वाटप",
  "Current Allocation": "सध्याचे वाटप",
  "No allocation yet.": "अजून वाटप झालेले नाही.",
  "View Allocation": "वाटप पहा",
  "JalSetu mediation": "जलसेतू मध्यस्थी",
  "JalSetu Mediation": "जलसेतू मध्यस्थी",
  "Your request": "तुमची विनंती",
  "No proposal yet.": "अजून प्रस्ताव नाही.",
  "Open Mediation": "मध्यस्थी उघडा",
  "Today's schedule": "आजचे वेळापत्रक",
  "Today's Schedule": "आजचे वेळापत्रक",
  "No slots scheduled yet.": "अजून कोणताही स्लॉट नियोजित नाही.",
  "View Schedule": "वेळापत्रक पहा",
  "Delivery status": "वितरण स्थिती",
  "Delivery Status": "वितरण स्थिती",
  "No deliveries yet.": "अजून वितरण झालेले नाही.",
  "View Delivery": "वितरण पहा",
  "Weather and water": "हवामान आणि पाणी",
  "Weather / Water": "हवामान / पाणी",
  "View Alerts": "सूचना पहा",
  "Recent activity": "अलीकडील घडामोडी",
  "Recent Activity": "अलीकडील घडामोडी",
  "No activity yet.": "अजून काही घडामोड नाही.",
  "View History": "इतिहास पहा",

  // Delivery summary
  Authorized: "अधिकृत",
  "Delivered progress": "वितरण प्रगती",
  "Shortfall:": "तूट:",

  // Request form
  "Quantity (units)": "प्रमाण (एकके)",
  "Preferred time": "पसंतीची वेळ",
  Morning: "सकाळ",
  Afternoon: "दुपार",
  Evening: "संध्याकाळ",
  "Duration (hrs)": "कालावधी (तास)",
  Crop: "पीक",
  "e.g. Sugarcane": "उदा. ऊस",
  Urgency: "निकड",
  Normal: "सामान्य",
  High: "उच्च",
  Critical: "गंभीर",
  "Critical — crop stress": "गंभीर — पिकावर ताण",
  "Please fill in quantity, date, and crop.": "कृपया प्रमाण, तारीख आणि पीक भरा.",
  "Request date cannot be in the past.": "विनंतीची तारीख भूतकाळातील असू शकत नाही.",
  "Duration must be greater than 0.": "कालावधी ० पेक्षा जास्त असावा.",
  "Could not submit. Please try again.": "सबमिट करता आले नाही. कृपया पुन्हा प्रयत्न करा.",
  "Submitting…": "सबमिट होत आहे…",
  "Submit request": "विनंती सबमिट करा",

  // Allocation section
  "No allocation yet — submit a water request first.":
    "अजून वाटप झालेले नाही — आधी पाण्यासाठी विनंती सबमिट करा.",
  "Request Water": "पाण्यासाठी विनंती करा",
  "Time slot": "वेळ स्लॉट",
  "Reason for adjustment:": "समायोजनाचे कारण:",

  // Mediation panel
  "No proposal yet — submit a water request to get your first allocation.":
    "अजून प्रस्ताव नाही — तुमचे पहिले वाटप मिळवण्यासाठी पाण्यासाठी विनंती सबमिट करा.",
  "Reason:": "कारण:",
  "Conflict:": "वाद:",
  Accepted: "स्वीकृत",
  Accept: "स्वीकार करा",
  "Accepting…": "स्वीकारले जात आहे…",
  Object: "आक्षेप घ्या",
  "Proposal unchanged — supply and priority constraints leave no room.":
    "प्रस्ताव अपरिवर्तित — पुरवठा आणि प्राधान्यक्रमाच्या मर्यादांमुळे वाव नाही.",
  "Something went wrong. Please try again.": "काहीतरी चुकले. कृपया पुन्हा प्रयत्न करा.",
  "Could not verify your session. Please sign in again.":
    "तुमचे सत्र सत्यापित करता आले नाही. कृपया पुन्हा साइन इन करा.",
  "Could not verify your session.": "तुमचे सत्र सत्यापित करता आले नाही.",
  "Could not reach JalSetu. Please try again.": "जलसेतूशी संपर्क होऊ शकला नाही. कृपया पुन्हा प्रयत्न करा.",
  "Revised proposal: {allocated} units (was {previous}).":
    "सुधारित प्रस्ताव: {allocated} एकके (आधी {previous} होते).",
  "— agreement {code} recorded (version {version}).":
    "— करार {code} नोंदवला गेला (आवृत्ती {version}).",
  "Optional: describe your situation in your own words…":
    "पर्यायी: तुमची परिस्थिती तुमच्या शब्दांत सांगा…",

  // Objection reasons (raw backend option labels)
  "Need more water": "अधिक पाणी हवे",
  "Need different time": "वेगळी वेळ हवी",
  "Crop critical": "पीक गंभीर स्थितीत",
  Emergency: "आणीबाणी",
  Other: "इतर",

  // Schedule section
  "Upcoming slots": "आगामी स्लॉट",
  "Your confirmed and upcoming water slots.": "तुमचे निश्चित आणि आगामी पाण्याचे स्लॉट.",

  // Delivery section
  "No deliveries recorded yet.": "अजून वितरण नोंदवले गेलेले नाही.",
  "Status:": "स्थिती:",
  "Report Issue": "समस्या नोंदवा",

  // Alerts section
  "Water status": "पाण्याची स्थिती",
  Notifications: "सूचना",
  "No notifications yet.": "अजून कोणतीही सूचना नाही.",

  // History section
  "Past requests": "मागील विनंत्या",
  "No requests yet.": "अजून विनंती नाही.",
  Schedules: "वेळापत्रके",
  "Past requests, allocations and schedules.": "मागील विनंत्या, वाटप आणि वेळापत्रके.",

  // Help section
  "Get support for schedules and shortfalls.": "वेळापत्रक आणि तुटीसाठी मदत मिळवा.",
  "Contact your Jal Vigyani for schedule changes or shortfall reports. For urgent crop stress, mark your next request as Critical so it is prioritized in mediation.":
    "वेळापत्रकातील बदल किंवा तुटीच्या तक्रारींसाठी तुमच्या जल वैज्ञानिकांशी संपर्क साधा. तातडीच्या पीक ताणासाठी, तुमची पुढील विनंती गंभीर म्हणून चिन्हांकित करा जेणेकरून मध्यस्थीत तिला प्राधान्य मिळेल.",

  // Farmer SECTION_META
  "Request water": "पाण्यासाठी विनंती करा",
  "Submit a new requirement for {canal}.": "{canal} साठी नवीन गरज सबमिट करा.",
  "Submit a new requirement — you'll need a canal assigned first.":
    "नवीन गरज सबमिट करा — आधी तुम्हाला कालवा नियुक्त करावा लागेल.",
  "My allocation": "माझे वाटप",
  "What was requested versus what was allocated.": "काय विनंती केली होती विरुद्ध काय वाटप झाले.",
  "Negotiation center": "वाटाघाटी केंद्र",
  "Review the proposal and respond.": "प्रस्तावाचे पुनरावलोकन करा आणि प्रतिसाद द्या.",
  "Authorized versus actually delivered water.": "अधिकृत विरुद्ध प्रत्यक्षात वितरित पाणी.",
  "Water status and system notifications.": "पाण्याची स्थिती आणि सिस्टम सूचना.",

  // Jal Vigyani dashboard
  "Total canal flow": "एकूण कालवा प्रवाह",
  "Canal capacity": "कालवा क्षमता",
  "Capacity utilization": "क्षमता वापर",
  "Number of farmers": "शेतकऱ्यांची संख्या",
  "Active conflicts": "सक्रिय वाद",
  "Active anomalies": "सक्रिय विसंगती",
  "Under-delivery cases": "कमी वितरणाची प्रकरणे",
  "Loading farmer allocations…": "शेतकरी वाटप लोड होत आहे…",
  "No farmers are assigned to this dam's canals yet.": "या धरणाच्या कालव्यांवर अजून कोणताही शेतकरी नियुक्त नाही.",
  "Assign canals": "कालवे नियुक्त करा",
  "Unassigned farmers plus farmers already on this dam's canals.":
    "अनियुक्त शेतकरी आणि जे शेतकरी आधीच या धरणाच्या कालव्यांवर आहेत ते.",
  "No farmers to assign right now.": "आत्ता नियुक्त करण्यासाठी कोणीही शेतकरी नाही.",
  "Loading farmers…": "शेतकरी लोड होत आहेत…",
  "Could not assign the canal.": "कालवा नियुक्त करता आला नाही.",
  "No canals are configured for this dam yet.": "या धरणासाठी अजून कोणताही कालवा कॉन्फिगर केलेला नाही.",
  "Live canal monitoring": "थेट कालवा देखरेख",
  "Record measurement": "मोजमाप नोंदवा",
  "JV-US-02 — log an observed water-flow reading.": "JV-US-02 — निरीक्षण केलेली पाणी-प्रवाह नोंद करा.",
  "No canals to record a measurement against.": "मोजमाप नोंदवण्यासाठी कोणताही कालवा नाही.",
  "Recent readings": "अलीकडील नोंदी",
  "No measurements recorded yet.": "अजून कोणतेही मोजमाप नोंदवलेले नाही.",
  "Flow (units/min)": "प्रवाह (एकके/मिनिट)",
  "Water level (m)": "पाण्याची पातळी (मी)",
  "Please fill in every field with valid values.": "कृपया प्रत्येक फील्डमध्ये वैध मूल्ये भरा.",
  "Could not save the measurement.": "मोजमाप जतन करता आले नाही.",
  "e.g. Gate G2": "उदा. गेट G2",
  Recorded: "नोंदवले",
  "Loading canal state…": "कालव्याची स्थिती लोड होत आहे…",
  "Loading conflicts…": "वाद लोड होत आहेत…",
  "No conflicts detected for this dam right now.": "या धरणासाठी सध्या कोणताही वाद आढळला नाही.",
  Participants: "सहभागी",
  "No participants recorded.": "कोणतेही सहभागी नोंदवलेले नाहीत.",
  Objections: "आक्षेप",
  "No objections filed.": "कोणताही आक्षेप नोंदवला गेला नाही.",
  "Could not load conflict detail.": "वादाचा तपशील लोड करता आला नाही.",
  "Could not record the decision.": "निर्णय नोंदवता आला नाही.",
  Demand: "मागणी",
  Shortage: "तुटवडा",
  Priority: "प्राधान्य",
  "Proposal:": "प्रस्ताव:",
  Hide: "लपवा",
  Review: "पुनरावलोकन करा",
  Approve: "मंजूर करा",
  "Request revision": "सुधारणेची विनंती करा",
  Escalate: "पुढे पाठवा",
  "Loading schedule…": "वेळापत्रक लोड होत आहे…",
  "No irrigation slots scheduled yet.": "अजून कोणताही सिंचन स्लॉट नियोजित नाही.",
  "Farmer allocation": "शेतकरी वाटप",
  "e.g. Distributary 2": "उदा. वितरिका 2",
  "Expected flow": "अपेक्षित प्रवाह",
  "Measured flow": "मोजलेला प्रवाह",
  "Possible causes": "संभाव्य कारणे",
  "Reported as investigation required — not a conclusion of theft.":
    "चौकशी आवश्यक म्हणून नोंदवले — हा चोरीचा निष्कर्ष नाही.",
  "Please fill in every field and select at least one possible cause.":
    "कृपया प्रत्येक फील्ड भरा आणि किमान एक संभाव्य कारण निवडा.",
  "Could not report the issue.": "समस्या नोंदवता आली नाही.",
  "Reporting…": "नोंदवत आहे…",
  "Report issue": "समस्या नोंदवा",
  "Under-delivery detection": "कमी वितरण शोध",
  "No under-delivery cases right now.": "सध्या कमी वितरणाचे कोणतेही प्रकरण नाही.",
  "Water loss / anomaly": "पाणी तोटा / विसंगती",
  "No anomalies reported.": "कोणतीही विसंगती नोंदवली गेलेली नाही.",
  "Report infrastructure issue": "पायाभूत सुविधांची समस्या नोंदवा",
  "JV-US-03 — leakage, blockage, gate mismatch, or a flow discrepancy.":
    "JV-US-03 — गळती, अडथळा, गेट विसंगती, किंवा प्रवाह तफावत.",
  "No canals to report against.": "नोंदवण्यासाठी कोणताही कालवा नाही.",
  "Expected / measured": "अपेक्षित / मोजलेले",
  Difference: "फरक",
  "Not a conclusion of theft — possible causes for investigation:":
    "हा चोरीचा निष्कर्ष नाही — चौकशीसाठी संभाव्य कारणे:",
  Investigating: "चौकशी सुरू",
  Resolved: "निराकरण झाले",
  Dismiss: "फेटाळा",
  "Could not update the anomaly.": "विसंगती अद्ययावत करता आली नाही.",

  // Possible causes chips
  Leakage: "गळती",
  Seepage: "झिरपणे",
  "Unauthorized withdrawal": "अनधिकृत उपसा",
  "Gate mismatch": "गेट विसंगती",
  "Sensor error": "सेन्सर त्रुटी",
  "Unexpected discharge": "अनपेक्षित विसर्ग",
  "Evaporation / physical loss": "बाष्पीभवन / भौतिक तोटा",

  // Jal Vigyani SECTION_META extra
  "Contact the system administrator for sensor issues or escalate unresolved conflicts to the canal authority.":
    "सेन्सर समस्यांसाठी सिस्टम प्रशासकाशी संपर्क साधा किंवा निराकरण न झालेले वाद कालवा प्राधिकरणाकडे पाठवा.",

  // Dam operator dashboard
  "Loading supply state…": "पुरवठा स्थिती लोड होत आहे…",
  "Loading flow chain…": "प्रवाह साखळी लोड होत आहे…",
  "Differences within tolerance — no canal-level investigation needed.":
    "फरक सहनशीलतेच्या मर्यादेत — कालवा-स्तरीय चौकशीची गरज नाही.",
  "Last 24 hours": "मागील २४ तास",
  "Catchment affected": "प्रभावित पाणलोट क्षेत्र",
  "Forecast: {forecast}. Rainfall triggers a recalculation rather than automatically reducing every farmer's requirement.":
    "अंदाज: {forecast}. पाऊस प्रत्येक शेतकऱ्याची गरज आपोआप कमी करण्याऐवजी पुनर्गणना सुरू करतो.",
  "No canals found for this dam.": "या धरणासाठी कोणताही कालवा आढळला नाही.",
  Approved: "मंजूर",
  Released: "सोडलेले",
  Received: "मिळालेले",
  "Numbers only, please.": "कृपया फक्त संख्या टाका.",
  "Change at least one field.": "किमान एक फील्ड बदला.",
  "Could not publish. Please try again.": "प्रकाशित करता आले नाही. कृपया पुन्हा प्रयत्न करा.",
  "Storage volume (units)": "साठा प्रमाण (एकके)",
  "e.g. 5000": "उदा. ५०००",
  "Inflow (units/day)": "अंतर्प्रवाह (एकके/दिवस)",
  "e.g. 850": "उदा. ८५०",
  "Outflow (units/day)": "बहिर्प्रवाह (एकके/दिवस)",
  "e.g. 700": "उदा. ७००",
  "Reservoir level (m)": "जलाशय पातळी (मी)",
  "e.g. 118.4": "उदा. ११८.४",
  "Rainfall last 24h (mm)": "मागील २४ तासांचा पाऊस (मिमी)",
  "e.g. 18": "उदा. १८",
  "Rainfall forecast": "पावसाचा अंदाज",
  "e.g. Medium — 12mm expected": "उदा. मध्यम — १२मिमी अपेक्षित",
  "Supply state published.": "पुरवठा स्थिती प्रकाशित झाली.",
  "Publishing…": "प्रकाशित होत आहे…",
  "Publish update": "अद्ययावत प्रकाशित करा",
  "Reservoir monitoring": "जलाशय देखरेख",
  "Rainfall monitoring": "पाऊस देखरेख",
  "Canal-wise release": "कालवानिहाय विसर्ग",
  "Publish supply update": "पुरवठा अद्ययावत प्रकाशित करा",
  "Numbers you publish here drive every dashboard immediately.":
    "इथे प्रकाशित केलेली संख्या लगेच प्रत्येक डॅशबोर्डवर परिणाम करते.",
  "Contact the system administrator for release approvals or emergency alerts.":
    "विसर्ग मंजुरी किंवा आणीबाणी सूचनांसाठी सिस्टम प्रशासकाशी संपर्क साधा.",

  // Dam stat labels (from backend)
  "Reservoir Level": "जलाशय पातळी",
  "Storage Volume": "साठा प्रमाण",
  "Available Irrigation Water": "उपलब्ध सिंचन पाणी",
  Outflow: "बहिर्प्रवाह",
  Inflow: "अंतर्प्रवाह",
  "Release Rate": "विसर्ग दर",
  "Dam Status": "धरण स्थिती",
  "Emergency Alerts": "आणीबाणी सूचना",
  Unknown: "अज्ञात",
  Watch: "देखरेखीत",

  // Flow chain stage labels
  "Reservoir Release": "जलाशय विसर्ग",
  "Canal Received": "कालव्याला मिळालेले",
  "Farmer Allocations": "शेतकरी वाटप",
  "Actual Delivery": "प्रत्यक्ष वितरण",
  "Expected Physical Loss": "अपेक्षित भौतिक तोटा",
  "Unaccounted Difference": "अस्पष्ट फरक",

  // Release status
  "Minor Difference": "किरकोळ फरक",
  "Needs Investigation": "चौकशीची गरज",

  // Status enum words (formatStatus output)
  Pending: "प्रलंबित",
  Processing: "प्रक्रियेत",
  Proposed: "प्रस्तावित",
  Rejected: "नाकारले",
  Cancelled: "रद्द",
  Scheduled: "नियोजित",
  "In Progress": "प्रगतीपथावर",
  "In progress": "प्रगतीपथावर",
  Completed: "पूर्ण",
  Complete: "पूर्ण",
  Modified: "सुधारित",
  Disputed: "वादग्रस्त",
  "On Track": "वेळेवर",
  "Under Delivery": "कमी वितरण",
  "Over Delivery": "जास्त वितरण",
  "Investigation Required": "चौकशी आवश्यक",
  Detected: "आढळले",
  "Under Review": "पुनरावलोकनाधीन",
  Negotiation: "वाटाघाटी",
  "Revision Requested": "सुधारणा विनंती",
  Escalated: "पुढे पाठवले",
  "Need More Water": "अधिक पाणी हवे",
  "Need Different Time": "वेगळी वेळ हवी",
  "Crop Critical": "पीक गंभीर",
  Dismissed: "फेटाळले",

  // Loading state (farmer)
  "Loading your water status…": "तुमची पाण्याची स्थिती लोड होत आहे…",

  // Month abbreviations
  Jan: "जानेवारी",
  Feb: "फेब्रुवारी",
  Mar: "मार्च",
  Apr: "एप्रिल",
  May: "मे",
  Jun: "जून",
  Jul: "जुलै",
  Aug: "ऑगस्ट",
  Sept: "सप्टेंबर",
  Oct: "ऑक्टोबर",
  Nov: "नोव्हेंबर",
  Dec: "डिसेंबर",
};

export const TRANSLATIONS: Record<Lang, Record<string, string>> = {
  en: {},
  hi,
  mr,
};
