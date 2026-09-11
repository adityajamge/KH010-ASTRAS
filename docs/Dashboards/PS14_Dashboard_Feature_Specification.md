# PS14 — Dashboard Feature Specification

**Filename:** `PS14_Dashboard_Feature_Specification.md`  
**Project:** PS14 — Autonomous Water-Sharing Dispute Mediation Agent for Farmers

## 1. Overall System Architecture

```text
Farmers
   ↓
Twilio / Farmer Interface
   ↓
Conversation Agent
   ↓
PS14 Core Engine
   ├── Farmer Database
   ├── Water Availability Model
   ├── Rule / Constraint Engine
   ├── Conflict Detection
   ├── Mediation Agent
   ├── Negotiation Agent
   ├── Schedule Generator
   ├── Optimization
   ├── ML Demand Prediction
   ├── ML Anomaly Detection
   ├── IoT Water Monitoring
   └── Audit / Agreement System
   ↓
Final Schedule
   ↓
Farmer + Canal Authority + Dam Authority
```

All four dashboards are different views of the same water-sharing state.

> **AI = understand, negotiate, explain**  
> **Rules = define what is allowed**  
> **Optimization = find feasible/fair allocation**  
> **IoT = measure actual physical water state**  
> **Authorities = approve/execute exceptional operational actions**  
> **Audit = preserve every important decision**

Twilio is only the communication layer between farmers and the PS14 backend. Water allocation, mediation, negotiation, optimization, validation, and decision-making remain independent of Twilio.

WhatsApp integration is **future scope**. The architecture should allow Twilio to later be replaced or extended with the Meta WhatsApp Business Platform.

---

# 2. Twilio Communication Dashboard

## 2.1 Purpose

The Twilio layer provides communication between farmers and PS14. It receives farmer messages, forwards them to the backend, and delivers responses and notifications.

Twilio does **not** perform water allocation logic.

### Communication Overview

| Card | Sample Value |
|---|---:|
| Messages Today | 184 |
| Incoming Messages | 96 |
| Outgoing Messages | 88 |
| Delivered | 84 |
| Failed | 4 |
| Active Conversations | 27 |
| Pending Farmer Responses | 9 |
| Webhook Status | Online |
| Communication Service Status | Healthy |

## 2.2 Farmer Conversation Monitor

| Farmer | Farmer ID | Phone/Contact | Last Message | Detected Intent | Conversation Status | Last Updated |
|---|---|---|---|---|---|---|
| Farmer A | F001 | +91 ******1201 | I need 400 units tomorrow morning | Water request | Processing | 10:42 |
| Farmer B | F002 | +91 ******3382 | I accept the proposal | Accept proposal | Completed | 10:39 |
| Farmer C | F003 | +91 ******7710 | I need at least 400 units | Object proposal | Negotiation | 10:35 |

### Example Intents

- Water request
- Schedule inquiry
- Accept proposal
- Object proposal
- Need more water
- Need different time
- Cancel request
- Under-delivery complaint
- Leakage report
- Emergency
- General query

## 2.3 Message Processing Pipeline

```text
Farmer Message
      ↓
    Twilio
      ↓
    Webhook
      ↓
 PS14 Backend
      ↓
Conversation Agent
      ↓
 Intent Detection
      ↓
Structured Request
      ↓
Mediation / Allocation
      ↓
    Response
      ↓
    Twilio
      ↓
    Farmer
```

### Example

Farmer message:

```text
"I need 400 units tomorrow morning."
```

Converted into:

```json
{
  "farmer_id": "F001",
  "intent": "water_request",
  "quantity": 400,
  "date": "tomorrow",
  "preferred_time": "morning"
}
```

## 2.4 Message Status

Messages should support:

- Received
- Processing
- Sent
- Delivered
- Read where supported
- Failed

## 2.5 Automated Notifications

Examples:

- Schedule confirmation
- Schedule modification
- Water shortage
- Rainfall update
- Negotiation proposal
- Under-delivery alert
- Emergency notification
- Maintenance notification

## 2.6 Interactive Responses

Example:

```text
Your proposed allocation is 350 units.

[Accept]    [Object]

[Need More Water]
[Different Time]
[Emergency]
[Report Issue]
```

## 2.7 Objection Processing

Example:

```text
Farmer:
"I need at least 400 units."
        ↓
Objection received
        ↓
Convert to minimum-water constraint
        ↓
Check feasibility
        ↓
Recalculate
        ↓
Generate revised proposal
        ↓
Send through Twilio
```

## 2.8 Communication Logs

Store:

| Field | Description |
|---|---|
| Message ID | Unique message identifier |
| Farmer ID | Associated farmer |
| Direction | Incoming / outgoing |
| Timestamp | Message time |
| Intent | Detected intent |
| Processing Status | Current processing state |
| Response | Generated response |
| Delivery Status | Delivery state |
| Error | Error information if applicable |

## 2.9 Communication Health

Show:

- Webhook online/offline
- Last webhook event
- Failed messages
- Retry status
- Unknown farmer messages
- Duplicate messages

## 2.10 Twilio Security

- HTTPS webhook
- Webhook verification
- Signature validation where applicable
- Secrets/tokens stored securely
- No credentials in source code
- Mask farmer phone numbers in admin UI

---

# 3. Farmer Dashboard

## Purpose

The farmer dashboard must be extremely simple.

```text
Request Water
      ↓
See Allocation
      ↓
Understand Why
      ↓
Accept or Object
      ↓
Negotiate
      ↓
See Schedule
      ↓
Monitor Delivery
      ↓
Report Issue
      ↓
See History
```

## 3.1 Farmer Home

| Card | Sample Value |
|---|---:|
| Today's Allocation | 350 units |
| Next Water Schedule | 06:00–08:00 |
| Requested Water | 400 units |
| Allocated Water | 350 units |
| Delivered Water | 280 units |
| Current Status | Under Delivery |
| Pending Negotiation | 1 |

## 3.2 Farmer Profile

Fields:

- Farmer ID
- Name
- Village
- Field ID
- Land area
- Crop
- Crop stage
- Canal
- Registered communication number
- Preferred irrigation period

## 3.3 Water Request

### A. Structured Form

Fields:

- Quantity
- Date
- Preferred time
- Duration
- Crop
- Crop stage
- Urgency

### B. Natural Language Request

Example:

```text
"I need 400 units tomorrow morning."
```

The Conversation Agent converts the natural language request into structured data.

## 3.4 Current Request Status

Display:

```text
Requested:       400
Available:      1000
Total Demand:   1200
Shortage:        200
Status:          Conflict Detected
```

## 3.5 My Allocation

| Field | Example |
|---|---|
| Requested | 400 units |
| Allocated | 350 units |
| Date | 12 Sep 2026 |
| Start Time | 06:00 |
| End Time | 08:00 |
| Canal | C1 |
| Status | Proposed |
| Reason for Adjustment | Limited available water |

### Statuses

- Pending
- Proposed
- Accepted
- Scheduled
- In Progress
- Completed
- Modified
- Cancelled
- Disputed

## 3.6 Negotiation Center

This is a major feature.

```text
Your Request:      400 units
PS14 Proposal:     350 units

Reason:
Limited available water and competing farmer requirements.

[Accept]    [Object]
```

## 3.7 Objection Flow

When the farmer selects **Object**, show:

- Need more water
- Need different time
- Crop critical
- Emergency
- Other

Then allow free text.

## 3.8 Counter Proposal

Example:

```text
"I can accept 350 units in the morning if I receive
another 50 units in the evening."
```

PS14 checks feasibility and returns:

```text
Morning: 350
Evening: 50
Total:   400

[Accept]
[Object]
```

## 3.9 Decision Explanation

Example:

### Why did I receive 350 units?

- Available water: 1000
- Total demand: 1200
- Crop priority
- Minimum requirements of other farmers
- Canal capacity
- Historical fairness
- Final allocation selected by the mediation/optimization process

Complicated mathematical details should not be exposed to normal farmers.

## 3.10 Water Delivery Monitoring

```text
Authorized: 400
Delivered:  280
Shortfall:  120
Status:     Under-delivery detected

[Report Issue]
```

## 3.11 Issue Reporting

Types:

- Water not received
- Less water received
- Late delivery
- Canal problem
- Gate problem
- Leakage
- Other

## 3.12 Schedule Calendar

Show:

- Date
- Time
- Quantity
- Canal
- Status
- Changes

## 3.13 Notifications

Include:

- New schedule
- Schedule changed
- Rainfall
- Water shortage
- Maintenance
- Negotiation response
- Under-delivery
- Agreement confirmation
- Emergency

## 3.14 Allocation History

Show:

- Requested
- Allocated
- Delivered
- Date
- Reason for change
- Negotiation
- Final agreement

Historical data supports fairness analysis.

---

# 4. Canal Authority Dashboard

## Purpose

The Canal Authority controls and monitors distribution between the dam and farmers.

### Responsibilities

- Canal monitoring
- Gate monitoring
- Farmer allocation
- Scheduling
- Conflict monitoring
- Delivery verification
- Water-loss investigation
- Maintenance
- Operational approval

## 4.1 Canal Overview

| Card | Sample Value |
|---|---:|
| Current Canal Flow | 1000 units |
| Water Level | 2.4 m |
| Canal Capacity | 1200 units |
| Capacity Utilization | 83% |
| Number of Farmers | 48 |
| Active Conflicts | 3 |
| Active Alerts | 5 |
| Under-delivery Cases | 2 |
| Water-loss Alerts | 1 |

## 4.2 Live Canal Monitoring

Show:

- Upstream flow
- Downstream flow
- Water level
- Canal capacity
- Current gate opening
- Authorized gate opening
- Farmer outlet flow
- Expected loss
- Measured loss
- Unaccounted water

### Example

```text
Upstream Flow:       1000
Downstream Flow:      720
Authorized Outflow:   700
Unaccounted Difference: 20
```

## 4.3 Canal Map

```text
DAM
 |
Sensor S1
 |
Gate G1
 |
Farmer A
 |
Gate G2
 |
Farmer B
 |
Gate G3
 |
Farmer C
 |
Downstream
```

Each node should show:

- Flow
- Level
- Gate
- Sensor status
- Alert

## 4.4 Gate Management

| Field | Example |
|---|---|
| Gate ID | G2 |
| Authorized Opening | 60% |
| Actual Opening | 75% |
| Flow | 320 units |
| Operator | Operator-07 |
| Last Update | 10:42 |
| Maintenance Status | Normal |

```text
Authorized: 60%
Actual:     75%
Status:     Deviation
```

A deviation should trigger investigation/alert.

## 4.5 Farmer Allocation Management

| Farmer | Requested | Allocated | Delivered | Shortfall | Status |
|---|---:|---:|---:|---:|---|
| A | 400 | 350 | 350 | 0 | Complete |
| B | 400 | 350 | 280 | 70 | Under-delivery |
| C | 400 | 300 | 300 | 0 | Complete |

## 4.6 Conflict Management

Show:

- Conflict ID
- Farmers involved
- Available water
- Total demand
- Shortage
- Priority
- PS14 proposal
- Objections
- Current negotiation state

Actions:

```text
[Review]
[Approve]
[Request Revision]
[Escalate]
```

## 4.7 Water Loss / Anomaly Panel

> **Important:** Do not call every anomaly "theft".

Show:

| Field | Example |
|---|---|
| Water Anomaly | ANM-024 |
| Location | Canal C1 / G2 |
| Expected Flow | 700 |
| Measured Flow | 680 |
| Difference | 20 |
| Status | Investigation Required |

### Possible Causes

- Leakage
- Seepage
- Unauthorized withdrawal
- Gate mismatch
- Sensor error
- Unexpected discharge
- Evaporation/physical loss

### Evidence

- Flow sensors
- Level sensors
- Gate position
- Outlet meters
- Historical pattern
- Rainfall/weather

The system should report a **possible unauthorized withdrawal/anomaly**, not definitively prove theft.

## 4.8 Under-Delivery Detection

Example:

```text
Authorized: 400
Actual:     280
Shortfall:  120

Possible Causes:
- Upstream shortage
- Gate problem
- Leakage
- Unauthorized withdrawal
- Sensor error
- Delivery delay

Status: Investigation Required
```

## 4.9 Maintenance

Track:

- Gate failure
- Sensor offline
- Canal leakage
- Canal blockage
- Damaged infrastructure
- Low flow

| Asset | Problem | Severity | Last Update | Assigned Authority | Resolution Status |
|---|---|---|---|---|---|
| G2 | Gate mismatch | High | 10:42 | Canal Operator | Open |
| S4 | Sensor offline | Medium | 09:18 | Maintenance Team | In Progress |
| C1 | Leakage | High | 08:50 | Canal Authority | Open |

## 4.10 Canal Schedule

Show all farmer time slots.

```text
06:00–08:00 → A → 350
08:00–10:00 → B → 300
10:00–12:00 → C → 350
```

The scheduler must prevent impossible overlapping allocations where canal capacity is shared.

## 4.11 Authority Approval

Sensitive operations:

- Manual allocation override
- Gate change
- Schedule change
- Priority override
- Emergency operation

These require authorization and must create an audit entry.

---

# 5. Dam Authority Dashboard

## Purpose

The Dam Authority manages source-level water availability.

### Main Question

> "How much water is available and how much can safely be released?"

## 5.1 Dam Overview

| Card | Sample Value |
|---|---:|
| Reservoir Level | 118.4 m |
| Storage Volume | 5,000 units |
| Available Irrigation Water | 4,200 units |
| Inflow | 850 units/day |
| Outflow | 700 units/day |
| Release Rate | 700 units/day |
| Rainfall | 18 mm |
| Dam Status | Normal |
| Emergency Alerts | 0 |

## 5.2 Reservoir Monitoring

Show:

- Current level
- Storage
- Irrigation water
- Dead storage
- Inflow
- Outflow
- Release rate
- Historical trend

## 5.3 Water Availability Forecast

Show:

- Current availability
- Future availability
- Inflow trend
- Reservoir trend
- Rainfall impact
- Expected irrigation capacity

Example:

```text
Day 1 → High
Day 2 → High
Day 3 → Medium
Day 4 → Medium
Day 5 → Low
```

Forecasting is advisory and should not override safety/authority rules.

## 5.4 Rainfall Monitoring

Show:

- Current rainfall
- 24-hour rainfall
- Historical rainfall
- Forecast rainfall
- Catchment affected
- Estimated inflow impact

Rainfall should trigger recalculation rather than automatically reducing every farmer's requirement.

## 5.5 Release Management

Example:

```text
Available Water: 5000
Canal Requests:  6200
Shortage:        1200
```

| Canal | Requested | Approved | Status |
|---|---:|---:|---|
| C1 | 2000 | 1800 | Approved |
| C2 | 2200 | 1800 | Approved |
| C3 | 2000 | 1400 | Reduced |

## 5.6 Canal-Wise Release

| Canal ID | Requested | Approved | Released | Received | Difference | Status |
|---|---:|---:|---:|---:|---:|---|
| C1 | 2000 | 1800 | 1800 | 1780 | 20 | Minor Difference |
| C2 | 2200 | 1800 | 1800 | 1800 | 0 | Normal |
| C3 | 2000 | 1400 | 1400 | 1380 | 20 | Minor Difference |

## 5.7 Emergency Management

### Conditions

- Very low reservoir
- Heavy rainfall
- Flood risk
- Critical shortage
- Unexpected inflow
- Unexpected water loss

### Actions

- Notify canal authorities
- Change release plan
- Initiate priority mode
- Escalate to authorized human officer

AI should recommend actions, but safety-critical final actions must follow authority rules.

## 5.8 Release History

Track:

| Date | Canal | Approved Quantity | Actual Quantity | Authority | Reason | Result |
|---|---|---:|---:|---|---|---|
| 11 Sep 2026 | C1 | 1800 | 1800 | Dam Officer | Irrigation demand | Normal |
| 11 Sep 2026 | C2 | 1800 | 1780 | Dam Officer | Limited storage | Completed |

## 5.9 Dam-to-Canal Water Balance

```text
Reservoir Release
       ↓
Canal Received
       ↓
Farmer Allocations
       ↓
Actual Delivery
       ↓
Expected Physical Loss
       ↓
Unaccounted Difference
```

Large unexplained differences generate alerts.

---

# 6. Cross-Dashboard End-to-End Demo

## Scenario

Three farmers compete for limited water.

```text
Farmer A = 400 units
Farmer B = 400 units
Farmer C = 400 units

Available Water = 1000 units
Total Demand    = 1200 units
Shortage        = 200 units
```

## Workflow

### Step 1 — Farmer Request

Farmer A sends through Twilio:

```text
I need 400 units tomorrow morning.
```

### Step 2 — Communication Layer

Twilio receives the message and forwards it to the PS14 backend.

### Step 3 — Conversation Agent

The Conversation Agent extracts:

```json
{
  "farmer_id": "F001",
  "intent": "water_request",
  "quantity": 400,
  "date": "tomorrow",
  "preferred_time": "morning"
}
```

### Step 4 — Water Availability

The Dam Dashboard provides the available water state.

```text
Available Water = 1000 units
```

### Step 5 — Canal Capacity

The Canal Dashboard provides the available canal capacity and operational constraints.

### Step 6 — Rule Engine

The Rule Engine checks applicable constraints.

### Step 7 — Conflict Detection

PS14 detects:

```text
Total Demand = 1200
Available    = 1000
Shortage     = 200
Status       = Conflict Detected
```

### Step 8 — Mediation

The Mediation Agent proposes a feasible/fair allocation.

Example:

```text
Farmer A → 350
Farmer B → 350
Farmer C → 300
```

### Step 9 — Farmer Review

Farmer A receives:

```text
Your requested amount: 400
PS14 proposal:         350

[Accept] [Object]
```

### Step 10 — Objection

Farmer A responds:

```text
I need at least 400 units.
```

The objection becomes a structured constraint.

### Step 11 — Recalculation

The system checks the new constraint against:

- Available water
- Other farmer requirements
- Canal capacity
- Applicable rules
- Fairness constraints
- Existing commitments

### Step 12 — Revised Proposal

PS14 generates a revised feasible proposal if one exists.

### Step 13 — Farmer Acceptance

The farmer accepts the proposal.

### Step 14 — Canal Execution

The Canal Authority executes the agreed schedule.

### Step 15 — IoT Verification

Sensors report actual delivery.

```text
Authorized = 400
Delivered  = 280
Shortfall  = 120
```

### Step 16 — Anomaly Detection

The system flags an anomaly for investigation.

It does not automatically conclude theft.

### Step 17 — Authority Investigation

The Canal Authority reviews:

- Sensor readings
- Gate position
- Historical flow
- Canal conditions
- Outlet readings
- Possible leakage
- Possible unauthorized withdrawal

### Step 18 — Audit

The complete request, proposal, objection, recalculation, agreement, execution, sensor observations, and authority actions are stored.

---

# 7. Data Shared Between Dashboards

## Farmer

| Field | Description |
|---|---|
| farmer_id | Unique farmer identifier |
| name | Farmer name |
| village | Village |
| field_id | Field identifier |
| land_area | Land area |
| crop | Crop |
| crop_stage | Crop growth stage |
| canal_id | Associated canal |

## Water Request

| Field | Description |
|---|---|
| request_id | Unique request identifier |
| farmer_id | Requesting farmer |
| quantity | Requested quantity |
| date | Requested date |
| time | Preferred time |
| urgency | Request urgency |
| status | Request state |

## Allocation

| Field | Description |
|---|---|
| allocation_id | Unique allocation identifier |
| farmer_id | Farmer |
| requested | Requested quantity |
| allocated | Allocated quantity |
| date | Allocation date |
| slot | Time slot |
| canal | Canal |
| reason | Reason for adjustment |
| status | Allocation state |

## Sensor Reading

| Field | Description |
|---|---|
| sensor_id | Sensor identifier |
| location | Sensor location |
| flow | Measured flow |
| water_level | Measured water level |
| timestamp | Reading timestamp |
| status | Sensor status |

## Conflict

| Field | Description |
|---|---|
| conflict_id | Unique conflict identifier |
| farmers | Farmers involved |
| available_water | Available water |
| total_demand | Combined demand |
| shortage | Shortage |
| constraints | Active constraints |
| status | Conflict state |

## Negotiation

| Field | Description |
|---|---|
| negotiation_id | Negotiation identifier |
| conflict_id | Associated conflict |
| farmer | Farmer |
| proposal | Current proposal |
| objection | Farmer objection |
| revised_proposal | Revised proposal |
| response | Farmer response |
| status | Negotiation state |

## Agreement

| Field | Description |
|---|---|
| agreement_id | Agreement identifier |
| final_schedule | Final schedule |
| participants | Agreement participants |
| approval | Approval information |
| timestamp | Agreement timestamp |

## Audit

| Field | Description |
|---|---|
| audit_id | Audit identifier |
| event | Event description |
| actor | Actor/system component |
| old_value | Previous value |
| new_value | New value |
| reason | Reason |
| timestamp | Event timestamp |

---

# 8. Role-Based Access

## Farmer

### Can

- Request water
- View allocation
- Object
- Negotiate
- Accept
- Report issue
- View own history

### Cannot

- Change gates
- Change dam releases
- Modify rules
- Change other farmers' allocations

## Canal Authority

### Can

- Monitor canal
- Manage operational distribution
- Investigate anomalies
- Review conflicts
- Manage gates according to authorization
- Approve operational changes

## Dam Authority

### Can

- Monitor reservoir
- Manage source releases
- Monitor rainfall/inflow/outflow
- Allocate water to canals
- Manage dam-level emergencies

## Twilio/Admin

### Can

- Monitor communication
- Monitor message health
- View communication logs

### Cannot

- Directly modify water allocation decisions

---

# 9. Notification System

## Critical

- Dam emergency
- Major water shortage
- Major unexplained water loss
- Gate failure

## Warning

- Under-delivery
- Sensor offline
- Canal capacity exceeded
- Allocation conflict

## Information

- Schedule approved
- Rainfall detected
- Negotiation completed
- Maintenance completed

---

# 10. Audit and Transparency

PS14 must maintain a complete decision history.

### Example

```text
Audit ID: AUD-1042

Farmer request:       400
Initial allocation:   350
Objection:             Minimum 400 required
Recalculation:         Performed
Final allocation:      350
Reason:                No feasible solution satisfying
                       all minimum constraints
Approved by:           Canal Authority
Timestamp:             11 Sep 2026 10:45
```

Old decisions should not simply be overwritten.

Every important state-changing decision should create a new audit entry.

---

# 11. Hackathon MVP Priority

## MUST HAVE

### Farmer

- Request
- Allocation
- Accept/Object
- Negotiation
- Schedule
- Notifications

### Canal

- Live status
- Farmer allocation
- Conflict list
- Under-delivery
- Water anomaly
- Schedule

### Dam

- Reservoir
- Available water
- Inflow/outflow
- Rainfall
- Canal releases

### Twilio

- Incoming message
- Farmer identification
- Backend processing
- Outgoing response
- Message status

## SHOULD HAVE

- Clear decision explanations
- Audit trail
- Role-based access
- Allocation history
- Authority approval flow
- Maintenance tracking

## BONUS

- IoT simulator
- ML demand prediction
- ML anomaly detection
- Interactive message buttons
- Advanced analytics

## FUTURE SCOPE

- Production Meta WhatsApp Business Platform
- More sensor types
- Large-scale ML forecasting
- Multi-region deployment
- Advanced multilingual support

The communication provider should remain replaceable. The PS14 core engine should not depend on Twilio-specific water allocation logic.

---

# 12. Final Presentation Flow

```text
Farmer asks
     ↓
Twilio receives
     ↓
PS14 understands
     ↓
Dam tells available water
     ↓
Canal tells delivery capacity
     ↓
Conflict detected
     ↓
Mediation Agent negotiates
     ↓
Farmer objects
     ↓
PS14 revises allocation
     ↓
Farmer accepts
     ↓
Canal executes
     ↓
IoT verifies delivery
     ↓
Anomaly detected if actual != authorized
     ↓
Authority investigates
     ↓
Agreement + audit stored
```

## Final Product Statement

> **"PS14 is not merely a water allocation calculator or chatbot. It is an autonomous, fairness-aware mediation platform that continuously understands stakeholder requirements, detects conflicts, reasons over water and canal constraints, negotiates feasible alternatives, explains decisions, monitors actual delivery, and records accountable agreements."**
