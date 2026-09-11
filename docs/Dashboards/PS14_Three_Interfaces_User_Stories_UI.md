# PS14 --- User Interfaces & User Stories

## Overview

The PS14 prototype will use **three role-based interfaces**:

1.  **Dam / Water Operator**
2.  **Jal Vigyani / Community Water Expert**
3.  **Farmer**

These are three views of one shared water-governance platform rather
than three independent applications.

> **Important:** PS14 explicitly requires a farmer/stakeholder
> interface, but it does not explicitly mandate these three roles. The
> three-role model is our proposed system design, with the Jal Vigyani
> role inspired by the Community Hydrologist model.

------------------------------------------------------------------------

# 1. Role Model

  -----------------------------------------------------------------------
  Role                    Primary Responsibility  Main Question
  ----------------------- ----------------------- -----------------------
  Dam / Water Operator    Water supply and        "How much water is
                          release information     actually available?"

  Jal Vigyani             Ground-level water      "What is actually
                          evidence and            happening in the
                          infrastructure          irrigation network?"
                          monitoring              

  Farmer                  Water demand,           "What do I need, and am
                          complaints, objections  I receiving my fair
                          and negotiation         allocation?"

  AI Mediation System     Conflict resolution and "Given the evidence and
                          coordination            constraints, what is a
                                                  feasible and fair
                                                  solution?"
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# 2. Shared System

All three interfaces connect to the same backend.

``` text
                 WATER GOVERNANCE PLATFORM
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        ▼                 ▼                 ▼
   DAM OPERATOR       JAL VIGYANI        FARMERS
        │                 │                 │
   Water supply       Evidence/data      Requirements
   Dam release        Measurements       Complaints
   Canal flow         Infrastructure     Objections
        │                 │                 │
        └─────────────────┼─────────────────┘
                          ▼
                   AI COORDINATOR
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
      Conflict        Allocation       Mediation
      Detection        Engine            Agent
          │               │               │
          └───────────────┼───────────────┘
                          ▼
                   Schedule Generator
                          │
                          ▼
                    Negotiation
                          │
                          ▼
                  Agreement / Audit
```

------------------------------------------------------------------------

# 3. Interface 1 --- Dam / Water Operator

## Purpose

The Dam Operator provides the **supply-side state** of the irrigation
system.

The operator is responsible for entering or monitoring information such
as:

-   reservoir level,
-   available water,
-   planned release,
-   canal release,
-   canal flow,
-   canal capacity,
-   scarcity status.

The operator is **not the mediator**.

Their data becomes an input to the allocation and mediation workflow.

------------------------------------------------------------------------

## Main Dashboard

``` text
┌──────────────────────────────────────────────┐
│              DAM OPERATOR                    │
├──────────────────────────────────────────────┤
│                                              │
│ Reservoir Level                 72%          │
│ Available Water             50,000 L         │
│ Today's Planned Release     50,000 L         │
│                                              │
│ ──────────────────────────────────────────── │
│                                              │
│ MAIN CANAL                                   │
│ Flow Rate                    500 L/min       │
│ Capacity                     600 L/min       │
│ Status                         NORMAL         │
│                                              │
│ ──────────────────────────────────────────── │
│                                              │
│ WATER DEMAND               63,000 L           │
│ AVAILABLE WATER            50,000 L          │
│ SCARCITY                    20.6%             │
│                                              │
│ [ Update Water State ]                       │
│ [ View 3D Network ]                          │
│ [ View Distribution ]                        │
└──────────────────────────────────────────────┘
```

------------------------------------------------------------------------

## Dam Operator User Stories

### DO-US-01 --- View Reservoir Status

**As a dam operator,**\
I want to view the current reservoir level and available water,\
so that I know how much water can be released to the irrigation network.

**Acceptance Criteria**

-   Reservoir level is visible.
-   Available water is visible.
-   Data has a timestamp.
-   Current status is clearly shown.

------------------------------------------------------------------------

### DO-US-02 --- Update Available Water

**As a dam operator,**\
I want to update the available water quantity,\
so that the allocation system uses the latest supply information.

**Acceptance Criteria**

-   Operator can enter available water.
-   Previous value is retained in history.
-   New value is timestamped.
-   Allocation engine receives the updated value.

------------------------------------------------------------------------

### DO-US-03 --- Set Canal Release

**As a dam operator,**\
I want to specify the planned canal release,\
so that downstream allocation can respect the actual release.

**Acceptance Criteria**

-   Release quantity can be entered.
-   Release cannot exceed the configured available supply.
-   The updated release is visible to other roles.

------------------------------------------------------------------------

### DO-US-04 --- Identify Scarcity

**As a dam operator,**\
I want the system to compare available water with total demand,\
so that scarcity can be identified early.

**Acceptance Criteria**

``` text
Available Water < Total Demand
        ↓
Scarcity Detected
```

The system displays the scarcity level.

------------------------------------------------------------------------

### DO-US-05 --- View Water Distribution

**As a dam operator,**\
I want to see how water is distributed across the canal network,\
so that I can understand the overall situation.

**Acceptance Criteria**

-   Canal network is visible.
-   Farmer allocation status is visible.
-   Head-end and tail-end areas can be identified.
-   Current water-flow state is displayed.

------------------------------------------------------------------------

# 4. Interface 2 --- Jal Vigyani

## Purpose

The Jal Vigyani is the **community-level technical/evidence role**.

The interface should help the Jal Vigyani understand what is happening
on the ground.

Possible responsibilities include:

-   mapping irrigation infrastructure,
-   recording flow measurements,
-   recording infrastructure problems,
-   documenting discrepancies,
-   monitoring water distribution,
-   verifying reported shortages,
-   providing evidence for dispute resolution.

The Jal Vigyani should **not be presented as a judge who automatically
decides who is lying**.

Instead:

``` text
Observation
     ↓
Measurement
     ↓
Evidence
     ↓
System Analysis
     ↓
Mediation
```

------------------------------------------------------------------------

## Main Dashboard

``` text
┌──────────────────────────────────────────────┐
│              JAL VIGYANI                     │
├──────────────────────────────────────────────┤
│                                              │
│ CANAL NETWORK                                │
│                                              │
│ Main Canal                  ✓ NORMAL         │
│ Distributary 1              ✓ NORMAL         │
│ Distributary 2              ⚠ LOW FLOW       │
│ Field Channel F10           ⚠ CHECK          │
│                                              │
│ ──────────────────────────────────────────── │
│                                              │
│ Current Flow                420 L/min         │
│ Expected Flow               500 L/min         │
│ Difference                   -80 L/min        │
│                                              │
│ ──────────────────────────────────────────── │
│                                              │
│ Active Reports                 3              │
│ Conflicts Requiring Review    1              │
│                                              │
│ [ Record Measurement ]                       │
│ [ Report Infrastructure Issue ]              │
│ [ Verify Conflict ]                          │
│ [ Open 3D Water Map ]                        │
└──────────────────────────────────────────────┘
```

------------------------------------------------------------------------

## Jal Vigyani User Stories

### JV-US-01 --- View Irrigation Network

**As a Jal Vigyani,**\
I want to view the irrigation network and connected farms,\
so that I can understand how water physically reaches farmers.

**Acceptance Criteria**

-   Dam is visible.
-   Main canal is visible.
-   Distributaries/laterals are visible.
-   Farmer plots are visible.
-   Head-end and tail-end positions are identifiable.

------------------------------------------------------------------------

### JV-US-02 --- Record Water Flow

**As a Jal Vigyani,**\
I want to record observed water flow,\
so that actual distribution can be compared with expected distribution.

**Acceptance Criteria**

-   Measurement location is recorded.
-   Flow value is recorded.
-   Timestamp is recorded.
-   Measurement is associated with the relevant canal/field channel.

------------------------------------------------------------------------

### JV-US-03 --- Report Infrastructure Problem

**As a Jal Vigyani,**\
I want to report a blockage, leakage or damaged channel,\
so that the system can distinguish infrastructure problems from
allocation disputes.

**Acceptance Criteria**

The report contains:

-   location,
-   issue type,
-   severity,
-   observation,
-   timestamp.

------------------------------------------------------------------------

### JV-US-04 --- Verify Farmer Shortage

**As a Jal Vigyani,**\
I want to investigate a farmer's shortage complaint,\
so that the mediation system receives evidence instead of relying only
on claims.

**Acceptance Criteria**

The Jal Vigyani can view:

-   farmer allocation,
-   expected water,
-   actual reported water,
-   nearby flow measurements,
-   relevant infrastructure reports.

------------------------------------------------------------------------

### JV-US-05 --- Identify Distribution Discrepancy

**As a Jal Vigyani,**\
I want to compare expected and observed flow,\
so that I can identify potential distribution discrepancies.

Example:

``` text
Expected Flow: 500 L/min
Observed Flow: 420 L/min

Difference: -80 L/min
```

The system should flag the discrepancy for investigation.

------------------------------------------------------------------------

### JV-US-06 --- Provide Evidence to Mediation

**As a Jal Vigyani,**\
I want verified measurements and observations to become part of the
dispute record,\
so that the mediation agent can explain decisions using evidence.

------------------------------------------------------------------------

# 5. Interface 3 --- Farmer

## Purpose

The farmer interface is the primary stakeholder-facing interface
required by PS14.

Farmers should be able to:

-   provide water requirements,
-   view allocations,
-   view schedules,
-   report shortages,
-   raise disputes,
-   ask questions,
-   object to proposed allocations,
-   negotiate with the mediation agent,
-   accept or reject proposals.

------------------------------------------------------------------------

## Farmer Dashboard

``` text
┌──────────────────────────────────────────────┐
│              FARMER DASHBOARD                │
├──────────────────────────────────────────────┤
│                                              │
│ Farmer: F10                                  │
│ Crop: Sugarcane                              │
│ Land: 3.5 acres                               │
│                                              │
│ Water Required          9,000 L              │
│ Allocated               7,000 L              │
│ Received                4,200 L              │
│                                              │
│ ⚠ WATER SHORTAGE                            │
│                                              │
│ Today's Schedule                            │
│ 08:30 — 09:00                               │
│                                              │
│ ──────────────────────────────────────────── │
│                                              │
│ [ Talk to Mediator ]                         │
│ [ Report Shortage ]                          │
│ [ Object to Allocation ]                     │
│ [ View Why ]                                 │
└──────────────────────────────────────────────┘
```

------------------------------------------------------------------------

## Farmer User Stories

### F-US-01 --- Submit Water Requirement

**As a farmer,**\
I want to provide my crop and water requirement,\
so that the system can consider my actual irrigation needs.

**Acceptance Criteria**

-   Farmer can select/enter crop.
-   Farmer can provide land area.
-   Farmer can provide or confirm water requirement.
-   Requirement becomes available to the allocation engine.

------------------------------------------------------------------------

### F-US-02 --- View Allocation

**As a farmer,**\
I want to see how much water has been allocated to me,\
so that I know my expected share.

------------------------------------------------------------------------

### F-US-03 --- View Irrigation Schedule

**As a farmer,**\
I want to know when I will receive water,\
so that I can plan irrigation activities.

Example:

``` text
Your irrigation slot:
08:30 – 09:00

Expected allocation:
7,000 L
```

------------------------------------------------------------------------

### F-US-04 --- Report Water Shortage

**As a farmer,**\
I want to report that I received less water than expected,\
so that the system can investigate the problem.

Example:

``` text
Allocated: 7,000 L
Received: 4,200 L

[ Report Shortage ]
```

------------------------------------------------------------------------

### F-US-05 --- Ask Why Allocation Changed

**As a farmer,**\
I want to ask the mediator why my allocation changed,\
so that I understand the decision.

Example:

> "Why did my water reduce?"

The system should return an evidence-based explanation.

------------------------------------------------------------------------

### F-US-06 --- Object to Allocation

**As a farmer,**\
I want to object to a proposed allocation,\
so that my concerns can be considered before an agreement is finalized.

------------------------------------------------------------------------

### F-US-07 --- Negotiate With Mediator

**As a farmer,**\
I want to communicate my concerns to the mediation agent,\
so that a revised proposal can be considered.

Example:

``` text
Farmer:
"My crop is at a critical irrigation stage.
I need additional water today."

Mediator:
"I'll consider this requirement against the
available supply and other farmers' minimum needs."
```

------------------------------------------------------------------------

### F-US-08 --- Accept or Reject Proposal

**As a farmer,**\
I want to accept or reject the proposed schedule,\
so that the final agreement represents stakeholder consent.

------------------------------------------------------------------------

### F-US-09 --- View Final Agreement

**As a farmer,**\
I want to view the final allocation and schedule,\
so that I know what was agreed.

------------------------------------------------------------------------

# 6. Cross-Role User Stories

These stories connect all three interfaces.

------------------------------------------------------------------------

## CROSS-US-01 --- Detect Water Conflict

**As the system,**\
I want to compare water availability, requirements, allocations and
observed distribution,\
so that potential conflicts can be detected.

``` text
Available Water
      +
Farmer Requirements
      +
Current Allocation
      +
Observed Distribution
      ↓
Conflict Detection
```

------------------------------------------------------------------------

## CROSS-US-02 --- Generate Allocation

**As the system,**\
I want to calculate an allocation that satisfies defined rules and
constraints,\
so that a feasible water-sharing proposal can be generated.

------------------------------------------------------------------------

## CROSS-US-03 --- Generate Schedule

**As the system,**\
I want to convert the allocation into irrigation time slots,\
so that farmers receive an actionable schedule.

------------------------------------------------------------------------

## CROSS-US-04 --- Explain Decision

**As the system,**\
I want to show the evidence and constraints behind a proposal,\
so that stakeholders understand why it was generated.

------------------------------------------------------------------------

## CROSS-US-05 --- Handle Objection

**As the mediation system,**\
I want to receive stakeholder objections and evaluate whether they
change the relevant requirements or constraints,\
so that a revised proposal can be generated when appropriate.

------------------------------------------------------------------------

## CROSS-US-06 --- Recalculate Proposal

**As the system,**\
I want to recalculate the allocation after a valid state change,\
so that negotiations can produce revised schedules.

------------------------------------------------------------------------

## CROSS-US-07 --- Record Agreement

**As the system,**\
I want to record the final allocation, participants, reasoning and
revisions,\
so that the dispute has an auditable outcome.

------------------------------------------------------------------------

# 7. Complete End-to-End User Journey

``` text
DAM OPERATOR
    │
    │ Updates available water
    ▼
Water State
    │
    ▼
JAL VIGYANI
    │
    │ Records observations
    │ Verifies infrastructure / flow
    ▼
Ground Evidence
    │
    ▼
FARMERS
    │
    │ Submit requirements
    │ Report shortages
    ▼
AI COORDINATOR
    │
    ▼
Conflict Detection
    │
    ▼
Allocation Engine
    │
    ▼
Constraint Validation
    │
    ▼
Schedule Generator
    │
    ▼
MEDIATION AGENT
    │
    ▼
Proposal
    │
    ▼
Farmer Objection?
    │
   YES
    │
    ▼
Updated Requirement / Evidence
    │
    ▼
Recalculate
    │
    ▼
Revised Proposal
    │
    ▼
Farmer Acceptance
    │
    ▼
Agreement + Audit Record
```

------------------------------------------------------------------------

# 8. The Key Scenario

## Initial Situation

``` text
Dam:
Available Water = 50,000 L

Total Farmer Demand = 63,000 L

Scarcity = 13,000 L
```

The system identifies a scarcity condition.

------------------------------------------------------------------------

## Conflict

Farmer F10 is at the tail end.

``` text
F10 Required: 9,000 L
F10 Allocated: 7,000 L
F10 Received: 4,200 L
```

F10 reports:

> "I am not getting my allocated water."

The system does **not** immediately accuse upstream farmers.

------------------------------------------------------------------------

## Investigation

The Jal Vigyani checks:

``` text
Expected Flow
Observed Flow
Infrastructure Condition
Allocation Records
Farmer Reports
```

Possible result:

``` text
Distributary 2
Expected: 500 L/min
Observed: 420 L/min

⚠ 80 L/min discrepancy
```

The system now has evidence for further analysis.

------------------------------------------------------------------------

## Mediation

The farmer asks:

> "Why am I getting less water?"

The mediation agent explains the current situation using:

-   available water,
-   farmer requirements,
-   current allocations,
-   observed flow,
-   applicable rules,
-   constraints.

------------------------------------------------------------------------

## Objection

Another farmer says:

> "I cannot accept reducing my allocation. My crop needs water."

The mediation workflow captures the objection.

The allocation engine recalculates using the updated state.

------------------------------------------------------------------------

## Revised Proposal

The system generates:

``` text
New Allocation
       +
New Schedule
       +
Explanation
       ↓
Farmer Review
```

------------------------------------------------------------------------

## Final Agreement

Once stakeholders accept:

``` text
Agreement ID
Participants
Final Allocation
Irrigation Schedule
Reason
Evidence
Timestamp
Version
```

is recorded.

------------------------------------------------------------------------

# 9. Interface Relationship

The three interfaces answer three different questions:

### Dam Operator

> **How much water do we have?**

### Jal Vigyani

> **What is happening to that water in the real irrigation network?**

### Farmer

> **What do I need, what did I receive, and can I challenge the proposed
> allocation?**

### AI Mediator

> **How can we find a feasible, transparent and fair agreement under the
> available constraints?**

------------------------------------------------------------------------

# 10. MVP Screens

For the 24-hour hackathon, do not build dozens of screens.

### Dam Operator

1.  Dashboard
2.  Update Water State
3.  3D Network View

### Jal Vigyani

1.  Dashboard
2.  Measurement / Evidence
3.  Conflict Verification
4.  3D Network View

### Farmer

1.  Dashboard
2.  Water Schedule
3.  Mediation Chat
4.  Proposal / Agreement

### Shared

1.  3D Digital Twin
2.  Conflict View
3.  Decision Explanation
4.  Agreement / Audit

------------------------------------------------------------------------

# 11. Most Important Product Principle

The three interfaces should **share the same underlying state**.

If the Dam Operator changes:

``` text
Available Water:
60,000 L → 50,000 L
```

the change should affect:

-   allocation engine,
-   conflict detection,
-   farmer dashboards,
-   schedules,
-   mediation,
-   3D visualization.

If the Jal Vigyani records:

``` text
Flow:
500 L/min → 420 L/min
```

the system should be able to use that information during conflict
analysis.

If a farmer objects:

``` text
F10 requests additional water
```

the mediation workflow should trigger a new proposal.

This shared state is what makes the three interfaces feel like **one
autonomous water-governance system**, rather than three disconnected
dashboards.
